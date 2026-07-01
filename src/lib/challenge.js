// ── In-App 7-Day Challenge — pure derivation module ──────────────
// Mirrors gamification.js: no DB calls, no React. Per-day completion is
// DERIVED live from the client's real logs (meals / weightLogs / stepsLogs),
// so there is nothing to fake and nothing extra to write.
//
// DATE GOTCHA (highest risk): log dates live in app state as DD.MM.YYYY,
// while challenge_started_on is ISO YYYY-MM-DD. We convert via the SAME
// helpers used everywhere else and NEVER cross-format compare.

import { parseDate } from './utils'

// Phase B: the new €79 graduate Stripe price id goes here.
export const CHALLENGE_PRICE_ID = null

// ── date helpers (ISO YYYY-MM-DD ⇄ DD.MM.YYYY) ───────────────────
function isoToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function isoToDate(iso) {
  const [y, m, d] = String(iso || '').split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}
function isoToDdmmyyyy(iso) {
  const [y, m, d] = String(iso || '').split('-')
  if (!y || !m || !d) return ''
  return `${d}.${m}.${y}`
}
// Whole-day diff (b - a) in days, both ISO.
function daysBetweenIso(aIso, bIso) {
  const a = isoToDate(aIso), b = isoToDate(bIso)
  return Math.floor((b - a) / 86400000)
}

// ── per-day completion checks (client, DD.MM.YYYY) ───────────────
function mealsForDate(client, ddmmyyyy) {
  return (client?.meals || []).filter(m => m.date === ddmmyyyy)
}
function hasWeight(client, ddmmyyyy) {
  return (client?.weightLogs || []).some(w => w.date === ddmmyyyy)
}
function hasSteps(client, ddmmyyyy) {
  return (client?.stepsLogs || []).some(s => s.date === ddmmyyyy)
}

// ── day-by-day task definitions ──────────────────────────────────
// Each day holds one OR MORE tasks (a checklist). A day counts as "done"
// only when ALL of its tasks pass. Completion is DERIVED from real logs.
//   howBg   = optional array of expandable lines (help / education), revealed
//             behind a per-task toggle so the copy stays short.
//   seeLabel= label for that toggle ('Виж как' for how-to, 'Виж защо' for the
//             education/why ones). Defaults to 'Виж как'.
//   whyBg   = optional soft-education line in д-р Желязова's voice.
// Tasks are kept intentionally LIGHT (it's a free on-ramp — don't over-ask).
// CHALLENGE_LEN is derived from however many days are defined, so the card
// auto-adjusts if days are added or removed.
export const CHALLENGE_DAYS = [
  {
    day: 1,
    tasks: [
      {
        id: 'd1_cal',
        titleBg: 'Определи калорийната си цел',
        descBg: 'Отвори трекера за храна и натисни молива до таргетите.',
        action: 'Отвори таргетите',
        view: 'food',
        seeLabel: 'Виж защо',
        howBg: [
          'Калорийната цел определя дали сваляш, качваш или поддържаш килограми.',
          'Сметни дневната си поддръжка по формулата на Mifflin-St Jeor:',
          '• Жени: BMR = 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст − 161',
          '• Мъже: BMR = 10 × тегло(кг) + 6.25 × ръст(см) − 5 × възраст + 5',
          'Умножи BMR по активността: 1.2 (заседнал) · 1.375 (леко активен) · 1.55 (умерено активен) · 1.725 (много активен).',
          'За сваляне извади 15–20%, за качване добави 10–15%, за поддръжка остави без промяна.',
        ],
        check: (c) => Number(c?.calorieTarget) > 0,
      },
      {
        id: 'd1_meal',
        titleBg: 'Въведи поне едно хранене днес',
        descBg: 'Снимай или добави ръчно — едно хранене стига за днес.',
        action: 'Отвори храна',
        view: 'food',
        howBg: [
          'Натисни „+" в трекера за храна и избери начин:',
          '• Снимка — снимай чинията и AI разпознава храната и калориите.',
          '• Търсене — напиши името на продукта и избери от базата.',
          '• Ръчно — въведи калории и протеин сам, ако знаеш стойностите.',
          'Не е нужно да е перфектно — приблизителното броене също работи.',
        ],
        check: (c, d) => mealsForDate(c, d).length > 0,
      },
    ],
  },
  {
    day: 2,
    tasks: [
      {
        id: 'd2_weight',
        titleBg: 'Въведи теглото си',
        descBg: 'Измери се сутрин, преди закуска — за чиста базова линия.',
        action: 'Отвори тегло',
        view: 'weight',
        seeLabel: 'Виж защо',
        howBg: [
          'Знаеш как теглото варира с 1–2 кг от ден на ден.',
          'Това е заради водата в тялото, която задържаме или изхвърляме в следствие на различни фактори.',
          'Записвай го в рамките на 7 дни и ще видиш реалното си тегло и каква е тенденцията на движение.',
        ],
        check: (c, d) => hasWeight(c, d),
      },
      {
        id: 'd2_allmeals',
        titleBg: 'Опитай се да въведеш всичко, което ядеш днес',
        descBg: 'Закуска, обяд, вечеря и снаксовете между тях.',
        action: 'Отвори храна',
        view: 'food',
        howBg: [
          'Записвай всяко хранене веднага след като се нахраниш — така не забравяш.',
          'Дори приблизителните количества дават ясна картина за деня.',
          'Целта не е перфектност, а да видиш реално колко ядеш.',
        ],
        check: (c, d) => mealsForDate(c, d).length >= 2,
      },
    ],
  },
  {
    day: 3,
    tasks: [
      {
        id: 'd3_protein',
        titleBg: 'Определи целта за протеини',
        descBg: 'Отвори таргетите и задай протеинова цел.',
        action: 'Отвори таргетите',
        view: 'food',
        seeLabel: 'Виж защо',
        howBg: [
          'Протеинът пази мускулите и те държи сит по-дълго.',
          'Ориентир: 1.6–2 г протеин на кг телесно тегло на ден.',
          'Колкото по-активен си, толкова по-високо в диапазона: по-малко активен → към 1.6 г; редовни тренировки → към 2 г.',
          'Пример: при 70 кг това е около 112–140 г протеин дневно.',
        ],
        check: (c) => Number(c?.proteinTarget) > 0,
      },
    ],
  },
  {
    day: 4,
    tasks: [
      {
        id: 'd4_under_cal',
        titleBg: 'Опитай да не превишаваш калорийната си цел',
        descBg: 'Запиши всичко изядено и се събери под целта за деня.',
        action: 'Отвори храна',
        view: 'food',
        seeLabel: 'Виж как',
        howBg: [
          'Разпредели калориите през деня и остави малко резерв за вечерта.',
          'Избирай храни с обем и протеин — засищат с по-малко калории.',
          'Ако прекалиш днес — не се самонаказвай, важна е седмицата, не денят.',
        ],
        check: (c, d) => {
          const meals = mealsForDate(c, d)
          if (!meals.length) return false
          const target = Number(c?.calorieTarget || 0)
          if (target <= 0) return false
          const kcal = meals.reduce((s, m) => s + Number(m.kcal || 0), 0)
          return kcal <= target
        },
      },
    ],
  },
  {
    day: 5,
    tasks: [
      {
        id: 'd5_hit_protein',
        titleBg: 'Опитай да достигнеш зададената цел за протеини',
        descBg: 'Добави протеин към всяко хранене и виж стигаш ли целта.',
        action: 'Отвори храна',
        view: 'food',
        seeLabel: 'Виж как',
        howBg: [
          'Започни деня с богата на протеин закуска.',
          'Дръж под ръка лесен източник на протеин за между храненията.',
          'Разпредели протеина през целия ден, не всичко наведнъж.',
        ],
        check: (c, d) => {
          const meals = mealsForDate(c, d)
          if (!meals.length) return false
          const target = Number(c?.proteinTarget || 0)
          if (target <= 0) return false
          const protein = meals.reduce((s, m) => s + Number(m.protein || 0), 0)
          return protein >= target
        },
      },
    ],
  },
  {
    day: 6,
    tasks: [
      {
        id: 'd6_cooked',
        titleBg: 'Ето как да сметнеш ястие с много съставки',
        descBg: 'Супа, манджа, яхния — научи как да въведеш готвено ястие точно.',
        action: 'Отвори храна',
        view: 'food',
        seeLabel: 'Виж как',
        howBg: [
          'Претегли всяка съставка сурова и събери калориите ѝ:',
          '• месо 1 кг · картофи 0.5 кг · олио 30 г · зеленчуци 300 г',
          'Събери калориите на всички съставки → това е общо калории.',
          'Накрая претегли цялата сготвена манджа в грамове.',
          'Калории на 100 г = общо калории ÷ тегло на манджата × 100',
          'Претегли своята порция и умножи: калории на 100 г × (грамове на порцията ÷ 100).',
        ],
        check: (c, d) => mealsForDate(c, d).length > 0,
      },
    ],
  },
  {
    day: 7,
    tasks: [
      {
        id: 'd7_close',
        titleBg: 'Затвори седмицата',
        descBg: 'Запиши едно хранене и се претегли — виж докъде стигна за 7 дни.',
        action: 'Отвори храна',
        view: 'food',
        seeLabel: 'Виж защо',
        whyBg: 'За 7 дни вече знаеш да броиш. Но да го правиш цял живот е изтощително — точно това решава SYNRG Метод с д-р Желязова: да ядеш нормално, без постоянно да мислиш за храна.',
        check: (c, d) => mealsForDate(c, d).length > 0 && hasWeight(c, d),
      },
    ],
  },
]

// Challenge length auto-adjusts to however many days are defined above.
export const CHALLENGE_LEN = CHALLENGE_DAYS.length

// Convenience: day object (1-based) or null.
function dayObj(day) {
  return CHALLENGE_DAYS[day - 1] || null
}

// ── derivations ──────────────────────────────────────────────────
// currentDay: 0 = not started, 1..7 = active day, 8+ = past the week.
export function currentDay(startedOnIso) {
  if (!startedOnIso) return 0
  return daysBetweenIso(startedOnIso, isoToday()) + 1
}

// ISO date string for a given challenge day (1-based).
export function dateForDay(startedOnIso, day) {
  if (!startedOnIso) return ''
  const base = isoToDate(startedOnIso)
  base.setDate(base.getDate() + (day - 1))
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
}

// Is a single task done on its scheduled challenge day?
export function taskDone(client, day, task) {
  const startedOn = client?.challengeStartedOn
  if (!startedOn || !task) return false
  const dayIso = dateForDay(startedOn, day)
  return !!task.check(client, isoToDdmmyyyy(dayIso))
}

// Status of a whole day: 'locked' (future), 'todo' (today, not all done),
// 'done' (ALL tasks complete), 'missed' (past, not all done).
export function dayStatus(client, day) {
  const startedOn = client?.challengeStartedOn
  if (!startedOn) return 'locked'
  const today = currentDay(startedOn)
  const d = dayObj(day)
  if (!d) return 'locked'
  // A future day is ALWAYS locked — never count it as done just because its
  // task happens to be trivially satisfiable (e.g. a target that defaults > 0).
  if (day > today) return 'locked'
  const allDone = d.tasks.every(t => taskDone(client, day, t))
  if (allDone) return 'done'
  if (day === today) return 'todo'
  return 'missed'
}

// First Friday that is >= start + 9 days (SHARED rule — the email cron
// mirrors this so app + email show the same personal deadline).
export function nextFriday(startedOnIso) {
  if (!startedOnIso) return ''
  const d = isoToDate(startedOnIso)
  d.setDate(d.getDate() + 9)
  // 0=Sun..6=Sat → advance to Friday (5)
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Whole-progress snapshot for the card / hook.
export function progress(client) {
  const startedOn = client?.challengeStartedOn || null
  if (!startedOn) {
    return { started: false, day: 0, completedDays: 0, allDone: false, isOverdue: false }
  }
  const day = currentDay(startedOn)
  let completedDays = 0
  for (let i = 1; i <= CHALLENGE_LEN; i++) {
    if (dayStatus(client, i) === 'done') completedDays++
  }
  const allDone = completedDays >= CHALLENGE_LEN
  const isOverdue = day > CHALLENGE_LEN
  return { started: true, day, completedDays, allDone, isOverdue }
}

// Re-export so callers can format the personal deadline without re-deriving.
export function nextFridayDate(startedOnIso) {
  const iso = nextFriday(startedOnIso)
  return iso ? parseDate(isoToDdmmyyyy(iso)) : null
}
