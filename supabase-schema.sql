-- ============================================================
-- SYNRG APP — Supabase SQL Schema
-- Изпълни всичко в Supabase → SQL Editor → Run
-- ============================================================

-- Coaches
create table coaches (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  password    text not null,
  created_at  timestamptz default now()
);

-- Clients
create table clients (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null unique,
  password           text not null,
  calorie_target     integer default 2000,
  protein_target     integer default 140,
  reminder_settings  jsonb default '{"protein":true,"weight":true,"foodLog":true,"coach":true}'::jsonb,
  created_at         timestamptz default now()
);

-- Meals
create table meals (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  label       text not null,
  grams       numeric,
  kcal        numeric,
  protein     numeric,
  created_at  timestamptz default now()
);

-- Workouts
create table workouts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  coach       text,
  category    text,
  items       jsonb default '[]'::jsonb,
  created_at  timestamptz default now()
);

-- Weight logs (unique per client + date)
create table weight_logs (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid references clients(id) on delete cascade,
  date        text not null,
  weight      numeric,
  created_at  timestamptz default now(),
  unique(client_id, date)
);

-- Tasks
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid references clients(id) on delete cascade,
  title        text not null,
  description  text default '',
  assigned_by  text,
  status       text default 'pending',
  created_at   timestamptz default now()
);

-- Task comments
create table task_comments (
  id          uuid primary key default gen_random_uuid(),
  task_id     uuid references tasks(id) on delete cascade,
  author      text,
  text        text not null,
  is_coach    boolean default false,
  created_at  timestamptz default now()
);

-- Reactions (coach → client)
create table reactions (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid references clients(id) on delete cascade,
  type          text,
  message       text default '',
  trainer_name  text,
  dismissed     boolean default false,
  created_at    timestamptz default now()
);

-- ============================================================
-- ДОСТЪП: Позволяваме anon достъп (app-level auth)
-- Изпълни за всяка таблица:
-- ============================================================
alter table coaches       enable row level security;
alter table clients       enable row level security;
alter table meals         enable row level security;
alter table workouts      enable row level security;
alter table weight_logs   enable row level security;
alter table tasks         enable row level security;
alter table task_comments enable row level security;
alter table reactions     enable row level security;

create policy "anon_all" on coaches       for all using (true) with check (true);
create policy "anon_all" on clients       for all using (true) with check (true);
create policy "anon_all" on meals         for all using (true) with check (true);
create policy "anon_all" on workouts      for all using (true) with check (true);
create policy "anon_all" on weight_logs   for all using (true) with check (true);
create policy "anon_all" on tasks         for all using (true) with check (true);
create policy "anon_all" on task_comments for all using (true) with check (true);
create policy "anon_all" on reactions     for all using (true) with check (true);

-- ============================================================
-- SEED: Начални треньори (изпълни само веднъж!)
-- ============================================================
insert into coaches (name, password) values
  ('Елина',  '1111'),
  ('Никола', '1111'),
  ('Ицко',   '1111'),
  ('Алекс',  '1111')
on conflict (name) do nothing;
