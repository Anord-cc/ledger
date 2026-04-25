import crypto from "node:crypto";

export function signWebhook(secret: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

export function buildSignedWebhookBody(secret: string, timestamp: string, body: string) {
  return signWebhook(secret, `${timestamp}.${body}`);
}
