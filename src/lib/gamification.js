/* ═══════════════════════════════════════════════════════════════
   SYNRG Gamification Engine v2
   Tiered badges (Bronze/Silver/Gold) + XP + 20 Levels
   Monthly step badges + XP-based ranking
   ═══════════════════════════════════════════════════════════════ */

import { parseDate } from './utils'

// ── Level thresholds (20 levels) ────────────────────────────
export const LEVEL_THRESHOLDS = [
  0, 20, 50, 100, 180, 300, 450, 650, 900, 1200,
  1550, 1950, 2400, 2900, 3500, 4200, 5000, 5900, 6900, 8000,
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

// ── Badge definitions ───────────────────────────────────────
//  Fields: id, category, xp, tier (bronze/silver/gold/null),
//          series (group name/null), muiIcon (MUI icon name),
//          condType, condField, condValue
//
//  condType values:
//    count         – compare condField stat against condValue
//    weight_loss   – peak weight minus latest weight
//    strength_pr   – boolean (has any exercise PR)
//    streak        – longest consecutive-day streak
//    target_days   – days where daily total >= client target
//    compound      – custom multi-field check
//    meta          – depends on other badges' total XP
//    monthly_steps – total steps in a calendar month

export const BADGES = [
  // ── WORKOUTS series ──
  { id: 'workouts_bronze', category: 'consistency', xp: 10, tier: 'bronze', series: 'workouts', muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 5  },
  { id: 'workouts_silver', category: 'consistency', xp: 25, tier: 'silver', series: 'workouts', muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 20 },
  { id: 'workouts_gold',   category: 'consistency', xp: 50, tier: 'gold',   series: 'workouts', muiIcon: 'FitnessCenter', condType: 'count', condField: 'workoutCount', condValue: 50 },

  // ── MEALS series ──
  { id: 'meals_bronze', category: 'consistency', xp: 10, tier: 'bronze', series: 'meals', muiIcon: 'Restaurant', condType: 'count', condField: 'mealCount', condValue: 20  },
  { id: 'meals_silver', category: 'consistency', xp: 25, tier: 'silver', series: 'meals', muiIcon: 'Restaurant', condType: 'count', condField: 'mealCount', condValue: 50  },
  { id: 'meals_gold',   category: 'consistency', xp: 50, tier: 'gold',   series: 'meals', muiIcon: 'Restaurant', condType: 'count', condField: 'mealCount', condValue: 100 },

  // ── WEIGHT LOGS series ──
  { id: 'weight_logs_bronze', category: 'consistency', xp: 10, tier: 'bronze', series: 'weight_logs', muiIcon: 'MonitorWeight', condType: 'count', condField: 'weightCount', condValue: 5  },
  { id: 'weight_logs_silver', category: 'consistency', xp: 20, tier: 'silver', series: 'weight_logs', muiIcon: 'MonitorWeight', condType: 'count', condField: 'weightCount', condValue: 15 },
  { id: 'weight_logs_gold',   category: 'consistency', xp: 40, tier: 'gold',   series: 'weight_logs', muiIcon: 'MonitorWeight', condType: 'count', condField: 'weightCount', condValue: 30 },

  // ── STEPS DAYS series ──
  { id: 'steps_days_bronze', category: 'consistency', xp: 10, tier: 'bronze', series: 'steps_days', muiIcon: 'DirectionsRun', condType: 'count', condField: 'stepsDays', condValue: 7  },
  { id: 'steps_days_silver', category: 'consistency', xp: 20, tier: 'silver', series: 'steps_days', muiIcon: 'DirectionsRun', condType: 'count', condField: 'stepsDays', condValue: 15 },
  { id: 'steps_days_gold',   category: 'consistency', xp: 40, tier: 'gold',   series: 'steps_days', muiIcon: 'DirectionsRun', condType: 'count', condField: 'stepsDays', condValue: 30 },

  // ── WEIGHT LOSS series ──
  { id: 'weight_loss_bronze', category: 'weight_loss', xp: 15, tier: 'bronze', series: 'weight_loss', muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 1  },
  { id: 'weight_loss_silver', category: 'weight_loss', xp: 35, tier: 'silver', series: 'weight_loss', muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 5  },
  { id: 'weight_loss_gold',   category: 'weight_loss', xp: 60, tier: 'gold',   series: 'weight_loss', muiIcon: 'TrendingDown', condType: 'weight_loss', condValue: 10 },

  // ── SETS series ──
  { id: 'sets_bronze', category: 'strength', xp: 10, tier: 'bronze', series: 'sets', muiIcon: 'FitnessCenter', condType: 'count', condField: 'totalSets', condValue: 50  },
  { id: 'sets_silver', category: 'strength', xp: 25, tier: 'silver', series: 'sets', muiIcon: 'FitnessCenter', condType: 'count', condField: 'totalSets', condValue: 150 },
  { id: 'sets_gold',   category: 'strength', xp: 50, tier: 'gold',   series: 'sets', muiIcon: 'FitnessCenter', condType: 'count', condField: 'totalSets', condValue: 300 },

  // ── STREAK series ──
  { id: 'streak_bronze', category: 'special', xp: 15, tier: 'bronze', series: 'streak', muiIcon: 'LocalFireDepartment', condType: 'streak', condValue: 7  },
  { id: 'streak_silver', category: 'special', xp: 30, tier: 'silver', series: 'streak', muiIcon: 'LocalFireDepartment', condType: 'streak', condValue: 14 },
  { id: 'streak_gold',   category: 'special', xp: 50, tier: 'gold',   series: 'streak', muiIcon: 'LocalFireDepartment', condType: 'streak', condValue: 30 },

  // ── ACTIVE DAYS series ──
  { id: 'active_days_bronze', category: 'consistency', xp: 10, tier: 'bronze', series: 'active_days', muiIcon: 'EventAvailable', condType: 'count', condField: 'activeDays', condValue: 10 },
  { id: 'active_days_silver', category: 'consistency', xp: 25, tier: 'silver', series: 'active_days', muiIcon: 'EventAvailable', condType: 'count', condField: 'activeDays', condValue: 30 },
  { id: 'active_days_gold',   category: 'consistency', xp: 50, tier: 'gold',   series: 'active_days', muiIcon: 'EventAvailable', condType: 'count', condField: 'activeDays', condValue: 60 },

  // ── CAL TARGET series ──
  { id: 'cal_target_bronze', category: 'special', xp: 15, tier: 'bronze', series: 'cal_target', muiIcon: 'LocalDining', condType: 'target_days', condField: 'calTargetDays', condValue: 7  },
  { id: 'cal_target_silver', category: 'special', xp: 30, tier: 'silver', series: 'cal_target', muiIcon: 'LocalDining', condType: 'target_days', condField: 'calTargetDays', condValue: 14 },
  { id: 'cal_target_gold',   category: 'special', xp: 50, tier: 'gold',   series: 'cal_target', muiIcon: 'LocalDining', condType: 'target_days', condField: 'calTargetDays', condValue: 30 },

  // ── PROTEIN TARGET series ──
  { id: 'prot_target_bronze', category: 'special', xp: 15, tier: 'bronze', series: 'prot_target', muiIcon: 'Egg', condType: 'target_days', condField: 'protTargetDays', condValue: 7  },
  { id: 'prot_target_silver', category: 'special', xp: 30, tier: 'silver', series: 'prot_target', muiIcon: 'Egg', condType: 'target_days', condField: 'protTargetDays', condValue: 14 },
  { id: 'prot_target_gold',   category: 'special', xp: 50, tier: 'gold',   series: 'prot_target', muiIcon: 'Egg', condType: 'target_days', condField: 'protTargetDays', condValue: 30 },

  // ── MONTHLY STEPS series (resettable each month) ──
  { id: 'monthly_steps_bronze', category: 'special', xp: 20, tier: 'bronze', series: 'monthly_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 200000 },
  { id: 'monthly_steps_silver', category: 'special', xp: 35, tier: 'silver', series: 'monthly_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 300000 },
  { id: 'monthly_steps_gold',   category: 'special', xp: 50, tier: 'gold',   series: 'monthly_steps', muiIcon: 'DirectionsWalk', condType: 'monthly_steps', condValue: 450000 },

  // ── FIRST ENTRY (instant gratification) ──
  { id: 'first_meal',   category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'Restaurant',    condType: 'count', condField: 'mealCount',   condValue: 1 },
  { id: 'first_weight', category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'MonitorWeight', condType: 'count', condField: 'weightCount', condValue: 1 },
  { id: 'first_steps',  category: 'consistency', xp: 5,  tier: null, series: null, muiIcon: 'DirectionsWalk', condType: 'count', condField: 'stepsCount', condValue: 1 },

  // ── STANDALONE ──
  { id: 'first_pr',     category: 'strength', xp: 25, tier: null, series: null, muiIcon: 'EmojiEvents', condType: 'strength_pr', condValue: 1   },
  { id: 'all_rounder',  category: 'special',  xp: 40, tier: null, series: null, muiIcon: 'AutoAwesome', condType: 'compound',    condValue: 1   },
  { id: 'century_club', category: 'special',  xp: 50, tier: null, series: null, muiIcon: 'MilitaryTech', condType: 'meta',       condValue: 100 },
]


/* ───────────────────────────────────────────────────────────────
   Helper: collect stats from a client object
   ─────────────────────────────────────────────────────────────── */

function collectStats(client) {
  const meals    = client.meals      || []
  const weights  = client.weightLogs || []
  const workouts = client.workouts   || []
  const steps    = client.stepsLogs  || []

  // unique dates per data source
  const mealDateSet    = new Set(meals.map(m => m.date))
  const weightDateSet  = new Set(weights.map(w => w.date))
  const workoutDateSet = new Set(workouts.map(w => w.date))
  const stepsDateSet   = new Set(steps.map(s => s.date))

  // combined unique activity dates
  const allDateSet = new Set([...mealDateSet, ...weightDateSet, ...workoutDateSet, ...stepsDateSet])

  // total exercise items (sets) across all workouts
  let totalSets = 0
  for (const w of workouts) totalSets += (w.items || []).length

  // best 7-day window
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
    stepsCount:     steps.length,
    mealDays:       mealDateSet.size,
    weightDays:     weightDateSet.size,
    stepsDays:      stepsDateSet.size,
    activeDays:     allDateSet.size,
    totalSets,
    bestWindowOf7,
    streak,
    weightLoss:     wLoss,
    hasPR,
    calTargetDays,
    protTargetDays,
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


/* ── Monthly step totals from stepsLogs ──────────────────────── */
function computeMonthlySteps(stepsLogs) {
  const byMonth = {}
  for (const s of stepsLogs) {
    const parts = String(s.date || '').split('.')
    if (parts.length !== 3) continue
    const monthKey = `${parts[2]}-${parts[1]}` // YYYY-MM
    byMonth[monthKey] = (byMonth[monthKey] || 0) + Number(s.steps || 0)
  }
  return byMonth
}


/* ── Evaluate monthly step badges ────────────────────────────── */
export function evaluateMonthlyStepBadges(client) {
  const steps = client.stepsLogs || []
  const monthlySteps = computeMonthlySteps(steps)
  const results = []
  for (const [monthKey, total] of Object.entries(monthlySteps)) {
    for (const b of BADGES) {
      if (b.condType !== 'monthly_steps') continue
      if (total >= b.condValue) results.push({ badgeId: b.id, monthKey })
    }
  }
  return results
}


/* ── Monthly step badge history for display ──────────────────── */
export function getMonthlyStepHistory(client) {
  const results = evaluateMonthlyStepBadges(client)
  const byMonth = {}
  for (const r of results) {
    const b = BADGES.find(x => x.id === r.badgeId)
    if (!b) continue
    const existing = byMonth[r.monthKey]
    if (!existing || TIER_ORDER.indexOf(b.tier) > TIER_ORDER.indexOf(existing.tier)) {
      byMonth[r.monthKey] = { tier: b.tier, badgeId: r.badgeId, monthKey: r.monthKey }
    }
  }
  return Object.values(byMonth).sort((a, b) => b.monthKey.localeCompare(a.monthKey))
}


/* ═══════════════════════════════════════════════════════════════
   evaluateBadges — returns array of earned badge IDs
   ═══════════════════════════════════════════════════════════════ */

export function evaluateBadges(client) {
  const stats = collectStats(client)
  const earned = []

  // first pass: all non-meta, non-monthly_steps badges
  for (const b of BADGES) {
    if (b.condType === 'meta' || b.condType === 'monthly_steps') continue
    if (checkBadge(b, stats)) earned.push(b.id)
  }

  // monthly steps: earn for current month only
  const monthlyResults = evaluateMonthlyStepBadges(client)
  const now = new Date()
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  for (const r of monthlyResults) {
    if (r.monthKey === currentMonthKey) earned.push(r.badgeId)
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
   getBadgeProgress — returns { current, target } for a single badge
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
    case 'monthly_steps': {
      const monthlySteps = computeMonthlySteps(client.stepsLogs || [])
      const now = new Date()
      const key = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const total = monthlySteps[key] || 0
      return { current: Math.min(total, badge.condValue), target: badge.condValue }
    }
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

export function computeTotalXP(earnedIds, client) {
  // Standard badge XP
  let total = earnedIds.reduce((sum, id) => {
    const b = BADGES.find(x => x.id === id)
    return sum + (b ? b.xp : 0)
  }, 0)

  // Monthly step XP from historical months (current month already in earnedIds)
  if (client) {
    const monthlyResults = evaluateMonthlyStepBadges(client)
    const now = new Date()
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    for (const r of monthlyResults) {
      if (r.monthKey !== currentMonthKey) {
        const b = BADGES.find(x => x.id === r.badgeId)
        if (b) total += b.xp
      }
    }
  }

  return total
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
   getNextBadges — closest-to-unlock unearned badges
   ═══════════════════════════════════════════════════════════════ */

export function getNextBadges(client, earnedIds, limit = 3) {
  const earnedSet = new Set(earnedIds)
  const unearned = BADGES.filter(b => !earnedSet.has(b.id) && b.condType !== 'monthly_steps')

  const withProgress = unearned.map(badge => {
    const { current, target } = getBadgeProgress(badge, client)
    const ratio = target > 0 ? current / target : 0
    return { badge, current, target, progress: ratio }
  })

  // sort by progress descending (closest first), then by XP ascending (easier first)
  withProgress.sort((a, b) => {
    if (b.progress !== a.progress) return b.progress - a.progress
    return a.badge.xp - b.badge.xp
  })

  return withProgress.slice(0, limit)
}


/* ═══════════════════════════════════════════════════════════════
   computeXPRanking — replaces old points-based ranking
   ═══════════════════════════════════════════════════════════════ */

export function computeXPRanking(clients) {
  return clients.map(c => {
    const earnedIds = evaluateBadges(c)
    const totalXP   = computeTotalXP(earnedIds, c)
    const levelData = computeLevel(totalXP)
    return {
      name:       c.name,
      xp:         totalXP,
      level:      levelData.level,
      badgeCount: earnedIds.length,
    }
  }).sort((a, b) => b.xp - a.xp)
}
