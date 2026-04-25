import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { enqueueWebhookEvent } from "../../services/webhooks.js";
import { logAudit } from "../../services/audit.js";

const feedbackSchema = z.object({
  pageId: z.string().uuid(),
  revisionId: z.string().uuid().optional(),
  helpful: z.boolean(),
  comment: z.string().max(1000).optional()
});

export const feedbackRouter = Router();

feedbackRouter.post("/", async (req, res) => {
  const input = feedbackSchema.parse(req.body);

  const result = await pool.query(
    `
      INSERT INTO feedback (page_id, page_revision_id, user_id, helpful, comment)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `,
    [
      input.pageId,
      input.revisionId ?? null,
      req.user?.id ?? null,
      input.helpful,
      input.comment ?? null
    ]
  );

  await enqueueWebhookEvent("feedback.created", {
    feedbackId: result.rows[0].id,
    pageId: input.pageId,
    helpful: input.helpful
  });

  await logAudit(req.user?.id ?? null, "feedback.create", "feedback", result.rows[0].id, {
    pageId: input.pageId
  });

  return res.status(201).json({ feedbackId: result.rows[0].id });
});
