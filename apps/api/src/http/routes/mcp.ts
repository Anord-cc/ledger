import { Router } from "express";
import { z } from "zod";
import { createOrUpdatePage, getPageBySlug, getPageMetadata, listSpaces } from "../../services/pages.js";
import { searchPages } from "../../services/search.js";

const toolsCallSchema = z.object({
  method: z.string(),
  params: z.record(z.any()).optional(),
  id: z.union([z.string(), z.number()]).optional()
});

export const mcpRouter = Router();

mcpRouter.post("/", async (req, res) => {
  const body = toolsCallSchema.parse(req.body);

  if (body.method === "tools/list") {
    return res.json({
      id: body.id,
      result: {
        tools: [
          { name: "search_knowledge_base", description: "Search pages visible to the caller" },
          { name: "read_page", description: "Read a page by slug if visible to the caller" },
          { name: "list_spaces", description: "List spaces visible to the caller" },
          { name: "get_page_metadata", description: "Get page metadata by page id" },
          { name: "create_draft_page", description: "Create a draft page if authorized" }
        ]
      }
    });
  }

  if (body.method === "tools/call") {
    const name = String(body.params?.name ?? "");
    const args = body.params?.arguments ?? {};

    if (name === "search_knowledge_base") {
      const result = await searchPages(String(args.query ?? ""), req.user ?? null);
      return res.json({ id: body.id, result });
    }

    if (name === "read_page") {
      const result = await getPageBySlug(String(args.slug ?? ""), req.user ?? null);
      return res.json({ id: body.id, result });
    }

    if (name === "list_spaces") {
      const result = await listSpaces(req.user ?? null);
      return res.json({ id: body.id, result });
    }

    if (name === "get_page_metadata") {
      const result = await getPageMetadata(String(args.pageId ?? ""), req.user ?? null);
      return res.json({ id: body.id, result });
    }

    if (name === "create_draft_page") {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      if (req.user.role === "viewer" || req.user.role === "public") {
        return res.status(403).json({ error: "Editor access required" });
      }

      const result = await createOrUpdatePage(
        null,
        {
          spaceId: String(args.spaceId),
          title: String(args.title),
          bodyMarkdown: String(args.bodyMarkdown),
          visibility: "internal",
          state: "draft"
        },
        req.user.id
      );

      return res.json({ id: body.id, result });
    }
  }

  return res.status(400).json({ error: "Unsupported MCP method" });
});
