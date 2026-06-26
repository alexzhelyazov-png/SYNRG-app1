-- ═══════════════════════════════════════════════════════════════
-- Persist earned badge id lists on clients (Created: 2026-06-26)
--
-- Why: the admin is the sole authority for gamification — it computes
-- XP AND badges from every client's raw logs and writes them to the DB.
-- Clients read these values (they don't load other clients' logs). XP was
-- already persisted (xp_monthly/xp_total/xp_level); the earned badge id
-- lists were NOT, so the ranking "profile" dialog showed no badges for the
-- client view. These two columns close that gap so clients can render the
-- same badges the admin sees.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS earned_ids         jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monthly_earned_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN clients.earned_ids         IS 'All-time earned badge ids (admin-written, read by clients for the ranking profile dialog).';
COMMENT ON COLUMN clients.monthly_earned_ids IS 'Current-month earned badge ids (admin-written).';
