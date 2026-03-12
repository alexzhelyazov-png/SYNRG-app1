-- Add price column to client_plans table
-- Run this in Supabase SQL Editor

ALTER TABLE client_plans
  ADD COLUMN IF NOT EXISTS price INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN client_plans.price IS 'Fee paid by the client for this plan (in BGN). 0 = free.';
