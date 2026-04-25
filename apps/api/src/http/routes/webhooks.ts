import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { pool } from "../../db/pool.js";
import { logAudit } from "../../services/audit.js";

const webhookSchema = z.object({
  name: z.string().min(2),
  targetUrl: z.string().url(),
  signingSecret: z.string().min(8),
  events: z.array(z.enum([
    "page.created",
    "page.updated",
    "page.deleted",
    "page.published",
    "feedback.created",
    "user.invited",
    "search.no_results"
  ])).min(1),
  isActive: z.boolean().default(true)
});

export const webhooksRouter = Router();
webhooksRouter.use(requireAdmin);

function toWebhookResponse(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    targetUrl: row.target_url,
    isActive: row.is_active,
    events: row.events,
    createdAt: row.created_at
  };
}

webhooksRouter.get("/", async (_req, res) => {
  const result = await pool.query(`SELECT * FROM webhooks ORDER BY created_at DESC`);
  return res.json({ webhooks: result.rows.map((row) => toWebhookResponse(row)) });
});

webhooksRouter.post("/", async (req, res) => {
  const input = webhookSchema.parse(req.body);
  const created = await pool.query(
    `
      INSERT INTO webhooks (name, target_url, signing_secret, events, is_active)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [input.name, input.targetUrl, input.signingSecret, JSON.stringify(input.events), input.isActive]
  );

  await logAudit(req.user!.id, "webhook.create", "webhook", created.rows[0].id, {
    events: input.events
  });

  return res.status(201).json(toWebhookResponse(created.rows[0]));
});

webhooksRouter.put("/:webhookId", async (req, res) => {
  const input = webhookSchema.parse(req.body);
  const updated = await pool.query(
    `
      UPDATE webhooks
      SET name = $2, target_url = $3, signing_secret = $4, events = $5, is_active = $6
      WHERE id = $1
      RETURNING *
    `,
    [
      req.params.webhookId,
      input.name,
      input.targetUrl,
      input.signingSecret,
      JSON.stringify(input.events),
      input.isActive
    ]
  );

  if (!updated.rowCount) {
    return res.status(404).json({ error: "Webhook not found" });
  }

  await logAudit(req.user!.id, "webhook.update", "webhook", req.params.webhookId, {
    events: input.events
  });

  return res.json(toWebhookResponse(updated.rows[0]));
});

webhooksRouter.get("/:webhookId/deliveries", async (req, res) => {
  const deliveries = await pool.query(
    `
      SELECT id, event_name, response_status, success, delivered_at, created_at, error_message, attempt_count
      FROM webhook_deliveries
      WHERE webhook_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `,
    [req.params.webhookId]
  );

  return res.json({ deliveries: deliveries.rows });
});

webhooksRouter.delete("/:webhookId", async (req, res) => {
  const deleted = await pool.query(`DELETE FROM webhooks WHERE id = $1 RETURNING id`, [req.params.webhookId]);
  if (!deleted.rowCount) {
    return res.status(404).json({ error: "Webhook not found" });
  }

  await logAudit(req.user!.id, "webhook.delete", "webhook", req.params.webhookId);
  return res.status(204).send();
});
