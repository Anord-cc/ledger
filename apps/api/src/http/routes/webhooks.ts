import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { pool } from "../../db/pool.js";
import { logAudit } from "../../services/audit.js";

const webhookSchema = z.object({
  name: z.string().min(2),
  targetUrl: z.string().url(),
  signingSecret: z.string().min(8),
  events: z.array(z.string()).min(1)
});

export const webhooksRouter = Router();
webhooksRouter.use(requireAdmin);

webhooksRouter.get("/", async (_req, res) => {
  const result = await pool.query(`SELECT * FROM webhooks ORDER BY created_at DESC`);
  return res.json({ webhooks: result.rows });
});

webhooksRouter.post("/", async (req, res) => {
  const input = webhookSchema.parse(req.body);
  const created = await pool.query(
    `
      INSERT INTO webhooks (name, target_url, signing_secret, events)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.name, input.targetUrl, input.signingSecret, JSON.stringify(input.events)]
  );

  await logAudit(req.user!.id, "webhook.create", "webhook", created.rows[0].id, {
    events: input.events
  });

  return res.status(201).json(created.rows[0]);
});

