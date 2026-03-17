/* ═══════════════════════════════════════════════════════════════
   SYNRG Gamification Engine
   Badges + XP + Levels — computed from existing client data
   ═══════════════════════════════════════════════════════════════ */

import { parseDate } from './utils'

// ── Level thresholds ──────────────────────────────────────────
export const LEVEL_THRESHOLDS = [
  0, 20, 50, 100, 180, 300, 450, 650, 900, 1200,
  1550, 1950, 2400, 2900, 3500, 4200, 5000, 5900, 6900, 8000,
]

export const LEVEL_NAMES = {
  bg: ['Начинаещ','Активен','Посветен','Устойчив','Последователен',
       'Силен','Дисциплиниран','Опитен','Елит','Легенда'],
  en: ['Newcomer','Active','Dedicated','Committed','Consistent',
       'Strong','Disciplined','Experienced','Elite','Legend'],
}

// ── Badge categories ──────────────────────────────────────────
export const BADGE_CATEGORIES = [
  { key: 'onboarding',   labelBg: 'Начало',            labelEn: 'Getting Started', accent: 'primary' },
  { key: 'consistency',  labelBg: 'Последователност',   labelEn: 'Consistency',     accent: 'purple'  },
  { key: 'weight_loss',  labelBg: 'Отслабване',         labelEn: 'Weight Loss',     accent: 'primary' },
  { key: 'strength',     labelBg: 'Сила',               labelEn: 'Strength',        accent: 'orange'  },
  { key: 'special',      labelBg: 'Специални',          labelEn: 'Special',         accent: 'purple'  },
]

// ── Badge definitions ─────────────────────────────────────────
//  condition_type values:
//    count          – compare a computed count against condition_value
//    weight_loss    – peak weight minus latest weight
//    strength_pr    – boolean (has any exercise PR)
//    streak         – longest consecutive-day streak
//    target_days    – days where daily total >= client target
//    compound       – custom multi-field check
//    meta           – depends on other badges' XP

export const BADGES = [
  // ── ONBOARDING ──
  { id: 'first_weight_log',   category: 'onboarding', xp: 5,   icon: 'W',  condType: 'count', condField: 'weightCount',     condValue: 1  },
  { id: 'first_food_log',     category: 'onboarding', xp: 5,   icon: 'F',  condType: 'count', condField: 'mealCount',       condValue: 1  },
  { id: 'first_workout',      category: 'onboarding', xp: 10,  icon: 'T',  condType: 'count', condField: 'workoutCount',    condValue: 1  },
  { id: 'three_days_tracking', category: 'onboarding', xp: 10, icon: '3D', condType: 'count', condField: 'activeDays',      condValue: 3  },
  { id: 'first_week_active',  category: 'onboarding', xp: 15,  icon: '1W', condType: 'count', condField: 'bestWindowOf7',   condValue: 5  },

  // ── CONSISTENCY ──
  { id: 'food_7_days',        category: 'consistency', xp: 15,  icon: '7F',  condType: 'count', condField: 'mealDays',       condValue: 7   },
  { id: 'weight_7_days',      category: 'consistency', xp: 15,  icon: '7W',  condType: 'count', condField: 'weightDays',     condValue: 7   },
  { id: 'ten_workouts',       category: 'consistency', xp: 20,  icon: '10',  condType: 'count', condField: 'workoutCount',   condValue: 10  },
  { id: 'twenty_workouts',    category: 'consistency', xp: 30,  icon: '20',  condType: 'count', condField: 'workoutCount',   condValue: 20  },
  { id: 'thirty_days_active', category: 'consistency', xp: 25,  icon: '30',  condType: 'count', condField: 'activeDays',     condValue: 30  },
  { id: 'fifty_meals',        category: 'consistency', xp: 25,  icon: '50',  condType: 'count', condField: 'mealCount',      condValue: 50  },
  { id: 'hundred_meals',      category: 'consistency', xp: 30,  icon: '100', condType: 'count', condField: 'mealCount',      condValue: 100 },

  // ── WEIGHT LOSS ──
  { id: 'lost_1kg',  category: 'weight_loss', xp: 15,  icon: '-1',  condType: 'weight_loss', condValue: 1  },
  { id: 'lost_3kg',  category: 'weight_loss', xp: 30,  icon: '-3',  condType: 'weight_loss', condValue: 3  },
  { id: 'lost_5kg',  category: 'weight_loss', xp: 50,  icon: '-5',  condType: 'weight_loss', condValue: 5  },
  { id: 'lost_10kg', category: 'weight_loss', xp: 100, icon: '-10', condType: 'weight_loss', condValue: 10 },

  // ── STRENGTH ──
  { id: 'first_pr',           category: 'strength', xp: 25, icon: 'PR',  condType: 'strength_pr', condValue: 1   },
  { id: 'fifty_sets',         category: 'strength', xp: 25, icon: '50',  condType: 'count', condField: 'totalSets', condValue: 50  },
  { id: 'hundred_sets',       category: 'strength', xp: 40, icon: '100', condType: 'count', condField: 'totalSets', condValue: 100 },
  { id: 'two_hundred_sets',   category: 'strength', xp: 50, icon: '200', condType: 'count', condField: 'totalSets', condValue: 200 },

  // ── SPECIAL ──
  { id: 'streak_7',       category: 'special', xp: 20,  icon: 'S7',  condType: 'streak', condValue: 7  },
  { id: 'streak_14',      category: 'special', xp: 35,  icon: 'S14', condType: 'streak', condValue: 14 },
  { id: 'streak_30',      category: 'special', xp: 50,  icon: 'S30', condType: 'streak', condValue: 30 },
  { id: 'cal_target_7',   category: 'special', xp: 20,  icon: 'KC',  condType: 'target_days', condField: 'calTargetDays',  condValue: 7  },
  { id: 'prot_target_7',  category: 'special', xp: 20,  icon: 'P7',  condType: 'target_days', condField: 'protTargetDays', condValue: 7  },
  { id: 'cal_target_14',  category: 'special', xp: 35,  icon: 'K14', condType: 'target_days', condField: 'calTargetDays',  condValue: 14 },
  { id: 'all_rounder',    category: 'special', xp: 40,  icon: 'AR',  condType: 'compound',    condValue: 1  },
  { id: 'century_club',   category: 'special', xp: 50,  icon: 'CC',  condType: 'meta',        condValue: 100 },
]


/* ───────────────────────────────────────────────────────────────
   Helper: collect stats from a client object
   ─────────────────────────────────────────────────────────────── */

function collectStats(client) {
  const meals    = client.meals    || []
  const weights  = client.weightLogs || []
  const workouts = client.workouts || []

  // unique dates per data source
  const mealDateSet    = new Set(meals.map(m => m.date))
  const weightDateSet  = new Set(weights.map(w => w.date))
  const workoutDateSet = new Set(workouts.map(w => w.date))

  // combined unique activity dates
  const allDateSet = new Set([...mealDateSet, ...weightDateSet, ...workoutDateSet])

  // total exercise items (sets) across all workouts
  let totalSets = 0
  for (const w of workouts) totalSets += (w.items || []).length

  // best 7-day window: max distinct active days within any sliding 7-day window
  const bestWindowOf7 = bestWindow(allDateSet, 7)

  // longest consecutive streak
  const streak = longestStreak(allDateSet)

  // weight loss from peak
  const wLoss = weightLossFromPeak(weights)

  // strength PR check
  const hasPR = hasStrengthPR(workouts)

  // calorie / protein target days
  const calTargetDays  = targetDaysCount(meals, client.calorieTarget || 99999, 'kcal')
  const protTargetDays = targetDaysCount(meals, client.proteinTarget || 99999, 'protein')

  return {
    mealCount:      meals.length,
    weightCount:    weights.length,
    workoutCount:   workouts.length,
    mealDays:       mealDateSet.size,
    weightDays:     weightDateSet.size,
    activeDays:     allDateSet.size,
    totalSets,
    bestWindowOf7,
    streak,
    weightLoss:     wLoss,
    hasPR,
    calTargetDays,
    protTargetDays,
    // for compound: all_rounder
    hasAllRounder:  workouts.length >= 5 && meals.length >= 20 && weights.length >= 5,
  }
}


/* ── Sliding window: max distinct dates in any N-day window ──── */
function bestWindow(dateSet, windowSize) {
  if (dateSet.size === 0) return 0
  const sorted = [...dateSet].map(d => parseDate(d).getTime()).sort((a, b) => a - b)
  const windowMs = (windowSize - 1) * 86400000
  let best = 1
  let left = 0
  for (let right = 0; right < sorted.length; right++) {
    while (sorted[right] - sorted[left] > windowMs) left++
    best = Math.max(best, right - left + 1)
  }
  return best
}


/* ── Longest consecutive-day streak ──────────────────────────── */
function longestStreak(dateSet) {
  if (dateSet.size === 0) return 0
  const sorted = [...dateSet].map(d => parseDate(d).getTime()).sort((a, b) => a - b)
  // deduplicate in case parseDate gives same ms for same day
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


/* ── Strength PR detection ───────────────────────────────────── */
function hasStrengthPR(workouts) {
  if (workouts.length < 2) return false
  const sorted = [...workouts].sort((a, b) => parseDate(a.date) - parseDate(b.date))
  const bestByExercise = {}
  for (const w of sorted) {
    for (const item of (w.items || [])) {
      const name = (item.exercise || '').toLowerCase().trim()
      if (!name) continue
      const weight = parseFloat(item.weight) || 0
      if (weight <= 0) continue
      if (bestByExercise[name] !== undefined && weight > bestByExercise[name]) return true
      if (bestByExercise[name] === undefined || weight > bestByExercise[name]) {
        bestByExercise[name] = weight
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


/* ═══════════════════════════════════════════════════════════════
   evaluateBadges — returns array of earned badge IDs
   ═══════════════════════════════════════════════════════════════ */

export function evaluateBadges(client) {
  const stats = collectStats(client)
  const earned = []

  // first pass: all non-meta badges
  for (const b of BADGES) {
    if (b.condType === 'meta') continue
    if (checkBadge(b, stats)) earned.push(b.id)
  }

  // second pass: meta badges (depend on earned XP from first pass)
  const xpSoFar = earned.reduce((s, id) => {
    const b = BADGES.find(x => x.id === id)
    return s + (b ? b.xp : 0)
  }, 0)

  for (const b of BADGES) {
    if (b.condType !== 'meta') continue
    if (xpSoFar >= b.condValue) earned.push(b.id)
  }

  return earned
}

function checkBadge(badge, stats) {
  switch (badge.condType) {
    case 'count':
      return (stats[badge.condField] || 0) >= badge.condValue
    case 'weight_loss':
      return stats.weightLoss >= badge.condValue
    case 'strength_pr':
      return stats.hasPR
    case 'streak':
      return stats.streak >= badge.condValue
    case 'target_days':
      return (stats[badge.condField] || 0) >= badge.condValue
    case 'compound':
      return stats.hasAllRounder
    default:
      return false
  }
}


/* ═══════════════════════════════════════════════════════════════
   getProgress — returns { current, target } for a single badge
   ═══════════════════════════════════════════════════════════════ */

export function getBadgeProgress(badge, client) {
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
    case 'meta': {
      const earned = evaluateBadges(client).filter(id => id !== badge.id)
      const xp = earned.reduce((s, id) => { const b = BADGES.find(x => x.id === id); return s + (b ? b.xp : 0) }, 0)
      return { current: Math.min(xp, badge.condValue), target: badge.condValue }
    }
    default:
      return { current: 0, target: 1 }
  }
}


/* ═══════════════════════════════════════════════════════════════
   XP & Level
   ═══════════════════════════════════════════════════════════════ */

export function computeTotalXP(earnedIds) {
  return earnedIds.reduce((sum, id) => {
    const b = BADGES.find(x => x.id === id)
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
  const tier = Math.min(Math.floor((level - 1) / 2), names.length - 1)
  return names[tier]
}


/* ═══════════════════════════════════════════════════════════════
   getNextBadges — closest-to-unlock unearned badges
   ═══════════════════════════════════════════════════════════════ */

export function getNextBadges(client, earnedIds, limit = 3) {
  const earnedSet = new Set(earnedIds)
  const unearned = BADGES.filter(b => !earnedSet.has(b.id))

  const withProgress = unearned.map(badge => {
    const { current, target } = getBadgeProgress(badge, client)
    const ratio = target > 0 ? current / target : 0
    return { badge, current, target, progress: ratio }
  })

  // sort by progress descending (closest to completion first), then by XP ascending (easier first)
  withProgress.sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress
    return a.badge.xp - b.badge.xp
  })

  return withProgress.slice(0, limit)
}
