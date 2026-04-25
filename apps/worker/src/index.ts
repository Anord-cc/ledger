import "dotenv/config";
import { Worker } from "bullmq";
import Redis from "ioredis";

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");

const worker = new Worker(
  "ledger-jobs",
  async (job) => {
    if (job.name === "webhook.deliver") {
      console.log(`processing webhook delivery ${job.id}`);
      return { delivered: true };
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
