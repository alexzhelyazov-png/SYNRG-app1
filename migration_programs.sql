-- ══════════════════════════════════════════════════════════════
-- SYNRG Online Programs — Database Migration
-- Run this in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Programs (top-level)
CREATE TABLE IF NOT EXISTS programs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_bg     TEXT NOT NULL DEFAULT '',
  name_en     TEXT NOT NULL DEFAULT '',
  description_bg TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  cover_url   TEXT DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'active',
  display_order INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON programs;
CREATE POLICY anon_all ON programs FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2. Program modules (sections/chapters within a program)
CREATE TABLE IF NOT EXISTS program_modules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name_bg     TEXT NOT NULL DEFAULT '',
  name_en     TEXT NOT NULL DEFAULT '',
  description_bg TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  display_order INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE program_modules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON program_modules;
CREATE POLICY anon_all ON program_modules FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_program_modules_program ON program_modules(program_id, display_order);

-- 3. Program lessons (individual video lessons)
CREATE TABLE IF NOT EXISTS program_lessons (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id   UUID NOT NULL REFERENCES program_modules(id) ON DELETE CASCADE,
  program_id  UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name_bg     TEXT NOT NULL DEFAULT '',
  name_en     TEXT NOT NULL DEFAULT '',
  description_bg TEXT NOT NULL DEFAULT '',
  description_en TEXT NOT NULL DEFAULT '',
  video_url   TEXT DEFAULT '',
  thumbnail_url TEXT DEFAULT '',
  duration_min INT NOT NULL DEFAULT 0,
  is_free_preview BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE program_lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON program_lessons;
CREATE POLICY anon_all ON program_lessons FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_program_lessons_module ON program_lessons(module_id, display_order);
CREATE INDEX IF NOT EXISTS idx_program_lessons_program ON program_lessons(program_id);

-- 4. Client lesson progress (completion tracking)
CREATE TABLE IF NOT EXISTS client_lesson_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL,
  lesson_id   UUID NOT NULL REFERENCES program_lessons(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, lesson_id)
);

ALTER TABLE client_lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS anon_all ON client_lesson_progress;
CREATE POLICY anon_all ON client_lesson_progress FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_progress_client ON client_lesson_progress(client_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON client_lesson_progress(lesson_id);
