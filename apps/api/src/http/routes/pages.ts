import { Router } from "express";
import { z } from "zod";
import { requireEditor } from "../middleware/auth.js";
import {
  createOrUpdatePage,
  getPageBySlug,
  listPageRevisions,
  listPagesForSpace,
  rollbackPageRevision
} from "../../services/pages.js";
import { enqueueWebhookEvent } from "../../services/webhooks.js";
import { logAudit } from "../../services/audit.js";
import { pool } from "../../db/pool.js";

const pageSchema = z
  .object({
    spaceId: z.string().uuid(),
    title: z.string().min(3),
    slug: z.string().optional(),
    bodyMarkdown: z.string().min(1),
    excerpt: z.string().max(240).optional(),
    visibility: z.enum(["public", "internal", "restricted"]),
    state: z.enum(["draft", "published"]),
    parentPageId: z.string().uuid().nullable().optional(),
    tagNames: z.array(z.string()).optional(),
    allowedRoleKeys: z.array(z.enum(["owner", "admin", "editor", "viewer", "public"])).optional(),
    allowedGroupIds: z.array(z.string().uuid()).optional()
  })
  .superRefine((input, context) => {
    const permissionsCount =
      (input.allowedRoleKeys?.length ?? 0) + (input.allowedGroupIds?.length ?? 0);

    if (input.visibility === "restricted" && permissionsCount === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Restricted pages require at least one role or group permission",
        path: ["allowedRoleKeys"]
      });
    }
  });

export const pagesRouter = Router();

pagesRouter.get("/space/:spaceKey", async (req, res) => {
  const pages = await listPagesForSpace(req.params.spaceKey, req.user ?? null);
  return res.json({ pages });
});

pagesRouter.get("/slug/:slug", async (req, res) => {
  const page = await getPageBySlug(req.params.slug, req.user ?? null);
  if (!page) {
    return res.status(404).json({ error: "Page not found" });
  }
  return res.json({ page });
});

pagesRouter.post("/", requireEditor, async (req, res) => {
  const input = pageSchema.parse(req.body);
  const result = await createOrUpdatePage(null, input, req.user!.id);
  const workspace = await pool.query(`SELECT key FROM spaces WHERE id = $1`, [input.spaceId]);
  const actor = {
    id: req.user!.id,
    name: req.user!.displayName,
    email: req.user!.email
  };
  await logAudit(req.user!.id, "page.create", "page", result.pageId, { slug: result.slug });
  await enqueueWebhookEvent("page.created", { pageId: result.pageId, slug: result.slug }, {
    actor,
    workspaceId: workspace.rows[0]?.key ?? null
  });
  if (input.state === "published") {
    await enqueueWebhookEvent("page.published", { pageId: result.pageId, slug: result.slug }, {
      actor,
      workspaceId: workspace.rows[0]?.key ?? null
    });
  }
  return res.status(201).json(result);
});

pagesRouter.put("/:pageId", requireEditor, async (req, res) => {
  const input = pageSchema.parse(req.body);
  const result = await createOrUpdatePage(req.params.pageId, input, req.user!.id);
  const workspace = await pool.query(`SELECT key FROM spaces WHERE id = $1`, [input.spaceId]);
  await logAudit(req.user!.id, "page.update", "page", req.params.pageId, { slug: result.slug });
  await enqueueWebhookEvent("page.updated", { pageId: req.params.pageId, slug: result.slug }, {
    actor: {
      id: req.user!.id,
      name: req.user!.displayName,
      email: req.user!.email
    },
    workspaceId: workspace.rows[0]?.key ?? null
  });
  return res.json(result);
});

pagesRouter.get("/:pageId/revisions", async (req, res) => {
  const revisions = await listPageRevisions(req.params.pageId, req.user ?? null);
  if (!revisions) {
    return res.status(404).json({ error: "Page not found" });
  }
  return res.json({ revisions });
});

pagesRouter.post("/:pageId/revisions/:revisionId/rollback", requireEditor, async (req, res) => {
  const result = await rollbackPageRevision(req.params.pageId, req.params.revisionId, req.user!.id);
  if (!result) {
    return res.status(404).json({ error: "Revision not found" });
  }
  await logAudit(req.user!.id, "page.rollback", "page", req.params.pageId, {
    revisionId: req.params.revisionId
  });
  return res.json(result);
});

pagesRouter.delete("/:pageId", requireEditor, async (req, res) => {
  const existing = await pool.query(`SELECT slug, space_id FROM pages WHERE id = $1`, [req.params.pageId]);
  if (!existing.rowCount) {
    return res.status(404).json({ error: "Page not found" });
  }

  await pool.query(`DELETE FROM pages WHERE id = $1`, [req.params.pageId]);
  const workspace = await pool.query(`SELECT key FROM spaces WHERE id = $1`, [existing.rows[0].space_id]);
  await enqueueWebhookEvent("page.deleted", { pageId: req.params.pageId, slug: existing.rows[0].slug }, {
    actor: {
      id: req.user!.id,
      name: req.user!.displayName,
      email: req.user!.email
    },
    workspaceId: workspace.rows[0]?.key ?? null
  });
  await logAudit(req.user!.id, "page.delete", "page", req.params.pageId);
  return res.status(204).send();
});
