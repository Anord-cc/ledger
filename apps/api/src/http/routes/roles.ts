import { Router } from "express";
import { pool } from "../../db/pool.js";

export const rolesRouter = Router();

rolesRouter.get("/", async (_req, res) => {
  const result = await pool.query(`SELECT id, key, name FROM roles ORDER BY created_at ASC`);
  return res.json({ roles: result.rows });
});

