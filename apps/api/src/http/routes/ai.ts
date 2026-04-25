import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { answerQuestion, getAiSettingsRecord, upsertAiSettings } from "../../services/ai.js";

const aiAnswerSchema = z.object({
  question: z.string().min(3)
});

const aiSettingsSchema = z.object({
  provider: z.enum(["none", "openai_compatible", "anthropic_compatible"]),
  model: z.string(),
  apiKey: z.string().nullable(),
  isEnabled: z.boolean()
});

export const aiRouter = Router();

aiRouter.get("/settings", requireAdmin, async (_req, res) => {
  const settings = await getAiSettingsRecord();
  return res.json({
    settings: settings
      ? {
          provider: settings.provider,
          model: settings.model,
          isEnabled: settings.is_enabled,
          hasApiKey: Boolean(settings.encrypted_api_key)
        }
      : {
          provider: "none",
          model: "",
          isEnabled: false,
          hasApiKey: false
        }
  });
});

aiRouter.put("/settings", requireAdmin, async (req, res) => {
  const input = aiSettingsSchema.parse(req.body);
  const updated = await upsertAiSettings(input);
  return res.json({
    settings: {
      provider: updated.provider,
      model: updated.model,
      isEnabled: updated.is_enabled,
      hasApiKey: Boolean(updated.encrypted_api_key)
    }
  });
});

aiRouter.post("/answers", async (req, res) => {
  const input = aiAnswerSchema.parse(req.body);
  const result = await answerQuestion(input.question, req.user ?? null);
  return res.json(result);
});
