-- Месечен check-in на клиента: 3 въпроса, веднъж на календарен месец.
-- Целта е САМО да отсее хората със сигнал — не е CRM и не пази история за
-- обработка, статуси или кой се е погрижил.

create table if not exists public.client_checkins (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references public.clients(id) on delete cascade,
  month_key    text not null,                        -- 'YYYY-MM'
  feeling      int  not null check (feeling  between 1 and 5),
  progress     int  not null check (progress between 1 and 5),
  help_topics  text[] not null default '{}',
  help_other   text,
  created_at   timestamptz not null default now(),

  -- Изчислява се от базата, за да не може правилото да се разминава между
  -- клиентския код и админа. Празен списък също вдига флаг — по-добре излишен
  -- сигнал, отколкото пропуснат човек.
  needs_attention boolean generated always as (
    feeling <= 3
    or progress <= 3
    or coalesce(array_length(help_topics, 1), 0) <> 1
    or help_topics[1] is distinct from 'Не, всичко е наред'
  ) stored,

  unique (client_id, month_key)
);

create index if not exists client_checkins_attention_idx
  on public.client_checkins (needs_attention, created_at desc);
create index if not exists client_checkins_month_idx
  on public.client_checkins (month_key, client_id);

alter table public.client_checkins enable row level security;

-- Приложението работи с публичния ключ (няма Supabase Auth), както навсякъде
-- другаде. Пише се веднъж и не се променя, затова няма UPDATE/DELETE за anon.
drop policy if exists checkins_anon_select on public.client_checkins;
drop policy if exists checkins_anon_insert on public.client_checkins;
create policy checkins_anon_select on public.client_checkins for select to anon using (true);
create policy checkins_anon_insert on public.client_checkins for insert to anon with check (true);

grant select, insert on public.client_checkins to anon;
grant all on public.client_checkins to service_role;
