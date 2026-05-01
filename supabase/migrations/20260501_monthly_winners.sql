-- Monthly winners snapshot table.
--
-- Populated by the `monthly-winners` Edge Function on the 1st of each
-- month. The Ranking page reads the latest row to show the previous
-- month's winner under the header ("Победител за Април: X — 505 XP").
--
-- The cron uses INSERT ... ON CONFLICT DO UPDATE so manual re-runs of
-- the function (with `force: true`) overwrite the row instead of
-- duplicating it.

CREATE TABLE IF NOT EXISTS monthly_winners (
  -- "YYYY-MM", e.g. "2026-04". Primary key so each month has exactly
  -- one snapshot row.
  month_key   TEXT        PRIMARY KEY,
  -- Top winner for the month (rank 1). Convenience columns so the UI
  -- doesn't need to parse top10 JSON for the common case.
  winner_name TEXT        NOT NULL,
  winner_xp   INTEGER     NOT NULL,
  -- Full top-10 snapshot as [{ rank, name, xp, badges }]. Used for
  -- richer admin views or future "history" pages.
  top10       JSONB       NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Anyone can read (so client app can show the previous winner banner).
ALTER TABLE monthly_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "monthly_winners read" ON monthly_winners;
CREATE POLICY "monthly_winners read"
  ON monthly_winners
  FOR SELECT
  USING (true);

-- Writes are restricted to the service role (the edge function uses
-- SUPABASE_SERVICE_ROLE_KEY which bypasses RLS).
