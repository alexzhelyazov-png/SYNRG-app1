-- Add expenses table for tracking studio costs
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS expenses (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category   TEXT        NOT NULL,
  amount     INTEGER     NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE expenses IS 'Studio operating expenses (electricity, rent, salaries, etc.)';
