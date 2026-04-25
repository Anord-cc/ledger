import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { pool } from "../../db/pool.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/users", async (_req, res) => {
  const result = await pool.query(
    `
      SELECT u.id, u.email, u.display_name, r.key AS role_key
      FROM users u
      JOIN roles r ON r.id = u.primary_role_id
      ORDER BY u.created_at ASC
    `
  );
  return res.json({ users: result.rows });
});

adminRouter.get("/groups", async (_req, res) => {
  const result = await pool.query(`SELECT * FROM groups ORDER BY name ASC`);
  return res.json({ groups: result.rows });
});

adminRouter.get("/feedback", async (_req, res) => {
  const result = await pool.query(
    `
      SELECT f.*, p.title AS page_title
      FROM feedback f
      JOIN pages p ON p.id = f.page_id
      ORDER BY f.created_at DESC
      LIMIT 100
    `
  );
  return res.json({ feedback: result.rows });
});

adminRouter.get("/search-analytics", async (_req, res) => {
  const topSearches = await pool.query(
    `
      SELECT query, COUNT(*)::int AS count
      FROM searches
      GROUP BY query
      ORDER BY count DESC, query ASC
      LIMIT 10
    `
  );

  const noResults = await pool.query(
    `
      SELECT query, COUNT(*)::int AS count
      FROM searches
      WHERE results_count = 0
      GROUP BY query
      ORDER BY count DESC, query ASC
      LIMIT 10
    `
  );

  return res.json({
    topSearches: topSearches.rows,
    noResults: noResults.rows
  });
});

