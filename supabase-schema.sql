-- ============================================================
-- SYNRG APP — Supabase SQL Schema (safe to run on existing project)
-- Изпълни в Supabase → SQL Editor → Run
-- ============================================================

create table if not exists coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  password    text not null,
  created_at  timestamptz default now()
);

create table if not exists clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  password           text not null,
  calorie_target     integer default 2000,
  protein_target     integer default 140,
  reminder_settings  jsonb default '{"protein":true,"weight":true,"foodLog":true,"coach":true}'::jsonb,
  created_at         timestamptz default now()
);

create table if not exists meals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  label       text not null,
  grams       numeric,
  kcal        numeric,
  protein     numeric,
  created_at  timestamptz default now()
);

create table if not exists workouts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  coach       text,
  category    text,
  items       jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

create table if not exists weight_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  weight      numeric,
  created_at  timestamptz default now()
);

alter table weight_logs drop constraint if exists weight_logs_client_id_date_key;
alter table weight_logs add constraint weight_logs_client_id_date_key unique (client_id, date);

create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  title        text not null,
  description  text default '',
  assigned_by  text,
  status       text default 'pending',
  created_at   timestamptz default now()
);

create table if not exists task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete cascade,
  author      text,
  text        text not null,
  is_coach    boolean default false,
  created_at  timestamptz default now()
);

create table if not exists reactions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  type          text,
  message       text default '',
  trainer_name  text,
  dismissed     boolean default false,
  created_at    timestamptz default now()
);

-- ── RLS policies (skip if already exist) ─────────────────────
do $$ begin
  alter table coaches       enable row level security;
  alter table clients       enable row level security;
  alter table meals         enable row level security;
  alter table workouts      enable row level security;
  alter table weight_logs   enable row level security;
  alter table tasks         enable row level security;
  alter table task_comments enable row level security;
  alter table reactions     enable row level security;
exception when others then null;
end $$;

do $$ begin create policy "anon_all" on coaches       for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on clients       for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on meals         for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on workouts      for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on weight_logs   for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on tasks         for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on task_comments for all using (true) with check (true); exception when duplicate_object then null; end $$;
do $$ begin create policy "anon_all" on reactions     for all using (true) with check (true); exception when duplicate_object then null; end $$;

-- ── Seed coaches (само ако таблицата е празна) ───────────────
insert into coaches (name, password)
select name, password from (values
  ('Елина',  '1111'),
  ('Никола', '1111'),
  ('Ицко',   '1111'),
  ('Алекс',  '1111')
) as t(name, password)
where not exists (select 1 from coaches limit 1);
