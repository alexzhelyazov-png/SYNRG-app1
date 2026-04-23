-- ═══════════════════════════════════════════════════════════════
-- Coach Chat System — migration
-- Created: 2026-04-23
-- Purpose: Add coach-client messaging for SYNRG Метод online clients
-- ═══════════════════════════════════════════════════════════════

-- 1. Add assigned coach reference to clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS assigned_coach_id uuid REFERENCES coaches(id);

-- 2. Coach messages table
CREATE TABLE IF NOT EXISTS coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  coach_id uuid NOT NULL REFERENCES coaches(id),
  sender_role text NOT NULL CHECK (sender_role IN ('client','coach','admin')),
  sender_name text,
  text text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_coach_messages_client
  ON coach_messages(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coach_messages_coach_unread
  ON coach_messages(coach_id, read_at)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clients_assigned_coach
  ON clients(assigned_coach_id)
  WHERE assigned_coach_id IS NOT NULL;

-- 4. RLS policies (allow anon — the app uses publishable key)
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coach_messages_all_anon" ON coach_messages;
CREATE POLICY "coach_messages_all_anon"
  ON coach_messages FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);
