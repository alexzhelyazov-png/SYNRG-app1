-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Migration: Resources (bonus videos for program buyers)      ║
-- ╚════════════════════════════════════════════════════════════════╝

CREATE TABLE IF NOT EXISTS resources (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bg         TEXT NOT NULL,
  name_en         TEXT NOT NULL DEFAULT '',
  description_bg  TEXT NOT NULL DEFAULT '',
  description_en  TEXT NOT NULL DEFAULT '',
  video_url       TEXT NOT NULL DEFAULT '',
  thumbnail_url   TEXT NOT NULL DEFAULT '',
  category_bg     TEXT NOT NULL DEFAULT '',
  category_en     TEXT NOT NULL DEFAULT '',
  duration_min    INTEGER NOT NULL DEFAULT 0,
  display_order   INTEGER NOT NULL DEFAULT 0,
  status          TEXT NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Permissive RLS (anon access)
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_resources" ON resources;
CREATE POLICY "anon_resources" ON resources FOR ALL USING (true) WITH CHECK (true);
