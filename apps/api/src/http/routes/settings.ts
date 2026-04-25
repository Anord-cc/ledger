import { Router } from "express";
import { z } from "zod";
import { requireAdmin } from "../middleware/auth.js";
import { getAdminSettingsBundle, getBrandingSettings, upsertBrandingSettings } from "../../services/settings.js";
import { logAudit } from "../../services/audit.js";

const brandingSchema = z.object({
  siteName: z.string().min(2),
  logoUrl: z.string().url().nullable(),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  publicKnowledgeBaseEnabled: z.boolean()
});

export const settingsRouter = Router();

settingsRouter.get("/public", async (_req, res) => {
  const branding = await getBrandingSettings();
  return res.json({
    branding: {
      siteName: branding.site_name,
      logoUrl: branding.logo_url,
      brandColor: branding.brand_color,
      publicKnowledgeBaseEnabled: branding.public_knowledge_base_enabled
    }
  });
});

settingsRouter.get("/admin", requireAdmin, async (_req, res) => {
  const settings = await getAdminSettingsBundle();
  return res.json(settings);
});

settingsRouter.put("/branding", requireAdmin, async (req, res) => {
  const input = brandingSchema.parse(req.body);
  const updated = await upsertBrandingSettings(input);
  await logAudit(req.user!.id, "settings.branding.update", "branding_settings", updated.id);
  return res.json(updated);
});
