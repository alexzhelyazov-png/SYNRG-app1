-- Water tracker: daily hydration logs + per-client daily target
-- One row per client per day; ml is the cumulative total for that date.
-- Mirrors steps_logs (open anon RLS — writes happen client-side via anon key).

create table if not exists public.water_logs (
  id         bigint generated always as identity primary key,
  client_id  uuid not null references public.clients(id) on delete cascade,
  date       text not null,               -- 'DD.MM.YYYY' to match steps_logs/meals
  ml         integer not null default 0,  -- cumulative ml for the day
  created_at timestamptz not null default now(),
  unique (client_id, date)
);

-- Per-client editable daily target (default 2.5 L)
alter table public.clients
  add column if not exists water_target_ml integer not null default 2500;

alter table public.water_logs enable row level security;

drop policy if exists water_logs_anon on public.water_logs;
create policy water_logs_anon on public.water_logs
  for all to public using (true) with check (true);
