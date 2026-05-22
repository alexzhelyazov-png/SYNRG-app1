-- Archive flag for clients who stopped showing up but should remain in DB
-- (history, meals, weights kept; just hidden from active dashboard lists).
-- Used by admin DashboardTab to keep "Чакащи активиране" focused on
-- actionable churned clients vs. long-gone ones.

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_clients_is_archived
  ON clients (is_archived)
  WHERE is_archived = TRUE;

COMMENT ON COLUMN clients.is_archived IS
  'Soft-archive flag. Archived clients are hidden from admin dashboard lists (new regs, pending, expiring, low credits) but kept in DB for history.';
