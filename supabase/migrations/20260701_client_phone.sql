-- Collect a phone number when a user starts the in-app challenge.
-- Nullable and additive: existing rows and non-challenge users are unaffected.
alter table clients add column if not exists phone text;
