-- ══════════════════════════════════════════════════════════════
-- SYNRG Module-Based Access Control — Migration
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- Add modules column to clients table
ALTER TABLE clients ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '[]'::jsonb;

-- Backfill: Give all existing non-coach clients the studio preset
-- (they are all current studio clients)
UPDATE clients
SET modules = '["studio_access","booking_access","weight_tracking","nutrition_tracking"]'::jsonb
WHERE is_coach = false
  AND (modules IS NULL OR modules = '[]'::jsonb);

-- Index for future querying by module
CREATE INDEX IF NOT EXISTS idx_clients_modules ON clients USING gin(modules);
