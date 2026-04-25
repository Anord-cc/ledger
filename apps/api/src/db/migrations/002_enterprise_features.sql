CREATE TABLE IF NOT EXISTS external_page_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  source_branch TEXT,
  source_path TEXT,
  source_document_id TEXT,
  source_identifier TEXT NOT NULL,
  imported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_synced_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE(page_id),
  UNIQUE(provider, source_identifier)
);

CREATE TABLE IF NOT EXISTS import_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  source_label TEXT NOT NULL,
  space_id UUID REFERENCES spaces(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  imported_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  page_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_count INT NOT NULL DEFAULT 0,
  error_message TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_answer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS success BOOLEAN,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_external_page_sources_page_id
  ON external_page_sources(page_id);

CREATE INDEX IF NOT EXISTS idx_import_jobs_created_at
  ON import_jobs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_answer_logs_created_at
  ON ai_answer_logs(created_at DESC);
