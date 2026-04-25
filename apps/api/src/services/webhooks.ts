import crypto from "node:crypto";
import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const connection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});
const queue = new Queue("ledger-jobs", { connection });

export async function enqueueWebhookEvent(
  eventName: string,
  data: Record<string, unknown>,
  options?: {
    actor?: { id: string; name: string; email: string } | null;
    workspaceId?: string | null;
  }
) {
  const webhooks = await pool.query(
    `SELECT id FROM webhooks WHERE is_active = true AND events @> $1::jsonb`,
    [JSON.stringify([eventName])]
  );

  const payload = {
    id: crypto.randomUUID(),
    event: eventName,
    createdAt: new Date().toISOString(),
    workspaceId: options?.workspaceId ?? null,
    actor: options?.actor ?? null,
    data
  };

  for (const row of webhooks.rows) {
    const delivery = await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_name, payload)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [row.id, eventName, JSON.stringify(payload)]
    );

    await queue.add("webhook.deliver", {
      deliveryId: delivery.rows[0].id
    }, {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      }
    });
  }
}
