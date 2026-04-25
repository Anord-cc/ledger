import { Router } from "express";
import { z } from "zod";
import { createSessionToken, getUserForSession, hashPassword, verifyPassword } from "../../services/auth.js";
import { pool } from "../../db/pool.js";
import { env, isProduction } from "../../config/env.js";
import { logAudit } from "../../services/audit.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(2)
});

export const authRouter = Router();

authRouter.post("/register", async (req, res) => {
  const userCount = await pool.query(`SELECT COUNT(*)::int AS count FROM users`);
  if (userCount.rows[0].count === 0) {
    return res.status(403).json({ error: "Complete initial Ledger setup first" });
  }

  const input = registerSchema.parse(req.body);
  const existing = await pool.query(`SELECT id FROM users WHERE email = $1`, [input.email]);

  if (existing.rowCount) {
    return res.status(409).json({ error: "User already exists" });
  }

  const role = await pool.query(`SELECT id FROM roles WHERE key = 'viewer'`);
  const user = await pool.query(
    `
      INSERT INTO users (email, password_hash, display_name, primary_role_id)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [input.email, await hashPassword(input.password), input.displayName, role.rows[0].id]
  );

  const sessionUser = await getUserForSession(user.rows[0].id);
  const token = createSessionToken(sessionUser!);

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction
  });

  await logAudit(sessionUser!.id, "auth.register", "user", sessionUser!.id, {
    email: sessionUser!.email
  });

  return res.status(201).json({ user: sessionUser });
});

authRouter.post("/login", async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await pool.query(
    `
      SELECT u.id, u.password_hash
      FROM users u
      WHERE u.email = $1 AND u.is_active = true
    `,
    [input.email]
  );

  if (!user.rowCount || !user.rows[0].password_hash) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const passwordValid = await verifyPassword(input.password, user.rows[0].password_hash);
  if (!passwordValid) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const sessionUser = await getUserForSession(user.rows[0].id);
  const token = createSessionToken(sessionUser!);

  res.cookie(env.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction
  });

  await logAudit(sessionUser!.id, "auth.login", "user", sessionUser!.id);
  return res.json({ user: sessionUser });
});

authRouter.post("/logout", async (_req, res) => {
  res.clearCookie(env.SESSION_COOKIE_NAME);
  return res.status(204).send();
});

authRouter.get("/session", async (req, res) => {
  return res.json({ user: req.user ?? null });
});
