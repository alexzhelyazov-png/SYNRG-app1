-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Migration: Resource Steps + Progress Tracking               ║
-- ╚════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS resource_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id     UUID NOT NULL REFERENCES resources(id) ON DELETE CASCADE,
  name_bg         TEXT NOT NULL,
  name_en         TEXT NOT NULL DEFAULT '',
  description_bg  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  video_url       TEXT NOT NULL DEFAULT '',
  thumbnail_url   TEXT NOT NULL DEFAULT '',
  duration_min    INTEGER NOT NULL DEFAULT 0,
  display_order   INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resource_step_progress (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       UUID NOT NULL,
  step_id         UUID NOT NULL REFERENCES resource_steps(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, step_id)
);

-- Permissive RLS
ALTER TABLE resource_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_resource_steps" ON resource_steps;
CREATE POLICY "anon_resource_steps" ON resource_steps FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE resource_step_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_resource_step_progress" ON resource_step_progress;
CREATE POLICY "anon_resource_step_progress" ON resource_step_progress FOR ALL USING (true) WITH CHECK (true);
