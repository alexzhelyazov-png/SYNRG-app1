/* ═══════════════════════════════════════════════════════════════
   SYNRG Gamification Engine v3
   All-time badges (gold only) + Monthly badges (bronze/silver/gold)
   Monthly XP ranking + All-time levels
   ═══════════════════════════════════════════════════════════════ */

import { parseDate } from './utils'

// ── Level thresholds (20 levels) ────────────────────────────
export const LEVEL_THRESHOLDS = [
  0, 20, 50, 85, 130, 185, 250, 330, 420, 530,
  650, 790, 950, 1120, 1300, 1400, 1500, 1600, 1700, 1800,
]

export const LEVEL_NAMES = {
  bg: [
    'Новак','Активен','Трениращ','Атлет','Напреднал',
    'Силен','Много силен','Експерт','Мастер','Елит',
    'Про','Шампион','Ветеран','Лидер','Доминиращ',
    'Титан','Гранд Мастер','Легенда','Икона','Synergy Elite',
  ],
  en: [
    'Rookie','Active','Training','Athlete','Advanced',
    'Strong','Very Strong','Expert','Master','Elite',
    'Pro','Champion','Veteran','Leader','Dominant',
    'Titan','Grand Master','Legend','Icon','Synergy Elite',
  ],
}

// ── Tier colors (metallic) ──────────────────────────────────
export const TIER_COLORS = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold:   '#D4AF37',
}
export const TIER_ORDER = ['bronze', 'silver', 'gold']

// ── Badge categories ────────────────────────────────────────
export const BADGE_CATEGORIES = [
  { key: 'consistency',  labelBg: 'Последователност',   labelEn: 'Consistency',     accent: 'purple'  },
  { key: 'weight_loss',  labelBg: 'Отслабване',         labelEn: 'Weight Loss',     accent: 'primary' },
  { key: 'strength',     labelBg: 'Сила',               labelEn: 'Strength',        accent: 'orange'  },
  { key: 'special',      labelBg: 'Специални',          labelEn: 'Special',         accent: 'purple'  },
]


/* ═══════════════════════════════════════════════════════════════
   ALL-TIME BADGES — gold only, earned once forever
   ═══════════════════════════════════════════════════════════════ */

export const ALLTIME_BADGES = [
  // ── Workouts milestones (bronze → silver → gold) ──
  { id: 'workouts_30',      category: 'consistency',  xp: 20, tier: 'bronze', series: null, muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 30  },
  { id: 'workouts_50',      category: 'consistency',  xp: 35, tier: 'silver', series: null, muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 50  },
  { id: 'workouts_gold',    category: 'consistency',  xp: 50, tier: 'gold',   series: null, muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 100 },
  // ── Weight loss milestones (bronze → silver → gold) ──
  { id: 'weight_loss_5',    category: 'weight_loss',  xp: 20, tier: 'bronze', series: null, muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 5  },
  { id: 'weight_loss_10',   category: 'weight_loss',  xp: 40, tier: 'silver', series: null, muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 10 },
  { id: 'weight_loss_gold', category: 'weight_loss',  xp: 60, tier: 'gold',   series: null, muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 20 },
  // ── Other big goals ──
  { id: 'cal_days_gold',    category: 'special',      xp: 50, tier: 'gold', series: null, muiIcon: 'LocalDining',         condType: 'target_days',   condField: 'calTargetDays', condValue: 50  },
  { id: 'training_3m',      category: 'consistency',  xp: 50, tier: 'gold', series: null, muiIcon: 'FitnessCenter',       condType: 'consecutive_workout_months',                 condValue: 3   },
  { id: 'streak_gold',      category: 'special',      xp: 50, tier: 'gold', series: null, muiIcon: 'LocalFireDepartment', condType: 'streak',                                    condValue: 90  },
  { id: 'active_days_gold', category: 'consistency',  xp: 50, tier: 'gold', series: null, muiIcon: 'EventAvailable',      condType: 'count',         condField: 'activeDays',    condValue: 120 },

  // ── First entry (instant gratification) ──
  { id: 'first_meal',   category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'Restaurant',     condType: 'count', condField: 'mealCount',   condValue: 1 },
  { id: 'first_weight', category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'MonitorWeight',  condType: 'count', condField: 'weightCount', condValue: 1 },
  { id: 'first_steps',  category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'DirectionsWalk', condType: 'count', condField: 'stepsCount',  condValue: 1 },

  // ── Standalone ──
  { id: 'all_rounder',  category: 'special',  xp: 40, tier: null, series: null, muiIcon: 'AutoAwesome',  condType: 'compound',    condValue: 1   },
  { id: 'century_club', category: 'special',  xp: 50, tier: null, series: null, muiIcon: 'MilitaryTech', condType: 'meta',        condValue: 100 },
]


/* ═══════════════════════════════════════════════════════════════
   MONTHLY BADGES — earned per calendar month, repeatable
   condType: monthly_count | monthly_streak | monthly_steps
   ═══════════════════════════════════════════════════════════════ */

export const MONTHLY_BADGES = [
  // ── m_workouts series ──
  { id: 'm_workouts_bronze', monthly: true, xp: 10, tier: 'bronze', series: 'm_workouts', muiIcon: 'FitnessCenter', condType: 'monthly_count', condField: 'workoutCount', condValue: 8  },
  { id: 'm_workouts_silver', monthly: true, xp: 20, tier: 'silver', series: 'm_workouts', muiIcon: 'FitnessCenter', condType: 'monthly_count', condField: 'workoutCount', condValue: 12 },
  { id: 'm_workouts_gold',   monthly: true, xp: 35, tier: 'gold',   series: 'm_workouts', muiIcon: 'FitnessCenter', condType: 'monthly_count', condField: 'workoutCount', condValue: 16 },

  // ── m_meals series ──
  { id: 'm_meals_bronze', monthly: true, xp: 10, tier: 'bronze', series: 'm_meals', muiIcon: 'Restaurant', condType: 'monthly_count', condField: 'mealCount', condValue: 20 },
  { id: 'm_meals_silver', monthly: true, xp: 20, tier: 'silver', series: 'm_meals', muiIcon: 'Restaurant', condType: 'monthly_count', condField: 'mealCount', condValue: 40 },
  { id: 'm_meals_gold',   monthly: true, xp: 35, tier: 'gold',   series: 'm_meals', muiIcon: 'Restaurant', condType: 'monthly_count', condField: 'mealCount', condValue: 60 },

  // ── m_weights series ──
  { id: 'm_weights_bronze', monthly: true, xp: 10, tier: 'bronze', series: 'm_weights', muiIcon: 'MonitorWeight', condType: 'monthly_count', condField: 'weightCount', condValue: 7  },
  { id: 'm_weights_silver', monthly: true, xp: 20, tier: 'silver', series: 'm_weights', muiIcon: 'MonitorWeight', condType: 'monthly_count', condField: 'weightCount', condValue: 20 },
  { id: 'm_weights_gold',   monthly: true, xp: 35, tier: 'gold',   series: 'm_weights', muiIcon: 'MonitorWeight', condType: 'monthly_count', condField: 'weightCount', condValue: 30 },

  // ── m_streak series ──
  { id: 'm_streak_bronze', monthly: true, xp: 10, tier: 'bronze', series: 'm_streak', muiIcon: 'LocalFireDepartment', condType: 'monthly_streak', condValue: 7  },
  { id: 'm_streak_silver', monthly: true, xp: 20, tier: 'silver', series: 'm_streak', muiIcon: 'LocalFireDepartment', condType: 'monthly_streak', condValue: 20 },
  { id: 'm_streak_gold',   monthly: true, xp: 35, tier: 'gold',   series: 'm_streak', muiIcon: 'LocalFireDepartment', condType: 'monthly_streak', condValue: 30 },

  // ── m_steps series ──
  { id: 'm_steps_bronze', monthly: true, xp: 15, tier: 'bronze', series: 'm_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 200000 },
  { id: 'm_steps_silver', monthly: true, xp: 35, tier: 'silver', series: 'm_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 300000 },
  { id: 'm_steps_gold',   monthly: true, xp: 60, tier: 'gold',   series: 'm_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 450000 },

  // ── m_steps_days series ──
  { id: 'm_steps_days_bronze', monthly: true, xp: 10, tier: 'bronze', series: 'm_steps_days', muiIcon: 'DirectionsRun', condType: 'monthly_count', condField: 'stepsDays', condValue: 7  },
  { id: 'm_steps_days_silver', monthly: true, xp: 20, tier: 'silver', series: 'm_steps_days', muiIcon: 'DirectionsRun', condType: 'monthly_count', condField: 'stepsDays', condValue: 15 },
  { id: 'm_steps_days_gold',   monthly: true, xp: 35, tier: 'gold',   series: 'm_steps_days', muiIcon: 'DirectionsRun', condType: 'monthly_count', condField: 'stepsDays', condValue: 30 },

  // ── m_cal_target series ──
  { id: 'm_cal_target_bronze', monthly: true, xp: 30, tier: 'bronze', series: 'm_cal_target', muiIcon: 'LocalDining', condType: 'monthly_target', condField: 'calTargetDays', condValue: 7  },
  { id: 'm_cal_target_silver', monthly: true, xp: 50, tier: 'silver', series: 'm_cal_target', muiIcon: 'LocalDining', condType: 'monthly_target', condField: 'calTargetDays', condValue: 15 },
  { id: 'm_cal_target_gold',   monthly: true, xp: 80, tier: 'gold',   series: 'm_cal_target', muiIcon: 'LocalDining', condType: 'monthly_target', condField: 'calTargetDays', condValue: 30 },

  // ── m_prot_target series ──
  { id: 'm_prot_target_bronze', monthly: true, xp: 15, tier: 'bronze', series: 'm_prot_target', muiIcon: 'Egg', condType: 'monthly_target', condField: 'protTargetDays', condValue: 7  },
  { id: 'm_prot_target_silver', monthly: true, xp: 30, tier: 'silver', series: 'm_prot_target', muiIcon: 'Egg', condType: 'monthly_target', condField: 'protTargetDays', condValue: 15 },
  { id: 'm_prot_target_gold',   monthly: true, xp: 50, tier: 'gold',   series: 'm_prot_target', muiIcon: 'Egg', condType: 'monthly_target', condField: 'protTargetDays', condValue: 30 },
]

// Combined for backward compatibility
export const BADGES = [...ALLTIME_BADGES, ...MONTHLY_BADGES]


/* ───────────────────────────────────────────────────────────────
   Helper: current month key
   ─────────────────────────────────────────────────────────────── */

export function getCurrentMonthKey() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}


/* ───────────────────────────────────────────────────────────────
   Helper: collect ALL-TIME stats from a client object
   ─────────────────────────────────────────────────────────────── */

function collectStats(client) {
  const meals    = client.meals      || []
  const weights  = client.weightLogs || []
  const workouts = client.workouts   || []
  const steps    = client.stepsLogs  || []

  const mealDateSet    = new Set(meals.map(m => m.date))
  const weightDateSet  = new Set(weights.map(w => w.date))
  const workoutDateSet = new Set(workouts.map(w => w.date))
  const stepsDateSet   = new Set(steps.map(s => s.date))

  const allDateSet = new Set([...mealDateSet, ...weightDateSet, ...workoutDateSet, ...stepsDateSet])

  let totalSets = 0
  for (const w of workouts) totalSets += (w.items || []).length

  const streak = longestStreak(allDateSet)
  const wLoss  = weightLossFromPeak(weights)
  const hasPR  = hasStrengthPR(workouts)

  const calTargetDays  = targetDaysCount(meals, client.calorieTarget || 99999, 'kcal')
  const protTargetDays = targetDaysCount(meals, client.proteinTarget || 99999, 'protein')

  return {
    mealCount:      meals.length,
    weightCount:    weights.length,
    workoutCount:   workouts.length,
    stepsCount:     steps.length,
    mealDays:       mealDateSet.size,
    weightDays:     weightDateSet.size,
    stepsDays:      stepsDateSet.size,
    activeDays:     allDateSet.size,
    totalSets,
    streak,
    weightLoss:     wLoss,
    hasPR,
    calTargetDays,
    protTargetDays,
    consecutiveWorkoutMonths: consecutiveWorkoutMonths(workouts),
    hasAllRounder:  workouts.length >= 5 && meals.length >= 20 && weights.length >= 5,
  }
}


/* ───────────────────────────────────────────────────────────────
   Helper: collect MONTHLY stats for a single calendar month
   monthKey format: "YYYY-MM"
   ─────────────────────────────────────────────────────────────── */

function collectMonthlyStats(client, monthKey) {
  const [year, month] = monthKey.split('-')
  const matchMonth = (dateStr) => {
    const parts = String(dateStr || '').split('.')
    return parts.length === 3 && parts[1] === month && parts[2] === year
  }

  const meals    = (client.meals      || []).filter(m => matchMonth(m.date))
  const weights  = (client.weightLogs || []).filter(w => matchMonth(w.date))
  const workouts = (client.workouts   || []).filter(w => matchMonth(w.date))
  const steps    = (client.stepsLogs  || []).filter(s => matchMonth(s.date))

  const stepsDateSet = new Set(steps.map(s => s.date))
  const allDateSet = new Set([
    ...meals.map(m => m.date),
    ...weights.map(w => w.date),
    ...workouts.map(w => w.date),
    ...stepsDateSet,
  ])

  const totalSteps = steps.reduce((sum, s) => sum + Number(s.steps || 0), 0)
  const streak     = longestStreak(allDateSet)

  const calTargetDays  = targetDaysCount(meals, client.calorieTarget || 99999, 'kcal')
  const protTargetDays = targetDaysCount(meals, client.proteinTarget || 99999, 'protein')

  return {
    workoutCount: workouts.length,
    mealCount:    meals.length,
    weightCount:  weights.length,
    stepsDays:    stepsDateSet.size,
    totalSteps,
    streak,
    calTargetDays,
    protTargetDays,
  }
}


/* ───────────────────────────────────────────────────────────────
   Helper: extract all distinct month keys from client data
   ─────────────────────────────────────────────────────────────── */

function getDistinctMonthKeys(client) {
  const keys = new Set()
  const addDate = (dateStr) => {
    const parts = String(dateStr || '').split('.')
    if (parts.length === 3) keys.add(`${parts[2]}-${parts[1]}`)
  }
  ;(client.meals      || []).forEach(m => addDate(m.date))
  ;(client.weightLogs || []).forEach(w => addDate(w.date))
  ;(client.workouts   || []).forEach(w => addDate(w.date))
  ;(client.stepsLogs  || []).forEach(s => addDate(s.date))
  return [...keys].sort()
}


/* ═══════════════════════════════════════════════════════════════
   Personal Records (PR) — 4 tracked exercises, re-earnable
   ═══════════════════════════════════════════════════════════════ */

export const PR_EXERCISES = [
  { id: 'pr_squat', labelBg: 'Клек', labelEn: 'Squat', keywords: ['клек'], muiIcon: 'FitnessCenter', type: 'weight', unit: 'kg',
    milestones: [
      { v: 0,   label: 'Без тежест', xp: 5 },
      { v: 5,   label: '5kg',   xp: 5 },
      { v: 10,  label: '10kg',  xp: 5 },
      { v: 20,  label: '20kg',  xp: 10 },
      { v: 30,  label: '30kg',  xp: 10 },
      { v: 40,  label: '40kg',  xp: 10 },
      { v: 50,  label: '50kg',  xp: 15 },
      { v: 60,  label: '60kg',  xp: 15 },
      { v: 70,  label: '70kg',  xp: 15 },
      { v: 80,  label: '80kg',  xp: 20 },
      { v: 90,  label: '90kg',  xp: 20 },
      { v: 100, label: '100kg', xp: 25 },
    ],
  },
  { id: 'pr_bench', labelBg: 'Лежанка', labelEn: 'Bench Press', keywords: ['лежанка', 'лег', 'полулег', 'bench'], muiIcon: 'FitnessCenter', type: 'weight', unit: 'kg',
    milestones: [
      { v: 20, label: '20kg', xp: 10 },
      { v: 30, label: '30kg', xp: 10 },
      { v: 40, label: '40kg', xp: 15 },
      { v: 50, label: '50kg', xp: 15 },
      { v: 60, label: '60kg', xp: 20 },
    ],
  },
  { id: 'pr_pushups_knee', labelBg: 'Л.О. от колене', labelEn: 'Knee Push-ups', keywords: ['колене'], muiIcon: 'FitnessCenter', type: 'reps', unit: '',
    milestones: [
      { v: 5,  label: '5п',  xp: 5 },
      { v: 10, label: '10п', xp: 5 },
      { v: 15, label: '15п', xp: 10 },
    ],
  },
  { id: 'pr_pushups', labelBg: 'Лицеви опори', labelEn: 'Push-ups', keywords: ['лицеви', 'л.о'], excludeKeywords: ['колене', 'пейка'], muiIcon: 'FitnessCenter', type: 'reps', unit: '',
    milestones: [
      { v: 3,  label: '3п',  xp: 5 },
      { v: 5,  label: '5п',  xp: 5 },
      { v: 8,  label: '8п',  xp: 10 },
      { v: 10, label: '10п', xp: 10 },
      { v: 12, label: '12п', xp: 10 },
      { v: 15, label: '15п', xp: 15 },
      { v: 20, label: '20п', xp: 20 },
    ],
  },
  { id: 'pr_pullups_band', labelBg: 'Набирания с ластик', labelEn: 'Band Pull-ups', keywords: ['ластик'], muiIcon: 'FitnessCenter', type: 'reps', unit: '',
    milestones: [
      { v: 5,  label: '5п',  xp: 5 },
      { v: 10, label: '10п', xp: 5 },
    ],
  },
  { id: 'pr_pullups', labelBg: 'Набирания', labelEn: 'Pull-ups', keywords: ['набирания', 'набиране'], excludeKeywords: ['ластик'], muiIcon: 'FitnessCenter', type: 'reps', unit: '',
    milestones: [
      { v: 1,  label: '1п',  xp: 5 },
      { v: 3,  label: '3п',  xp: 10 },
      { v: 5,  label: '5п',  xp: 10 },
      { v: 10, label: '10п', xp: 15 },
      { v: 15, label: '15п', xp: 20 },
      { v: 20, label: '20п', xp: 25 },
    ],
  },
]

/** Check if exercise name matches keywords but not excludeKeywords */
function matchesExercise(name, keywords, excludeKeywords) {
  if (!keywords.some(kw => name.includes(kw))) return false
  if (excludeKeywords && excludeKeywords.some(kw => name.includes(kw))) return false
  return true
}

/** Get best weight for a PR exercise (fuzzy keyword match). Returns -1 if exercise never done. */
function getBestWeight(workouts, keywords, excludeKeywords) {
  let best = -1
  for (const w of (workouts || [])) {
    for (const item of (w.items || [])) {
      const name = (item.exercise || '').toLowerCase().trim()
      if (!name) continue
      if (!matchesExercise(name, keywords, excludeKeywords)) continue
      const weight = parseFloat(item.weight) || 0
      if (weight > best) best = weight
    }
  }
  return best
}

/** Get best reps for a bodyweight PR exercise (parse scheme like "3x15" or "3х15"). Returns -1 if never done. */
function getBestReps(workouts, keywords, excludeKeywords) {
  let best = -1
  for (const w of (workouts || [])) {
    for (const item of (w.items || [])) {
      const name = (item.exercise || '').toLowerCase().trim()
      if (!name) continue
      if (!matchesExercise(name, keywords, excludeKeywords)) continue
      const scheme = (item.scheme || '').toLowerCase().trim()
      const match = scheme.match(/[xх](\d+)/)
      const reps = match ? parseInt(match[1]) : parseInt(scheme) || 0
      if (reps > best) best = reps
    }
  }
  return best
}

/** Get current best value for each PR exercise + unlocked milestone indices.
 *  Any milestone whose value <= best is unlocked (non-sequential). */
export function getCurrentPRs(workouts) {
  const result = {}
  for (const ex of PR_EXERCISES) {
    const best = ex.type === 'weight' ? getBestWeight(workouts, ex.keywords, ex.excludeKeywords) : getBestReps(workouts, ex.keywords, ex.excludeKeywords)
    const unlockedIdx = []
    for (let i = 0; i < ex.milestones.length; i++) {
      if (best >= ex.milestones[i].v) unlockedIdx.push(i)
    }
    const totalXP = unlockedIdx.reduce((s, i) => s + ex.milestones[i].xp, 0)
    result[ex.id] = { best, unlockedIdx, totalXP, count: unlockedIdx.length, total: ex.milestones.length }
  }
  return result
}


/* ── Longest consecutive-day streak ──────────────────────────── */
function longestStreak(dateSet) {
  if (dateSet.size === 0) return 0
  const sorted = [...dateSet].map(d => parseDate(d).getTime()).sort((a, b) => a - b)
  const unique = [...new Set(sorted)]
  let max = 1, cur = 1
  for (let i = 1; i < unique.length; i++) {
    const diff = unique[i] - unique[i - 1]
    if (diff <= 86400000 && diff > 0) { cur++; if (cur > max) max = cur }
    else cur = 1
  }
  return max
}


/* ── Weight loss from peak ───────────────────────────────────── */
function weightLossFromPeak(weightLogs) {
  if (weightLogs.length < 2) return 0
  const sorted = [...weightLogs].sort((a, b) => parseDate(a.date) - parseDate(b.date))
  const peak = Math.max(...sorted.map(w => Number(w.weight)))
  const latest = Number(sorted[sorted.length - 1].weight)
  return Math.max(peak - latest, 0)
}


/* ── Strength PR detection (fuzzy name matching) ─────────────── */
// Find canonical key: if "клек" already exists and new name is "клек с щанга",
// return "клек". Works both ways — shorter name wins.
function findExerciseKey(name, bestByExercise) {
  for (const existing of Object.keys(bestByExercise)) {
    if (name.includes(existing) || existing.includes(name)) return existing
  }
  return name
}

function hasStrengthPR(workouts) {
  if (workouts.length < 2) return false
  // Sort ascending: by date, then reverse original index (original array is desc by created_at)
  const indexed = workouts.map((w, i) => ({ ...w, _i: i }))
  indexed.sort((a, b) => {
    const d = parseDate(a.date) - parseDate(b.date)
    if (d !== 0) return d
    return b._i - a._i // same date: higher original index = older = comes first
  })
  const bestByExercise = {}
  for (const w of indexed) {
    for (const item of (w.items || [])) {
      const name = (item.exercise || '').toLowerCase().trim()
      if (!name) continue
      const weight = parseFloat(item.weight) || 0
      if (weight <= 0) continue
      const key = findExerciseKey(name, bestByExercise)
      if (bestByExercise[key] !== undefined && weight > bestByExercise[key]) return true
      if (bestByExercise[key] === undefined || weight > bestByExercise[key]) {
        bestByExercise[key] = weight
      }
    }
  }
  return false
}


/* ── Count days where daily total >= target ──────────────────── */
function targetDaysCount(meals, target, field) {
  const byDate = {}
  for (const m of meals) {
    byDate[m.date] = (byDate[m.date] || 0) + Number(m[field] || 0)
  }
  return Object.values(byDate).filter(v => v >= target).length
}


/* ── Consecutive months with at least 8 workouts each ─────────── */
function consecutiveWorkoutMonths(workouts) {
  if (workouts.length === 0) return 0
  const byMonth = {}
  for (const w of workouts) {
    const parts = String(w.date || '').split('.')
    if (parts.length === 3) {
      const mk = `${parts[2]}-${parts[1]}`
      byMonth[mk] = (byMonth[mk] || 0) + 1
    }
  }
  // Only months with 8+ workouts qualify
  const qualifying = Object.keys(byMonth).filter(mk => byMonth[mk] >= 8).sort()
  if (qualifying.length === 0) return 0
  let max = 1, cur = 1
  for (let i = 1; i < qualifying.length; i++) {
    const [py, pm] = qualifying[i - 1].split('-').map(Number)
    const expected = pm === 12 ? `${py + 1}-01` : `${py}-${String(pm + 1).padStart(2, '0')}`
    if (qualifying[i] === expected) { cur++; if (cur > max) max = cur }
    else cur = 1
  }
  return max
}


/* ═══════════════════════════════════════════════════════════════
   Monthly badge evaluation
   ═══════════════════════════════════════════════════════════════ */

function checkMonthlyBadge(badge, monthStats) {
  switch (badge.condType) {
    case 'monthly_count':
      return (monthStats[badge.condField] || 0) >= badge.condValue
    case 'monthly_streak':
      return monthStats.streak >= badge.condValue
    case 'monthly_steps':
      return monthStats.totalSteps >= badge.condValue
    case 'monthly_target':
      return (monthStats[badge.condField] || 0) >= badge.condValue
    default:
      return false
  }
}

/** Evaluate which monthly badges are earned for a specific month */
export function evaluateMonthlyBadgesForMonth(client, monthKey) {
  const stats = collectMonthlyStats(client, monthKey)
  const earned = []
  for (const b of MONTHLY_BADGES) {
    if (checkMonthlyBadge(b, stats)) earned.push(b.id)
  }
  return earned
}

/** Evaluate ALL monthly badges across ALL months → [{ badgeId, monthKey }] */
export function evaluateAllMonthlyBadges(client) {
  const monthKeys = getDistinctMonthKeys(client)
  const results = []
  for (const mk of monthKeys) {
    const earned = evaluateMonthlyBadgesForMonth(client, mk)
    for (const badgeId of earned) {
      results.push({ badgeId, monthKey: mk })
    }
  }
  return results
}

/** Generalized monthly badge history grouped by month */
export function getMonthlyBadgeHistory(client) {
  const results = evaluateAllMonthlyBadges(client)
  const byMonth = {}
  for (const r of results) {
    const b = MONTHLY_BADGES.find(x => x.id === r.badgeId)
    if (!b) continue
    if (!byMonth[r.monthKey]) byMonth[r.monthKey] = []
    byMonth[r.monthKey].push({ badgeId: r.badgeId, monthKey: r.monthKey, tier: b.tier, series: b.series, xp: b.xp })
  }
  return byMonth
}


/* ═══════════════════════════════════════════════════════════════
   evaluateBadges — returns array of ALL-TIME earned badge IDs
   ═══════════════════════════════════════════════════════════════ */

export function evaluateBadges(client) {
  const stats = collectStats(client)
  const earned = []

  // all-time badges (non-meta)
  for (const b of ALLTIME_BADGES) {
    if (b.condType === 'meta') continue
    if (checkBadge(b, stats)) earned.push(b.id)
  }

  // meta badges: depend on combined all-time + all historical monthly XP
  const alltimeXP = earned.reduce((s, id) => {
    const b = ALLTIME_BADGES.find(x => x.id === id)
    return s + (b ? b.xp : 0)
  }, 0)
  const allMonthly = evaluateAllMonthlyBadges(client)
  const monthlyXPTotal = allMonthly.reduce((s, r) => {
    const b = MONTHLY_BADGES.find(x => x.id === r.badgeId)
    return s + (b ? b.xp : 0)
  }, 0)
  const combinedXP = alltimeXP + monthlyXPTotal

  for (const b of ALLTIME_BADGES) {
    if (b.condType !== 'meta') continue
    if (combinedXP >= b.condValue) earned.push(b.id)
  }

  return earned
}

function checkBadge(badge, stats) {
  switch (badge.condType) {
    case 'count':
      return (stats[badge.condField] || 0) >= badge.condValue
    case 'weight_loss':
      return stats.weightLoss >= badge.condValue
    case 'strength_pr':  // legacy, kept for compatibility
      return stats.hasPR
    case 'streak':
      return stats.streak >= badge.condValue
    case 'target_days':
      return (stats[badge.condField] || 0) >= badge.condValue
    case 'compound':
      return stats.hasAllRounder
    case 'consecutive_workout_months':
      return stats.consecutiveWorkoutMonths >= badge.condValue
    default:
      return false
  }
}


/* ═══════════════════════════════════════════════════════════════
   getBadgeProgress — returns { current, target } for a single badge
   ═══════════════════════════════════════════════════════════════ */

export function getBadgeProgress(badge, client) {
  // Monthly badges use current month stats
  if (badge.monthly) {
    const mk    = getCurrentMonthKey()
    const stats = collectMonthlyStats(client, mk)
    switch (badge.condType) {
      case 'monthly_count':
        return { current: Math.min(stats[badge.condField] || 0, badge.condValue), target: badge.condValue }
      case 'monthly_streak':
        return { current: Math.min(stats.streak, badge.condValue), target: badge.condValue }
      case 'monthly_steps':
        return { current: Math.min(stats.totalSteps, badge.condValue), target: badge.condValue }
      case 'monthly_target':
        return { current: Math.min(stats[badge.condField] || 0, badge.condValue), target: badge.condValue }
      default:
        return { current: 0, target: 1 }
    }
  }

  // All-time badges
  const stats = collectStats(client)
  switch (badge.condType) {
    case 'count':
      return { current: Math.min(stats[badge.condField] || 0, badge.condValue), target: badge.condValue }
    case 'weight_loss':
      return { current: Math.min(Number(stats.weightLoss.toFixed(1)), badge.condValue), target: badge.condValue }
    case 'strength_pr':
      return { current: stats.hasPR ? 1 : 0, target: 1 }
    case 'streak':
      return { current: Math.min(stats.streak, badge.condValue), target: badge.condValue }
    case 'target_days':
      return { current: Math.min(stats[badge.condField] || 0, badge.condValue), target: badge.condValue }
    case 'compound':
      return { current: stats.hasAllRounder ? 1 : 0, target: 1 }
    case 'consecutive_workout_months':
      return { current: Math.min(stats.consecutiveWorkoutMonths, badge.condValue), target: badge.condValue }
    case 'meta': {
      const earned = evaluateBadges(client).filter(id => id !== badge.id)
      const alltimeXP = earned.reduce((s, id) => { const b = ALLTIME_BADGES.find(x => x.id === id); return s + (b ? b.xp : 0) }, 0)
      const allMonthly = evaluateAllMonthlyBadges(client)
      const monthlyXP = allMonthly.reduce((s, r) => { const b = MONTHLY_BADGES.find(x => x.id === r.badgeId); return s + (b ? b.xp : 0) }, 0)
      const total = alltimeXP + monthlyXP
      return { current: Math.min(total, badge.condValue), target: badge.condValue }
    }
    default:
      return { current: 0, target: 1 }
  }
}


/* ═══════════════════════════════════════════════════════════════
   XP & Level
   ═══════════════════════════════════════════════════════════════ */

/** All-time XP = all-time badge XP + ALL historical monthly badge XP */
export function computeTotalXP(earnedIds, client) {
  // XP from all-time badges
  let total = earnedIds.reduce((sum, id) => {
    const b = ALLTIME_BADGES.find(x => x.id === id)
    return sum + (b ? b.xp : 0)
  }, 0)

  // XP from ALL monthly badges across ALL months
  if (client) {
    const allMonthly = evaluateAllMonthlyBadges(client)
    for (const r of allMonthly) {
      const b = MONTHLY_BADGES.find(x => x.id === r.badgeId)
      if (b) total += b.xp
    }
  }

  return total
}

/** Monthly XP = XP from current month's monthly badges only */
export function computeMonthlyXP(client) {
  const mk = getCurrentMonthKey()
  const earned = evaluateMonthlyBadgesForMonth(client, mk)
  return earned.reduce((sum, id) => {
    const b = MONTHLY_BADGES.find(x => x.id === id)
    return sum + (b ? b.xp : 0)
  }, 0)
}

export function computeLevel(totalXP) {
  let level = 1
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    if (totalXP >= LEVEL_THRESHOLDS[i]) level = i + 1
    else break
  }
  const currentThreshold = LEVEL_THRESHOLDS[level - 1] || 0
  const nextThreshold    = LEVEL_THRESHOLDS[level] || (currentThreshold + 1000)
  const xpIntoLevel      = totalXP - currentThreshold
  const xpForLevel       = nextThreshold - currentThreshold
  const progress         = xpForLevel > 0 ? Math.min(xpIntoLevel / xpForLevel, 1) : 1
  return { level, totalXP, xpIntoLevel, xpForLevel, progress, nextThreshold }
}

export function getLevelName(level, lang) {
  const names = LEVEL_NAMES[lang] || LEVEL_NAMES.en
  const idx = Math.min(level - 1, names.length - 1)
  return names[Math.max(0, idx)]
}


/* ═══════════════════════════════════════════════════════════════
   getNextBadges — closest-to-unlock unearned badges (all-time + monthly)
   ═══════════════════════════════════════════════════════════════ */

export function getNextBadges(client, earnedIds, limit = 3) {
  const earnedSet = new Set(earnedIds)

  // Unearned all-time badges
  const unearnedAllTime = ALLTIME_BADGES.filter(b => !earnedSet.has(b.id))

  // Unearned monthly badges for current month
  const mk = getCurrentMonthKey()
  const monthlyEarned = new Set(evaluateMonthlyBadgesForMonth(client, mk))
  const unearnedMonthly = MONTHLY_BADGES.filter(b => !monthlyEarned.has(b.id))

  const allUnearned = [...unearnedAllTime, ...unearnedMonthly]

  const withProgress = allUnearned.map(badge => {
    const { current, target } = getBadgeProgress(badge, client)
    const ratio = target > 0 ? current / target : 0
    return { badge, current, target, progress: ratio }
  })

  withProgress.sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress
    return a.badge.xp - b.badge.xp
  })

  return withProgress.slice(0, limit)
}


/* ═══════════════════════════════════════════════════════════════
   computeXPRanking — ranked by MONTHLY XP
   ═══════════════════════════════════════════════════════════════ */

export function computeXPRanking(clients) {
  const mk = getCurrentMonthKey()
  return clients.map(c => {
    const earnedIds       = evaluateBadges(c)
    const totalXP         = computeTotalXP(earnedIds, c)
    const monthlyXP       = computeMonthlyXP(c)
    const levelData       = computeLevel(totalXP)
    const monthlyEarnedIds = evaluateMonthlyBadgesForMonth(c, mk)
    return {
      name:             c.name,
      clientId:         c.id,
      xp:               monthlyXP,       // ranking uses monthly XP
      totalXP,                            // for profile dialog
      level:            levelData.level,
      badgeCount:       earnedIds.length,
      earnedIds,
      monthlyEarnedIds,
    }
  }).sort((a, b) => b.xp - a.xp)
}
