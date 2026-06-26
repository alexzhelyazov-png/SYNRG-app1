-- ═══════════════════════════════════════════════════════════════
-- SYNRG 7-day Challenge — signup infrastructure (Phase 1: warm only)
-- Created: 2026-06-24
--
-- Adds two NEW tables only. Touches nothing existing — studio/online
-- clients are unaffected. Writes happen ONLY through the service-role
-- edge function `signup-challenge`; anon (the app's publishable key) may
-- only SELECT, so the admin list can read but the public cannot insert
-- directly (spam/dupe protection lives in the edge function).
--
-- Weekly cohorts. The FIRST cohort starts Mon 2026-06-29. The cohort
-- weekday is configured in ensure_upcoming_cohort() (ISODOW 1 = Monday).
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────
-- 1. Cohorts — one row per weekly group
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cohorts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  start_date  date NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'upcoming'
              CHECK (status IN ('upcoming','active','done')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cohorts_status ON cohorts(status, start_date);

-- ───────────────────────────────────────────────────────────────
-- 2. Challenge signups — one row per (email, cohort)
--    profile_id is nullable so Phase 2 (cold users, created later) can
--    reuse the same table; in Phase 1 it is always set (warm only).
-- ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS challenge_signups (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  uuid REFERENCES clients(id) ON DELETE SET NULL,
  cohort_id   uuid REFERENCES cohorts(id) ON DELETE SET NULL,
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  committed   boolean NOT NULL DEFAULT false,
  consent     boolean NOT NULL DEFAULT false,   -- GDPR data-processing consent
  source      text NOT NULL DEFAULT 'warm'
              CHECK (source IN ('warm','cold')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- No duplicate signups for the same email within a cohort.
  UNIQUE (email, cohort_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_signups_cohort  ON challenge_signups(cohort_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_signups_email   ON challenge_signups(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_challenge_signups_profile ON challenge_signups(profile_id);

-- ───────────────────────────────────────────────────────────────
-- 3. RLS — anon may only SELECT (admin list). All writes go through
--    the service-role edge function, which bypasses RLS.
-- ───────────────────────────────────────────────────────────────
ALTER TABLE cohorts           ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_signups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cohorts_select_anon" ON cohorts;
CREATE POLICY "cohorts_select_anon" ON cohorts
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "challenge_signups_select_anon" ON challenge_signups;
CREATE POLICY "challenge_signups_select_anon" ON challenge_signups
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.cohorts           TO anon, authenticated;
GRANT SELECT ON public.challenge_signups TO anon, authenticated;

-- ───────────────────────────────────────────────────────────────
-- 4. ensure_upcoming_cohort() — always returns an id for the next
--    upcoming cohort, creating it if missing. Called by the edge fn on
--    every signup, so a target cohort is guaranteed without a cron.
--    Cohort weekday: ISODOW 1 = Monday (change here to move the day).
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ensure_upcoming_cohort()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    uuid;
  v_start date;
BEGIN
  SELECT id INTO v_id
    FROM cohorts
   WHERE status = 'upcoming' AND start_date >= current_date
   ORDER BY start_date ASC
   LIMIT 1;

  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- next Monday (today if today is Monday)
  v_start := current_date + ((1 - EXTRACT(ISODOW FROM current_date)::int + 7) % 7);

  INSERT INTO cohorts (start_date, status)
  VALUES (v_start, 'upcoming')
  ON CONFLICT (start_date) DO UPDATE SET status = 'upcoming'
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ───────────────────────────────────────────────────────────────
-- 5. roll_cohorts() — for a weekly pg_cron job: flips statuses and
--    guarantees a fresh upcoming cohort. The edge fn also self-heals,
--    so this is housekeeping, not a hard dependency.
-- ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION roll_cohorts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE cohorts SET status = 'active'
   WHERE status = 'upcoming' AND start_date <= current_date;

  UPDATE cohorts SET status = 'done'
   WHERE status = 'active' AND start_date < current_date - 7;

  PERFORM ensure_upcoming_cohort();
END;
$$;

-- Allow the app's keys to invoke ensure_upcoming_cohort via PostgREST RPC
-- (the edge fn uses the service role, but this keeps RPC usable if needed).
GRANT EXECUTE ON FUNCTION ensure_upcoming_cohort() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION roll_cohorts()           TO service_role;

-- ───────────────────────────────────────────────────────────────
-- 6. Seed the first cohort: Monday 2026-06-29
-- ───────────────────────────────────────────────────────────────
INSERT INTO cohorts (start_date, status)
VALUES ('2026-06-29', 'upcoming')
ON CONFLICT (start_date) DO NOTHING;

COMMENT ON TABLE cohorts IS 'Weekly SYNRG challenge groups; one upcoming guaranteed by ensure_upcoming_cohort().';
COMMENT ON TABLE challenge_signups IS 'Signups for the 7-day challenge. Phase 1 = warm (profile_id always set, source=warm).';
