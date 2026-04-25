import { Queue } from "bullmq";
import Redis from "ioredis";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const connection = new Redis(env.REDIS_URL);
const queue = new Queue("ledger-jobs", { connection });

export async function enqueueWebhookEvent(eventName: string, payload: Record<string, unknown>) {
  const webhooks = await pool.query(
    `SELECT id FROM webhooks WHERE is_active = true AND events @> $1::jsonb`,
    [JSON.stringify([eventName])]
  );

  for (const row of webhooks.rows) {
    const delivery = await pool.query(
      `INSERT INTO webhook_deliveries (webhook_id, event_name, payload)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [row.id, eventName, JSON.stringify(payload)]
    );

    await queue.add("webhook.deliver", {
      deliveryId: delivery.rows[0].id
    });
  }
}
