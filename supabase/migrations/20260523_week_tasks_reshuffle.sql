-- ═══════════════════════════════════════════════════════════════
-- Week 1/2 task reshuffle
-- Created: 2026-05-23
--
-- 1) Move "Без напитки с калории" from Week 2 → Week 1 (position 5).
--    Hydration/no-cal drinks is a foundational habit and belongs in
--    the first week alongside the other simple baseline habits.
-- 2) Add new Week 2 task "Супа за вечеря" — light evening meal twice
--    per week as a recovery/de-bloat habit.
-- ═══════════════════════════════════════════════════════════════

-- 1) Move "Без напитки с калории" → Week 1, position 5
UPDATE program_weekly_tasks
SET    week_id  = (SELECT id FROM program_weeks WHERE week_number = 1),
       position = 5
WHERE  title_bg = 'Без напитки с калории';

-- 2) Insert "Супа за вечеря" into Week 2 if not already present (idempotent)
INSERT INTO program_weekly_tasks (week_id, position, title_bg, description, task_type)
SELECT w.id,
       4,
       'Супа за вечеря',
       'Опитай 2 пъти в седмицата основното ти хранене вечер да бъде супа с 1-2 филийки хляб и сирене (ако искаш). С това приключваш с храната за вечерта. Това ще те накара да се чувстваш изключително лек и неподут на сутринта.',
       'nutrition'
FROM   program_weeks w
WHERE  w.week_number = 2
  AND  NOT EXISTS (
    SELECT 1 FROM program_weekly_tasks t
    WHERE  t.week_id = w.id AND t.title_bg = 'Супа за вечеря'
  );
