-- ═══════════════════════════════════════════════════════════════
-- Online Program (SYNRG Method) — migration
-- Created: 2026-04-24
-- Purpose: 12-week program infrastructure for online clients
--   - Week-by-week unlocking
--   - Workouts with boomerang exercise clips
--   - Per-client progress tracking
--   - Auto-start on quiz completion
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Exercise library (shared across all workouts)
--    One row per unique exercise (e.g. "Squat", "Pushup").
--    clip_url points to the seamless boomerang loop (mp4/webm).
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_library (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text UNIQUE NOT NULL,            -- 'squat', 'pushup'
  name_bg      text NOT NULL,
  name_en      text,
  description  text,                             -- how-to / cues
  clip_url     text,                             -- boomerang loop src
  thumb_url    text,
  default_reps int,                              -- suggested reps
  default_sec  int,                              -- suggested duration
  tags         text[] DEFAULT '{}',              -- ['lower','warmup']
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exercise_library_slug ON exercise_library(slug);

-- ───────────────────────────────────────────────────────────────
-- 2. Program weeks (the 12 weeks of the SYNRG method)
--    Fixed catalog; one row per week number.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_weeks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_number     int  UNIQUE NOT NULL CHECK (week_number BETWEEN 1 AND 52),
  title_bg        text NOT NULL,
  title_en        text,
  subtitle_bg     text,
  hero_image_url  text,
  intro_text      text,                          -- markdown / plain
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_weeks_number ON program_weeks(week_number);

-- ───────────────────────────────────────────────────────────────
-- 3. Program workouts (N workouts per week)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_workouts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id       uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  position      int  NOT NULL DEFAULT 0,         -- order within the week
  title_bg      text NOT NULL,
  title_en      text,
  workout_type  text DEFAULT 'main'              -- 'warmup'|'main'|'cooldown'|'mobility'
               CHECK (workout_type IN ('warmup','main','cooldown','mobility')),
  time_cap_sec  int,                              -- e.g. 480 = 8 min
  rounds        int DEFAULT 1,                    -- e.g. "3 rounds"
  overview_text text,                              -- collapsible HOW TO / OVERVIEW
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_workouts_week
  ON program_workouts(week_id, position);

-- ───────────────────────────────────────────────────────────────
-- 4. Workout <-> exercise join (ordered list of exercises per workout)
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_workout_exercises (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id      uuid NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
  exercise_id     uuid NOT NULL REFERENCES exercise_library(id),
  position        int  NOT NULL DEFAULT 0,
  reps            int,                            -- override default_reps
  seconds         int,                            -- override default_sec
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwe_workout
  ON program_workout_exercises(workout_id, position);

-- ───────────────────────────────────────────────────────────────
-- 5. Weekly tasks (non-workout checklist items per week:
--    e.g. "Log nutrition", "Weigh in", "Read week intro")
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS program_weekly_tasks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_id      uuid NOT NULL REFERENCES program_weeks(id) ON DELETE CASCADE,
  position     int  NOT NULL DEFAULT 0,
  title_bg     text NOT NULL,
  description  text,
  task_type    text DEFAULT 'generic'            -- 'generic'|'nutrition'|'weight'|'read'
               CHECK (task_type IN ('generic','nutrition','weight','read','measurement')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pwt_week
  ON program_weekly_tasks(week_id, position);

-- ───────────────────────────────────────────────────────────────
-- 6. Per-client program state (one row per client)
--    Program starts immediately after quiz completion (started_at = now()).
--    current_week is derived from started_at + week cadence but cached here
--    for fast reads; also lets admin manually advance/rewind a client.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_program_state (
  client_id      uuid PRIMARY KEY REFERENCES clients(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  current_week   int  NOT NULL DEFAULT 1 CHECK (current_week BETWEEN 1 AND 52),
  paused         boolean NOT NULL DEFAULT false,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────
-- 7. Per-client workout completion log
--    One row per (client, workout, date) — lets clients repeat workouts.
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_workout_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  workout_id     uuid NOT NULL REFERENCES program_workouts(id) ON DELETE CASCADE,
  started_at     timestamptz NOT NULL DEFAULT now(),
  completed_at   timestamptz,
  duration_sec   int,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cwc_client
  ON client_workout_completions(client_id, completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_cwc_workout
  ON client_workout_completions(workout_id);

-- ───────────────────────────────────────────────────────────────
-- 8. Per-client weekly-task completion
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_weekly_task_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  task_id      uuid NOT NULL REFERENCES program_weekly_tasks(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_cwtc_client
  ON client_weekly_task_completions(client_id);

-- ───────────────────────────────────────────────────────────────
-- 9. RLS policies — anon access (app uses publishable key)
-- ───────────────────────────────────────────────────────────────
ALTER TABLE exercise_library               ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weeks                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_workouts               ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_workout_exercises      ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_weekly_tasks           ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_program_state           ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_workout_completions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_weekly_task_completions ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'exercise_library','program_weeks','program_workouts',
    'program_workout_exercises','program_weekly_tasks',
    'client_program_state','client_workout_completions',
    'client_weekly_task_completions'
  ]) LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s_all_anon" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "%s_all_anon" ON %I FOR ALL TO anon USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;

-- ───────────────────────────────────────────────────────────────
-- 10. Seed the 12 weeks with placeholder titles
--     (Admin will fill real content via AdminProgramContentTab)
-- ───────────────────────────────────────────────────────────────
INSERT INTO program_weeks (week_number, title_bg, subtitle_bg)
VALUES
  (1,  'Седмица 1',  'Основа'),
  (2,  'Седмица 2',  'Основа'),
  (3,  'Седмица 3',  'Основа'),
  (4,  'Седмица 4',  'Прогрес'),
  (5,  'Седмица 5',  'Прогрес'),
  (6,  'Седмица 6',  'Прогрес'),
  (7,  'Седмица 7',  'Сила'),
  (8,  'Седмица 8',  'Сила'),
  (9,  'Седмица 9',  'Сила'),
  (10, 'Седмица 10', 'Пик'),
  (11, 'Седмица 11', 'Пик'),
  (12, 'Седмица 12', 'Завършване')
ON CONFLICT (week_number) DO NOTHING;
