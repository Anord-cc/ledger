import { env } from "../config/env.js";
import { pool } from "../db/pool.js";

const FIXED_FOOTER = "Powered by Ledger made by ANord.cc";

export async function getBrandingSettings() {
  const result = await pool.query(`SELECT * FROM branding_settings ORDER BY created_at ASC LIMIT 1`);
  return (
    result.rows[0] ?? {
      id: "default",
      site_name: "Ledger",
      logo_url: null,
      brand_color: "#245cff",
      footer_text: FIXED_FOOTER,
      public_knowledge_base_enabled: true
    }
  );
}

export async function upsertBrandingSettings(input: {
  siteName: string;
  logoUrl: string | null;
  brandColor: string;
  publicKnowledgeBaseEnabled: boolean;
}) {
  const existing = await getBrandingSettings();
  if (existing) {
    const result = await pool.query(
      `
        UPDATE branding_settings
        SET site_name = $2, logo_url = $3, brand_color = $4, footer_text = $5,
            public_knowledge_base_enabled = $6, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [
        existing.id,
        input.siteName,
        input.logoUrl,
        input.brandColor,
        FIXED_FOOTER,
        input.publicKnowledgeBaseEnabled
      ]
    );
    return result.rows[0];
  }

  const created = await pool.query(
    `
      INSERT INTO branding_settings (site_name, logo_url, brand_color, footer_text, public_knowledge_base_enabled)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `,
    [
      input.siteName,
      input.logoUrl,
      input.brandColor,
      FIXED_FOOTER,
      input.publicKnowledgeBaseEnabled
    ]
  );
  return created.rows[0];
}

export async function getAdminSettingsBundle() {
  const branding = await getBrandingSettings();
  const smtp = await pool.query(`SELECT * FROM smtp_settings ORDER BY created_at ASC LIMIT 1`);
  const ai = await pool.query(`SELECT * FROM ai_settings ORDER BY created_at ASC LIMIT 1`);

  return {
    branding,
    smtp: smtp.rows[0],
    ai: ai.rows[0],
    mcp: {
      endpoint: `${env.LEDGER_APP_URL}/mcp`,
      authMode: "session_cookie"
    },
    authProviders: {
      oidc: Boolean(env.OIDC_ISSUER && env.OIDC_CLIENT_ID && env.OIDC_CLIENT_SECRET),
      google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
      discord: Boolean(env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET),
      microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
      slack: Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET)
    }
  };
}
