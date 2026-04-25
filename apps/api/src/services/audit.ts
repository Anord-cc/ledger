import { pool } from "../db/pool.js";

export async function logAudit(
  actorUserId: string | null,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown> = {}
) {
  await pool.query(
    `INSERT INTO audit_logs (actor_user_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5)`,
    [actorUserId, action, resourceType, resourceId, JSON.stringify(metadata)]
  );
}

