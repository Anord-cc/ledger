import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireEditor } from "../middleware/auth.js";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { getPageMetadata } from "../../services/pages.js";

const attachmentSchema = z.object({
  pageId: z.string().uuid(),
  fileName: z.string().min(1),
  contentType: z.string().min(3),
  base64Data: z.string().min(1)
});

export const attachmentsRouter = Router();

attachmentsRouter.get("/", async (req, res) => {
  const pageId = String(req.query.pageId ?? "");
  const page = await getPageMetadata(pageId, req.user ?? null);
  if (!page) {
    return res.status(404).json({ error: "Page not found" });
  }

  const result = await pool.query(
    `SELECT id, page_id, file_name, content_type, storage_path, size_bytes, created_at
     FROM attachments
     WHERE page_id = $1
     ORDER BY created_at DESC`,
    [pageId]
  );

  return res.json({ attachments: result.rows });
});

attachmentsRouter.post("/", requireEditor, async (req, res) => {
  const input = attachmentSchema.parse(req.body);
  const page = await getPageMetadata(input.pageId, req.user ?? null);
  if (!page) {
    return res.status(404).json({ error: "Page not found" });
  }

  if (env.STORAGE_PROVIDER !== "local") {
    return res.status(400).json({ error: "Only local storage is enabled in this MVP" });
  }

  const buffer = Buffer.from(input.base64Data, "base64");
  const fileId = crypto.randomUUID();
  const ext = path.extname(input.fileName);
  const fileName = `${fileId}${ext}`;

  await mkdir(env.LOCAL_STORAGE_ROOT, { recursive: true });
  const storagePath = path.join(env.LOCAL_STORAGE_ROOT, fileName);
  await writeFile(storagePath, buffer);

  const created = await pool.query(
    `
      INSERT INTO attachments (page_id, file_name, content_type, storage_path, size_bytes, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, file_name, storage_path, size_bytes
    `,
    [input.pageId, input.fileName, input.contentType, storagePath, buffer.length, req.user!.id]
  );

  return res.status(201).json(created.rows[0]);
});
