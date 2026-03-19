-- ╔════════════════════════════════════════════════════════════════╗
-- ║  Migration: Program Purchases + Price Columns                ║
-- ╚════════════════════════════════════════════════════════════════╝

-- 1) Add price columns to programs table (admin UI already uses these)
ALTER TABLE programs ADD COLUMN IF NOT EXISTS price_cents    INTEGER NOT NULL DEFAULT 0;
ALTER TABLE programs ADD COLUMN IF NOT EXISTS currency       TEXT NOT NULL DEFAULT 'BGN';
ALTER TABLE programs ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;

-- 2) Program purchases — tracks who bought what
CREATE TABLE IF NOT EXISTS program_purchases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  program_id        UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  stripe_session_id TEXT,
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  currency          TEXT NOT NULL DEFAULT 'BGN',
  status            TEXT NOT NULL DEFAULT 'active',  -- active | refunded
  purchased_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(client_id, program_id)
);

-- Permissive RLS (anon access like other tables)
ALTER TABLE program_purchases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_program_purchases" ON program_purchases;
CREATE POLICY "anon_program_purchases" ON program_purchases FOR ALL USING (true) WITH CHECK (true);
