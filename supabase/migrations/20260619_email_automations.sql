-- Email automations: DB-backed templates so admin can view/toggle/edit from the app.
create table if not exists public.email_automations (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  category text not null,            -- buyer | nurture | inactive
  label text not null,
  trigger_desc text,
  audience text not null,            -- buyers | freemium | inactive
  subject text not null,
  body_html text not null,           -- inner body, may contain {name}; chrome added by edge fn
  enabled boolean not null default false,
  sort_order int not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.email_automations enable row level security;

drop policy if exists ea_anon_select on public.email_automations;
create policy ea_anon_select on public.email_automations
  for select to anon using (true);

drop policy if exists ea_anon_update on public.email_automations;
create policy ea_anon_update on public.email_automations
  for update to anon using (true) with check (true);

-- service_role bypasses RLS by default.

insert into public.email_automations (key, category, label, trigger_desc, audience, subject, body_html, enabled, sort_order) values
('buyer_d1','buyer','Купувач · Ден 1 — Първи стъпки','1 ден след покупка на SYNRG Метод','buyers',
 'SYNRG Метод — първите стъпки днес',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Здравей, {name}!</h2><p>Радваме се че започваш SYNRG Метод. Следващите 8 седмици ще променят начина по който се чувстваш.</p><p><strong>Днес направи 3 неща:</strong></p><ul><li>Влез в приложението и регистрирай теглото си (Прогрес → +Тегло)</li><li>Запиши първата си седмица в календара</li><li>Прочети Welcome съобщението от твоя ментор</li></ul><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Отвори приложението</a></div><p style="font-size:13px;color:#999">Имаш въпроси? Просто отговори на този email.</p>',
 true, 10),

('buyer_d3','buyer','Купувач · Ден 3 — Как е първата седмица','3 дни след покупка','buyers',
 'Как мина първата ти седмица в SYNRG?',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>3 дни са от старта. Как си?</p><p>Ако не си отварял app-а, стори го днес. Първата седмица е най-важната — затова и менторът ти е на разположение.</p><p><strong>Tip:</strong> Логни поне 1 хранене и 1 тегло днес — това ще ти даде basis за сравнение.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Влез в SYNRG</a></div>',
 true, 20),

('buyer_d7','buyer','Купувач · Ден 7 — Прогрес преглед','7 дни след покупка','buyers',
 '1 седмица в SYNRG — твоят прогрес',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">Поздравления, {name}!</h2><p>Първата седмица е завършена.</p><p>Време е да погледнеш напред:</p><ul><li>Сравни теглото от ден 1 с днес</li><li>Колко тренировки записа?</li><li>Имаш ли въпроси към ментора?</li></ul><p>Следващите 7 дни — фокус на хранителния режим. Менторът ти ще те преведе.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/#/progress" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Виж прогреса</a></div>',
 true, 30),

('buyer_d14','buyer','Купувач · Ден 14 — Progress photos','14 дни след покупка','buyers',
 'Време за progress photos',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>2 седмици в SYNRG Метод. Време е за първите progress photos!</p><p>Снимай се сутрин на гладно от 4 ъгъла:</p><ul><li>Лице (отпред)</li><li>Профил отстрани (ляв и десен)</li><li>Гръб</li></ul><p>Запази ги локално — ще ги сравним след още 2 седмици.</p><p>Призив от ментора: твоят progress е важен. Не пропускай.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Отвори SYNRG</a></div>',
 true, 40),

('buyer_d28','buyer','Купувач · Ден 28 — Половината','28 дни след покупка','buyers',
 'Половината от програмата е зад теб',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>4 седмици в SYNRG Метод — middle point!</p><p>Време за оценка:</p><ul><li>Колко килограма промяна?</li><li>Как се чувстваш в дрехите?</li><li>Кое работи най-добре в режима?</li></ul><p>Ако нещо не ти е ясно — пиши на ментора. Втората половина е най-важна за затвърждаване на навиците.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/#/coach" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Чат с ментора</a></div>',
 true, 50),

('buyer_d56_review','buyer','Купувач · Ден 56 — Завършване и ревю','56 дни след покупка (край на програмата)','buyers',
 'Завърши SYNRG Метод — споделяш ли ни опита си?',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name}, поздравления!</h2><p>Завърши 8-седмичната програма. Това е истинско постижение.</p><p><strong>Нашата молба:</strong> сподели опита си с другите.</p><p>2-минутна оценка — ще покажем твоето ревю на следващите клиенти и ще ги вдъхновиш.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/#/programs" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Дай ревю</a></div><p style="font-size:13px;color:#999;margin-top:24px"><strong>Какво следва?</strong></p><p style="font-size:13px;color:#999">Запазваш безплатен достъп до hranene/тегло/стъпки трекери. Готов ли си за студио-тренировки на живо? <a href="https://synrg-beyondfitness.com/studio.html" style="color:#c4e9bf">Виж пакетите</a>.</p>',
 true, 60),

('free_d7','nurture','Upsell · Ден 7 — Следващото ниво','7 дни след регистрация (freemium, без покупка)','freemium',
 'Готов ли си за следващото ниво?',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>Седмица откакто си в SYNRG. Видя ли вече SYNRG Метод?</p><p>8-седмична програма с професионален ментор:</p><ul><li>Персонализиран хранителен режим</li><li>2 check-in сесии месечно с ментор</li><li>Тренировъчни планове</li><li>Достъп до общност</li></ul><p><strong>Цена: €98.</strong></p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/#/programs" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Виж SYNRG Метод</a></div>',
 false, 70),

('free_d14','nurture','Upsell · Ден 14 — Напомняне','14 дни след регистрация (freemium, без покупка)','freemium',
 'SYNRG Метод — готов ли си да започнеш?',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>Ако се колебаеш за SYNRG Метод — ето защо клиентите ни го избират:</p><ul><li>Не е "още една програма" — има реален човек до теб</li><li>Адаптираме спрямо твоето ниво</li><li>Резултати се виждат от 2-ра седмица</li></ul><p><strong>Цена: €98.</strong></p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/#/programs" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Купи сега</a></div>',
 false, 80),

('inactive_14d','inactive','Re-engagement · 14 дни неактивност','Без хранене/тегло лог 14 дни (макс. 1/месец)','inactive',
 'Липсваш ни в SYNRG',
 '<h2 style="color:#c4e9bf;margin:0 0 16px;font-size:22px">{name},</h2><p>Не си отварял app-а от 2 седмици. Всичко наред ли е?</p><p>Знаем че понякога мотивацията пада. Затова имаме просто предложение:</p><p><strong>Започни с 1 нещо днес.</strong> Само 1.</p><ul><li>Изпий чаша вода</li><li>Логни 1 хранене</li><li>Направи 10 клякания</li></ul><p>Малките стъпки събират прогрес. Чакаме те.</p><div style="text-align:center;margin:24px 0"><a href="https://synrg-beyondfitness.com/app/" style="display:inline-block;background:#c4e9bf;color:#0d1510;padding:14px 28px;border-radius:99px;font-weight:800;text-decoration:none;font-size:14px">Влез отново</a></div>',
 true, 90)
on conflict (key) do nothing;
