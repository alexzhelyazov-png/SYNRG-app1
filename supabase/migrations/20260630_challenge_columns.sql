-- ═══════════════════════════════════════════════════════════════
-- In-App 7-Day Challenge — evergreen enrollment columns on clients
-- Created: 2026-06-30
--
-- Two nullable columns only. Each freemium user starts their own 7 days
-- the moment they tap "Start" (Day 1 = challenge_started_on). Per-day
-- completion is DERIVED live from real logs (meals/weight/steps), so no
-- per-day table is needed. Non-destructive: trackers stay forever.
--
-- Reuses the proven anon-PATCH path on clients (same as modules / xp_* /
-- synrg_started_at) — no new table, no new RLS surface.
-- ═══════════════════════════════════════════════════════════════

alter table clients add column if not exists challenge_started_on date;
alter table clients add column if not exists challenge_status text;

comment on column clients.challenge_started_on is 'ISO date the user started their evergreen 7-day challenge; NULL = never enrolled.';
comment on column clients.challenge_status is 'null / active / completed / dismissed / converted.';
