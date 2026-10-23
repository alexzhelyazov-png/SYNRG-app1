-- Monthly P&L reporting: replaces the 5-year manual spreadsheet.
-- monthly_financials holds one row per calendar month. For months before
-- the app had real client_plans data (pre March 2026), it's a static
-- import of the historical spreadsheet. From March 2026 onward, the admin
-- UI computes revenue/expenses live from client_plans + expenses +
-- recurring_expenses and does not need a stored row here — but a row MAY
-- be written as a cache/snapshot for performance.
create table if not exists monthly_financials (
  id uuid primary key default gen_random_uuid(),
  year integer not null,
  month integer not null check (month between 1 and 12),
  revenue numeric not null default 0,
  revenue_bgn numeric,
  expenses_json jsonb not null default '{}'::jsonb,
  new_coach_trainings integer,
  active_clients integer,
  active_clients_approx boolean not null default false,
  source text not null default 'historical' check (source in ('historical', 'computed')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, month)
);

-- Recurring monthly costs (rent, accounting, insurance, salaries, ...) —
-- defined once, auto-applied to every computed (live) month from here on,
-- instead of being re-typed by hand every month like in the spreadsheet.
create table if not exists recurring_expenses (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  amount numeric not null default 0,
  category text not null default 'fixed' check (category in ('salary', 'fixed')),
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table monthly_financials enable row level security;
alter table recurring_expenses enable row level security;

-- Anon (the admin browser session) reads/writes directly, same trust model
-- as client_plans/expenses elsewhere in this app.
create policy "monthly_financials_all" on monthly_financials for all using (true) with check (true);
create policy "recurring_expenses_all" on recurring_expenses for all using (true) with check (true);
