ALTER TABLE branding_settings
ADD COLUMN IF NOT EXISTS footer_links JSONB NOT NULL DEFAULT '[]'::jsonb;
