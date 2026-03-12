-- ============================================================
-- SYNRG APP — Пълна миграция на базата данни
-- Стартирай целия скрипт в Supabase SQL Editor
-- Безопасно за повторно изпълнение (IF NOT EXISTS навсякъде)
-- ============================================================

-- ── 1. Треньори ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coaches (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT  NOT NULL UNIQUE,
  password   TEXT  NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── 2. Клиенти ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id                  UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT    NOT NULL UNIQUE,
  password            TEXT    NOT NULL,
  calorie_target      INTEGER NOT NULL DEFAULT 2000,
  protein_target      INTEGER NOT NULL DEFAULT 140,
  is_coach            BOOLEAN NOT NULL DEFAULT FALSE,
  reminder_settings   JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_is_coach ON clients(is_coach);

-- ── 3. Хранения ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  label      TEXT    NOT NULL,
  grams      NUMERIC NOT NULL DEFAULT 0,
  kcal       NUMERIC NOT NULL DEFAULT 0,
  protein    NUMERIC NOT NULL DEFAULT 0,
  date       DATE    NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meals_client_id ON meals(client_id);
CREATE INDEX IF NOT EXISTS idx_meals_date      ON meals(date);

-- ── 4. Тренировки ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workouts (
  id         UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID  NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date       DATE  NOT NULL,
  coach      TEXT,
  category   TEXT,
  items      JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workouts_client_id ON workouts(client_id);
CREATE INDEX IF NOT EXISTS idx_workouts_date      ON workouts(date);

-- ── 5. Записи на теглото ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS weight_logs (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  date       DATE    NOT NULL,
  weight     NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, date)
);

CREATE INDEX IF NOT EXISTS idx_weight_logs_client_id ON weight_logs(client_id);

-- ── 6. Задачи ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  assigned_by TEXT,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_client_id ON tasks(client_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status    ON tasks(status);

-- ── 7. Коментари към задачи ──────────────────────────────────
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID    NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author     TEXT    NOT NULL,
  text       TEXT    NOT NULL,
  is_coach   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);

-- ── 8. Реакции / съобщения от треньор ───────────────────────
CREATE TABLE IF NOT EXISTS reactions (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    UUID    NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  type         TEXT    NOT NULL,
  message      TEXT    NOT NULL DEFAULT '',
  trainer_name TEXT,
  dismissed    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reactions_client_id ON reactions(client_id);
CREATE INDEX IF NOT EXISTS idx_reactions_dismissed ON reactions(dismissed);

-- ── 9. Известия между треньори ──────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_coach  TEXT NOT NULL,
  client_name TEXT NOT NULL,
  action_type TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ── 10. Планове на клиенти (booking) ────────────────────────
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

-- ── 11. Слотове за записване ─────────────────────────────────
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

-- ── 12. Записвания в слотове ─────────────────────────────────
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


-- ============================================================
-- RLS политики (разрешаващи — анонимен достъп, същото като
-- съществуващите таблици в проекта)
-- ============================================================

ALTER TABLE coaches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workouts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_plans  ENABLE ROW LEVEL SECURITY;
ALTER TABLE booking_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_bookings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='coaches'       AND policyname='allow_all_coaches')       THEN CREATE POLICY allow_all_coaches       ON coaches       FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='clients'       AND policyname='allow_all_clients')       THEN CREATE POLICY allow_all_clients       ON clients       FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='meals'         AND policyname='allow_all_meals')         THEN CREATE POLICY allow_all_meals         ON meals         FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='workouts'      AND policyname='allow_all_workouts')      THEN CREATE POLICY allow_all_workouts      ON workouts      FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='weight_logs'   AND policyname='allow_all_weight_logs')   THEN CREATE POLICY allow_all_weight_logs   ON weight_logs   FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tasks'         AND policyname='allow_all_tasks')         THEN CREATE POLICY allow_all_tasks         ON tasks         FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='task_comments' AND policyname='allow_all_task_comments') THEN CREATE POLICY allow_all_task_comments ON task_comments FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='reactions'     AND policyname='allow_all_reactions')     THEN CREATE POLICY allow_all_reactions     ON reactions     FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='notifications' AND policyname='allow_all_notifications') THEN CREATE POLICY allow_all_notifications ON notifications FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_plans'  AND policyname='allow_all_client_plans')  THEN CREATE POLICY allow_all_client_plans  ON client_plans  FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='booking_slots' AND policyname='allow_all_booking_slots') THEN CREATE POLICY allow_all_booking_slots ON booking_slots FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='slot_bookings' AND policyname='allow_all_slot_bookings') THEN CREATE POLICY allow_all_slot_bookings ON slot_bookings FOR ALL TO anon USING (true) WITH CHECK (true); END IF;
END $$;


-- ============================================================
-- RPC функции (booking)
-- ============================================================

-- ── book_slot: атомарно записване (с ред-лок) ───────────────
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

  -- Слотът трябва да е поне 24 часа напред
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

-- ── cancel_booking: отказ (мин. 2ч предварително) ───────────
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

-- ── admin_book_slot: записване без 24ч ограничение ──────────
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

-- ── admin_cancel_booking: отказ без 2ч прозорец ─────────────
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


-- ============================================================
-- Начални данни — треньори (безопасно при повторно изпълнение)
-- ============================================================
INSERT INTO coaches (name, password) VALUES
  ('АдминАлекс', '1234'),
  ('АдминКари',  '1234'),
  ('Виви',       'vivi'),
  ('Кари',       'kari'),
  ('Алекс',      'alex'),
  ('Ицко',       'icko'),
  ('Елина',      'elina'),
  ('Никола',     'nikola')
ON CONFLICT (name) DO NOTHING;

-- Сенчести клиентски профили за треньорите (self-tracking)
INSERT INTO clients (name, password, calorie_target, protein_target, is_coach) VALUES
  ('АдминАлекс', '1234',  2500, 160, TRUE),
  ('АдминКари',  '1234',  2500, 160, TRUE),
  ('Виви',       'vivi',  2500, 160, TRUE),
  ('Кари',       'kari',  2500, 160, TRUE),
  ('Алекс',      'alex',  2500, 160, TRUE),
  ('Ицко',       'icko',  2500, 160, TRUE),
  ('Елина',      'elina', 2500, 160, TRUE),
  ('Никола',     'nikola',2500, 160, TRUE)
ON CONFLICT (name) DO NOTHING;


-- ============================================================
-- Готово!
-- Таблици: coaches, clients, meals, workouts, weight_logs,
--          tasks, task_comments, reactions, notifications,
--          client_plans, booking_slots, slot_bookings
-- RPC:     book_slot, cancel_booking,
--          admin_book_slot, admin_cancel_booking
-- RLS:     активирано с разрешаваща anon политика
-- ============================================================
