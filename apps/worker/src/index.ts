import "dotenv/config";
import crypto from "node:crypto";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { Pool } from "pg";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null
});
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://ledger:ledger@localhost:5432/ledger"
});

function buildSignedWebhookBody(secret: string, timestamp: string, body: string) {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

async function deliverWebhook(deliveryId: string) {
  const delivery = await pool.query(
    `
      SELECT
        wd.id,
        wd.event_name,
        wd.payload,
        wd.attempt_count,
        w.target_url,
        w.signing_secret,
        w.is_active
      FROM webhook_deliveries wd
      JOIN webhooks w ON w.id = wd.webhook_id
      WHERE wd.id = $1
    `,
    [deliveryId]
  );

  if (!delivery.rowCount) {
    return { ignored: true };
  }

  const row = delivery.rows[0];
  if (!row.is_active) {
    return { skipped: true };
  }

  const payload = JSON.stringify(row.payload);
  const timestamp = new Date().toISOString();
  const signature = buildSignedWebhookBody(row.signing_secret, timestamp, payload);

  try {
    const response = await fetch(row.target_url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ledger-Event": row.event_name,
        "X-Ledger-Timestamp": timestamp,
        "X-Ledger-Signature": signature
      },
      body: payload
    });

    const responseBody = await response.text();
    await pool.query(
      `
        UPDATE webhook_deliveries
        SET response_status = $2,
            response_body = $3,
            success = $4,
            delivered_at = now(),
            error_message = NULL,
            attempt_count = $5
        WHERE id = $1
      `,
      [deliveryId, response.status, responseBody.slice(0, 5000), response.ok, Number(row.attempt_count ?? 0) + 1]
    );

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`);
    }

    return { delivered: true };
  } catch (error) {
    await pool.query(
      `
        UPDATE webhook_deliveries
        SET success = false,
            error_message = $2,
            delivered_at = now(),
            attempt_count = $3
        WHERE id = $1
      `,
      [deliveryId, error instanceof Error ? error.message : "Delivery failed", Number(row.attempt_count ?? 0) + 1]
    );
    throw error;
  }
}

const worker = new Worker(
  "ledger-jobs",
  async (job) => {
    if (job.name === "webhook.deliver") {
      console.log(`processing webhook delivery ${job.id}`);
      return deliverWebhook(String(job.data.deliveryId));
    }

    if (job.name === "analytics.rollup") {
      console.log(`processing analytics rollup ${job.id}`);
      return { rolledUp: true };
    }

    return { ignored: true };
  },
  { connection }
);

worker.on("completed", (job) => {
  console.log(`job completed: ${job.name}:${job.id}`);
});

worker.on("failed", (job, error) => {
  console.error(`job failed: ${job?.name}:${job?.id}`, error);
});

console.log("Ledger worker started");
