import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SessionUser } from "@ledger/shared";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(`${password}${env.PASSWORD_PEPPER}`, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(`${password}${env.PASSWORD_PEPPER}`, hash);
}

export function createSessionToken(user: SessionUser): string {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifySessionToken(token: string): SessionUser {
  return jwt.verify(token, env.JWT_SECRET) as SessionUser;
}

export async function getUserForSession(userId: string): Promise<SessionUser | null> {
  const result = await pool.query(
    `
      SELECT
        u.id,
        u.email,
        u.display_name,
        r.key AS role_key,
        COALESCE(array_agg(gm.group_id) FILTER (WHERE gm.group_id IS NOT NULL), '{}') AS group_ids
      FROM users u
      JOIN roles r ON r.id = u.primary_role_id
      LEFT JOIN group_memberships gm ON gm.user_id = u.id
      WHERE u.id = $1 AND u.is_active = true
      GROUP BY u.id, r.key
    `,
    [userId]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role_key,
    groupIds: row.group_ids
  };
}

