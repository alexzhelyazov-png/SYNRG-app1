-- Refund tracking for client_plans, so a partial refund nets out of revenue
-- instead of the admin having to hard-delete the client (which erased the
-- whole payment history, including the portion of cash legitimately kept).
alter table client_plans
  add column if not exists refund_amount integer not null default 0,
  add column if not exists refunded_at timestamptz;

-- 'refunded' is a terminal status alongside the existing ones (plan stops
-- granting access, same as 'expired', but is distinguishable in Finance and
-- in the admin UI).
alter table client_plans drop constraint if exists client_plans_status_check;
alter table client_plans add constraint client_plans_status_check
  check (status = ANY (ARRAY['active'::text, 'expired'::text, 'paused'::text, 'inactive'::text, 'refunded'::text]));
