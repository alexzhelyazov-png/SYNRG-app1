-- ═══════════════════════════════════════════════════════════════
-- Planner content seed — SYNRG Метод weekly goals + tasks
-- Created: 2026-04-25
-- Source: user's SYNRG planner (Sedmica 1-8 + Final)
-- Populates the real weekly goals (title_bg/subtitle_bg/intro_text)
-- and seeds program_weekly_tasks for weeks 1-8.
-- Weeks 9-12 remain as placeholders (to be filled by admin) — they
-- extend the "Контрол без патерици" phase toward program completion.
-- ═══════════════════════════════════════════════════════════════

-- ── Week 1 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Първи стъпки и реална картина',
  subtitle_bg = 'Започваме промяната без насилване',
  intro_text  = 'Целта на тази седмица е да разбереш какво и колко ядеш в момента — без да променяш нищо насила. Измерваме, записваме, създаваме базова картина.'
WHERE week_number = 1;

-- ── Week 2 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Полагаме основите',
  subtitle_bg = 'Подреждаме, без да отнемаме',
  intro_text  = 'Започваме да структурираме храненето и движението. Добавяме, не махаме. Целта е постоянство, не перфектност.'
WHERE week_number = 2;

-- ── Week 3 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Започваме да балансираме',
  subtitle_bg = 'Всяко хранене работи за теб',
  intro_text  = 'Фокус върху баланса — протеин във всяко хранене, правилно разпределение на въглехидратите.'
WHERE week_number = 3;

-- ── Week 4 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Ритъм в деня',
  subtitle_bg = 'Хранене с план, а не от глад',
  intro_text  = 'Изграждаме ритъм — снак преди силния глад, достатъчно протеин за деня.'
WHERE week_number = 4;

-- ── Week 5 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Семейна кухня и реален живот',
  subtitle_bg = 'Храна за цялото семейство',
  intro_text  = 'Как да ядеш добре, когато готвиш за други. Сметни калориите на любимите си ястия и ги олекоти.'
WHERE week_number = 5;

-- ── Week 6 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Движение с лекота',
  subtitle_bg = 'Повече крачки, повече енергия',
  intro_text  = 'Увеличаваме движението без да го превръщаме в задължение. Разходки, крачки, лека активност.'
WHERE week_number = 6;

-- ── Week 7 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Контрол без патерици',
  subtitle_bg = 'Слушай тялото си',
  intro_text  = 'Яж когато си гладен, спирай когато си сит. Без броене, без правила — чиста осъзнатост.'
WHERE week_number = 7;

-- ── Week 8 ────────────────────────────────────────────────────
UPDATE program_weeks SET
  title_bg    = 'Устойчивост и навик',
  subtitle_bg = 'Режимът става твой',
  intro_text  = 'Консолидираме научените навици. Храненето и движението вече не са усилие — те са част от теб.'
WHERE week_number = 8;

-- ── Weeks 9-12 (progression phase — admin can refine) ────────
UPDATE program_weeks SET
  title_bg    = 'Разширяваме обхвата',
  subtitle_bg = 'Нови предизвикателства',
  intro_text  = 'Надграждаме основата — по-разнообразна храна, по-интензивно движение, по-дълбок самоконтрол.'
WHERE week_number = 9;

UPDATE program_weeks SET
  title_bg    = 'Справяне с трудните дни',
  subtitle_bg = 'Системата работи дори в стрес',
  intro_text  = 'Стресът, умората и социалните ситуации са истинският тест. Прилагаме наученото в реален живот.'
WHERE week_number = 10;

UPDATE program_weeks SET
  title_bg    = 'Лична формула',
  subtitle_bg = 'Какво работи точно за теб',
  intro_text  = 'Вече знаеш какво ти дава енергия и какво ти пречи. Превръщаме това в твоя лична формула.'
WHERE week_number = 11;

UPDATE program_weeks SET
  title_bg    = 'Завършване и напред',
  subtitle_bg = 'Край на програмата, начало на режима',
  intro_text  = 'Обобщение, измерване на прогреса, план за следващите месеци. Това не е финал — това е старт.'
WHERE week_number = 12;

-- ───────────────────────────────────────────────────────────────
-- Clear & reseed weekly tasks for weeks 1-8
-- ───────────────────────────────────────────────────────────────
DELETE FROM program_weekly_tasks
WHERE week_id IN (SELECT id FROM program_weeks WHERE week_number BETWEEN 1 AND 8);

-- Week 1 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Мери се всяка сутрин',             'Използвай Libra или Happy Scale. Видиш ли трендa, спираш да реагираш на всяка цифра.', 'weight'     FROM program_weeks WHERE week_number = 1
UNION ALL
SELECT id, 2, 'Пий 2+ литра вода на ден',         'Хидратацията е основата. Носи бутилка със себе си.',                                      'generic'    FROM program_weeks WHERE week_number = 1
UNION ALL
SELECT id, 3, 'Добави фибри във всяко хранене',    'Зеленчук, плод или пълнозърнест продукт — във всяко хранене.',                            'nutrition'  FROM program_weeks WHERE week_number = 1
UNION ALL
SELECT id, 4, '+2–3000 крачки над нормалното',     'Не се цели в идеал — просто повече от преди.',                                            'generic'    FROM program_weeks WHERE week_number = 1
UNION ALL
SELECT id, 5, 'Записвай всяка храна и напитка',    'Без да променяш нищо — просто записвай. Това е базата.',                                  'nutrition'  FROM program_weeks WHERE week_number = 1
UNION ALL
SELECT id, 6, 'Замени захарните напитки с вода',   'Сокове, лимонади, подсладени кафета → вода, чай, черно кафе.',                            'nutrition'  FROM program_weeks WHERE week_number = 1;

-- Week 2 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, '3 × тегло (кг) ккал пакетирани',    'Ограничи пакетираната храна — около 3× теглото ти в ккал/ден.', 'nutrition'  FROM program_weeks WHERE week_number = 2
UNION ALL
SELECT id, 2, '½ с.л. мазнина на порция',          'Точно отмервай мазнината в готвенето.',                          'nutrition'  FROM program_weeks WHERE week_number = 2
UNION ALL
SELECT id, 3, '2 тренировки тази седмица',         'Минимум две — не е нужно да са дълги.',                          'generic'    FROM program_weeks WHERE week_number = 2
UNION ALL
SELECT id, 4, 'Продължи да записваш храна и тегло','Не спирай това, което вече върши работа.',                       'nutrition'  FROM program_weeks WHERE week_number = 2;

-- Week 3 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Протеин във всяко хранене',         'Яйца, месо, риба, извара, бобови. Всяко хранене — източник на протеин.', 'nutrition'  FROM program_weeks WHERE week_number = 3
UNION ALL
SELECT id, 2, 'Балансирано хранене',                '¼ протеин, ¼ въглехидрат, ½ зеленчуци в чинията.',                       'nutrition'  FROM program_weeks WHERE week_number = 3
UNION ALL
SELECT id, 3, 'Един въглехидрат за вечеря',         'Не два. Един — за засищане, не за депо.',                                'nutrition'  FROM program_weeks WHERE week_number = 3;

-- Week 4 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Снак преди силния глад',            'Не чакай да огладнееш зверски — снакни преди това.',  'nutrition'  FROM program_weeks WHERE week_number = 4
UNION ALL
SELECT id, 2, '1.5 г протеин на килограм тегло',   'Цели се в 1.5 × теглото ти в грамове протеин дневно.', 'nutrition'  FROM program_weeks WHERE week_number = 4
UNION ALL
SELECT id, 3, 'Продължи да записваш',               'Навикът работи само ако е постоянен.',                'nutrition'  FROM program_weeks WHERE week_number = 4;

-- Week 5 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Сметни калории на 3 любими ястия',  'Открий колко ккал имат — често се изненадваш.',     'nutrition'  FROM program_weeks WHERE week_number = 5
UNION ALL
SELECT id, 2, 'Олекоти едно ястие',                'Намали мазнината или размера — минимална разлика.',  'nutrition'  FROM program_weeks WHERE week_number = 5
UNION ALL
SELECT id, 3, 'Запази семейната трапеза',           'Яж заедно със семейството — не отделно.',           'generic'    FROM program_weeks WHERE week_number = 5;

-- Week 6 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, '+2000 крачки над базата',           'Надгради крачките от първа седмица.',                'generic'  FROM program_weeks WHERE week_number = 6
UNION ALL
SELECT id, 2, 'Или 2 разходки по 60 мин',          'Алтернатива на крачките — 2 дълги разходки.',         'generic'  FROM program_weeks WHERE week_number = 6
UNION ALL
SELECT id, 3, '2 тренировки минимум',              'Продължаваме ритъма от седмица 2.',                  'generic'  FROM program_weeks WHERE week_number = 6;

-- Week 7 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Яж когато си гладен',               'Истински гладен — не от скука или стрес.',           'nutrition'  FROM program_weeks WHERE week_number = 7
UNION ALL
SELECT id, 2, 'Спирай когато си сит',              'Не дояждай само защото е в чинията.',                'nutrition'  FROM program_weeks WHERE week_number = 7
UNION ALL
SELECT id, 3, 'Оцени глада 1–10 преди хранене',    'Не сядай ако не си поне 6/10 гладен.',               'nutrition'  FROM program_weeks WHERE week_number = 7;

-- Week 8 tasks
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT id, 1, 'Поддържай навиците без списък',     'Тази седмица — без да гледаш задачите. Вярвай си.',  'generic'  FROM program_weeks WHERE week_number = 8
UNION ALL
SELECT id, 2, 'Измери прогреса',                    'Снимка, мерки, тегло — сравни с първа седмица.',     'weight'   FROM program_weeks WHERE week_number = 8
UNION ALL
SELECT id, 3, 'Запиши какво работи за теб',         'Най-полезният навик в твоя личен план.',             'generic'  FROM program_weeks WHERE week_number = 8;
