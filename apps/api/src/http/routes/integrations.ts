import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { pool } from "../../db/pool.js";

const integrationSchema = z.object({
  provider: z.enum(["github", "google_docs", "markdown_import"]),
  name: z.string().min(2),
  config: z.record(z.any()),
  isEnabled: z.boolean()
});

export const integrationsRouter = Router();
integrationsRouter.use(requireAdmin);

integrationsRouter.get("/", async (_req, res) => {
  const result = await pool.query(`SELECT * FROM integrations ORDER BY created_at DESC`);
  return res.json({ integrations: result.rows });
});

integrationsRouter.post("/", async (req, res) => {
  const input = integrationSchema.parse(req.body);
  const created = await pool.query(
    `
      INSERT INTO integrations (provider, name, config, is_enabled)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [input.provider, input.name, JSON.stringify(input.config), input.isEnabled]
  );

  return res.status(201).json(created.rows[0]);
});
