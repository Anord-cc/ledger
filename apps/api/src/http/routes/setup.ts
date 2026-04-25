import { Router } from "express";
import { z } from "zod";
import { env, isProduction } from "../../config/env.js";
import { initializeLedger, getSetupStatus } from "../../services/setup.js";

const setupSchema = z.object({
  siteName: z.string().min(2),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  footerText: z.string().max(200).nullable(),
  publicKnowledgeBaseEnabled: z.boolean(),
  ownerEmail: z.string().email(),
  ownerDisplayName: z.string().min(2),
  password: z.string().min(8)
});

export const setupRouter = Router();

setupRouter.get("/status", async (_req, res) => {
  const status = await getSetupStatus();
  return res.json(status);
});

setupRouter.post("/initialize", async (req, res) => {
  const input = setupSchema.parse(req.body);
  const result = await initializeLedger(input);

  res.cookie(env.SESSION_COOKIE_NAME, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction
  });

  return res.status(201).json({ user: result.user });
});
