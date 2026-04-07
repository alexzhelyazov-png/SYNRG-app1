-- ============================================================
-- SYNRG BOOKING SYSTEM — Database Migration
-- Run this entire script in Supabase SQL Editor
-- ============================================================

-- ── 1. Client Plans ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS client_plans (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  plan_type     TEXT        NOT NULL CHECK (plan_type IN ('8', '12', 'unlimited')),
  credits_total INTEGER,
  credits_used  INTEGER     NOT NULL DEFAULT 0,
  valid_from    DATE        NOT NULL,
  valid_to      DATE        NOT NULL,
  extended_to   DATE,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'expired', 'paused', 'inactive')),
  activated_by  TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_client_plans_client_id ON client_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_client_plans_status    ON client_plans(status);

-- ── 2. Booking Slots ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS booking_slots (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date   DATE        NOT NULL,
  start_time  TIME        NOT NULL,
  end_time    TIME        NOT NULL,
  coach_id    UUID        REFERENCES coaches(id) ON DELETE SET NULL,
  coach_name  TEXT        NOT NULL,
  capacity    INTEGER     NOT NULL DEFAULT 3 CHECK (capacity BETWEEN 1 AND 30),
  notes       TEXT,
  status      TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_slots_date   ON booking_slots(slot_date);
CREATE INDEX IF NOT EXISTS idx_booking_slots_status ON booking_slots(status);
CREATE INDEX IF NOT EXISTS idx_booking_slots_coach  ON booking_slots(coach_id);

-- ── 3. Slot Bookings ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS slot_bookings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id      UUID        NOT NULL REFERENCES booking_slots(id) ON DELETE CASCADE,
  client_id    UUID        NOT NULL REFERENCES clients(id)        ON DELETE CASCADE,
  client_name  TEXT        NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  credit_used  BOOLEAN     NOT NULL DEFAULT FALSE,
  booked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE (slot_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_slot_bookings_slot_id   ON slot_bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_slot_bookings_client_id ON slot_bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_slot_bookings_status    ON slot_bookings(status);

-- ── 4. RLS (permissive — same pattern as existing tables) ───
ALTER TABLE client_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_plans'  AND policyname='allow_all_client_plans')  THEN
    CREATE POLICY allow_all_client_plans  ON client_plans  FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_slots' AND policyname='allow_all_booking_slots') THEN
    CREATE POLICY allow_all_booking_slots ON booking_slots FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slot_bookings' AND policyname='allow_all_slot_bookings') THEN
    CREATE POLICY allow_all_slot_bookings ON slot_bookings FOR ALL TO anon USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 5. RPC: book_slot (atomic — uses row lock to prevent races)
CREATE OR REPLACE FUNCTION book_slot(
  p_slot_id     UUID,
  p_client_id   UUID,
  p_client_name TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot         RECORD;
  v_plan         RECORD;
  v_booked_count INTEGER;
  v_eff_valid_to DATE;
  v_credit_used  BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_slot FROM booking_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Слотът не е намерен');
  END IF;

  IF v_slot.status = 'cancelled' THEN
    RETURN jsonb_build_object('error', 'Слотът е отменен');
  END IF;

  -- Slot must be at least 24h in the future
  IF (v_slot.slot_date + v_slot.start_time) <= (NOW() AT TIME ZONE 'UTC') + INTERVAL '24 hours' THEN
    RETURN jsonb_build_object('error', 'Записването е възможно до 24 часа предварително');
  END IF;

  SELECT COUNT(*) INTO v_booked_count
    FROM slot_bookings WHERE slot_id = p_slot_id AND status = 'active';
  IF v_booked_count >= v_slot.capacity THEN
    RETURN jsonb_build_object('error', 'Този час вече е запълнен');
  END IF;

  IF EXISTS (SELECT 1 FROM slot_bookings
    WHERE slot_id = p_slot_id AND client_id = p_client_id AND status = 'active') THEN
    RETURN jsonb_build_object('error', 'Вече сте записани за този час');
  END IF;

  SELECT * INTO v_plan FROM client_plans
    WHERE client_id = p_client_id AND status = 'active'
    ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Нямате активен план');
  END IF;

  v_eff_valid_to := COALESCE(v_plan.extended_to, v_plan.valid_to);
  IF CURRENT_DATE > v_eff_valid_to THEN
    RETURN jsonb_build_object('error', 'Вашият план е изтекъл');
  END IF;

  -- Slot must fall within the active plan period — can't book past plan expiry
  IF v_slot.slot_date > v_eff_valid_to THEN
    RETURN jsonb_build_object('error', 'Часът е след края на плана ви');
  END IF;

  IF v_plan.plan_type IN ('8', '12') THEN
    IF v_plan.credits_used >= v_plan.credits_total THEN
      RETURN jsonb_build_object('error', 'Нямате оставащи кредити');
    END IF;
    v_credit_used := TRUE;
    UPDATE client_plans SET credits_used = credits_used + 1, updated_at = NOW()
      WHERE id = v_plan.id;
  END IF;

  INSERT INTO slot_bookings (slot_id, client_id, client_name, credit_used)
    VALUES (p_slot_id, p_client_id, p_client_name, v_credit_used);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 6. RPC: cancel_booking ──────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_booking(
  p_slot_id   UUID,
  p_client_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot    RECORD;
  v_booking RECORD;
  v_plan    RECORD;
BEGIN
  SELECT * INTO v_slot FROM booking_slots WHERE id = p_slot_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Слотът не е намерен');
  END IF;

  SELECT * INTO v_booking FROM slot_bookings
    WHERE slot_id = p_slot_id AND client_id = p_client_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Не сте записани за този час');
  END IF;

  -- Must cancel at least 2h before start
  IF (v_slot.slot_date + v_slot.start_time) <= (NOW() AT TIME ZONE 'UTC') + INTERVAL '2 hours' THEN
    RETURN jsonb_build_object('error', 'Отказването е възможно до 2 часа предварително');
  END IF;

  UPDATE slot_bookings SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_booking.id;

  IF v_booking.credit_used THEN
    SELECT * INTO v_plan FROM client_plans
      WHERE client_id = p_client_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_plan.credits_used > 0 THEN
      UPDATE client_plans SET credits_used = credits_used - 1, updated_at = NOW()
        WHERE id = v_plan.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 7. RPC: admin_book_slot (no 24h restriction) ────────────
CREATE OR REPLACE FUNCTION admin_book_slot(
  p_slot_id     UUID,
  p_client_id   UUID,
  p_client_name TEXT,
  p_use_credit  BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot         RECORD;
  v_plan         RECORD;
  v_booked_count INTEGER;
  v_credit_used  BOOLEAN := FALSE;
BEGIN
  SELECT * INTO v_slot FROM booking_slots WHERE id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Слотът не е намерен'); END IF;
  IF v_slot.status = 'cancelled' THEN RETURN jsonb_build_object('error', 'Слотът е отменен'); END IF;

  SELECT COUNT(*) INTO v_booked_count
    FROM slot_bookings WHERE slot_id = p_slot_id AND status = 'active';
  IF v_booked_count >= v_slot.capacity THEN
    RETURN jsonb_build_object('error', 'Слотът е запълнен');
  END IF;

  IF EXISTS (SELECT 1 FROM slot_bookings
    WHERE slot_id = p_slot_id AND client_id = p_client_id AND status = 'active') THEN
    RETURN jsonb_build_object('error', 'Клиентът вече е записан');
  END IF;

  IF p_use_credit THEN
    SELECT * INTO v_plan FROM client_plans
      WHERE client_id = p_client_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_plan.plan_type IN ('8','12') AND v_plan.credits_used < v_plan.credits_total THEN
      v_credit_used := TRUE;
      UPDATE client_plans SET credits_used = credits_used + 1, updated_at = NOW() WHERE id = v_plan.id;
    END IF;
  END IF;

  INSERT INTO slot_bookings (slot_id, client_id, client_name, credit_used)
    VALUES (p_slot_id, p_client_id, p_client_name, v_credit_used);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── 8. RPC: admin_cancel_booking (no 2h window check) ───────
CREATE OR REPLACE FUNCTION admin_cancel_booking(
  p_slot_id       UUID,
  p_client_id     UUID,
  p_return_credit BOOLEAN DEFAULT TRUE
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_booking RECORD;
  v_plan    RECORD;
BEGIN
  SELECT * INTO v_booking FROM slot_bookings
    WHERE slot_id = p_slot_id AND client_id = p_client_id AND status = 'active';
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Клиентът не е записан за този час');
  END IF;

  UPDATE slot_bookings SET status = 'cancelled', cancelled_at = NOW()
    WHERE id = v_booking.id;

  IF p_return_credit AND v_booking.credit_used THEN
    SELECT * INTO v_plan FROM client_plans
      WHERE client_id = p_client_id AND status = 'active'
      ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND v_plan.credits_used > 0 THEN
      UPDATE client_plans SET credits_used = credits_used - 1, updated_at = NOW()
        WHERE id = v_plan.id;
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ── Done ──────────────────────────────────────────────────────
-- After running this migration:
-- 1. Tables created: client_plans, booking_slots, slot_bookings
-- 2. RPC functions: book_slot, cancel_booking, admin_book_slot, admin_cancel_booking
-- 3. RLS enabled with permissive anon policies (same as existing tables)

-- ── Admin Coaches — run this separately in Supabase SQL Editor ─
-- Adds АдминАлекс and АдминКари as admin coach accounts.
-- These are separate from the regular Алекс/Кари coach profiles.
INSERT INTO coaches (name, password)
VALUES
  ('АдминАлекс', '1234'),
  ('АдминКари',  '1234')
ON CONFLICT DO NOTHING;
