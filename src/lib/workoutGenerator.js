// ── Workout Generator ─────────────────────────────────────────────
// Picks today's workout from a fixed Level 1 curriculum (20 workouts,
// rotating by day index).  Level 2 / Level 3 curricula will plug into
// the same shape later via the difficulty parameter.
//
// Each workout is 3 rounds, ~25-30 minutes total. Per-exercise duration
// comes from the curriculum entry (varies between 25-40 sec). Rest
// between exercises is 12 s; rest between rounds is 45 s.

import {
  LEVEL_1_CURRICULUM, LEVEL_1_CONFIG,
  LEVEL_2_CURRICULUM, LEVEL_2_CONFIG,
} from './levelOneCurriculum'

// Unilateral pair detection — slugs end in "-l" or "-r" for the two sides.
const SIDE_RE = /-(l|r)$/i
function mirrorSlug(slug) {
  if (!SIDE_RE.test(slug || '')) return null
  return slug.endsWith('-l')
    ? slug.replace(/-l$/, '-r')
    : slug.replace(/-r$/, '-l')
}
// Strip side suffix so `lunge-l` and `lunge-r` count as the same movement
// when checking adjacent-day overlap.
function baseSlug(s) {
  return String(s || '').replace(SIDE_RE, '')
}

// Look up the RAW first-exercise slug of a given day's curriculum entry
// without doing any library resolution or rotation. Used by the
// anti-repeat guard inside generateDailyWorkout to peek at yesterday's
// lead movement. Mirrors the curriculum-selection logic in
// generateDailyWorkout so the two stay in sync.
function templateLeadSlug(dayIndex, quiz) {
  if (dayIndex < 0) return null
  const weekIdx = Math.floor(dayIndex / 7)
  const lvl     = determineLevelStart(quiz)
  let curr
  if (lvl === 2)            curr = LEVEL_2_CURRICULUM
  else if (weekIdx === 0)   curr = LEVEL_1_CURRICULUM
  else                      curr = LEVEL_2_CURRICULUM
  const idx = ((dayIndex % curr.length) + curr.length) % curr.length
  return curr[idx]?.[0]?.slug || null
}

/**
 * Build today's workout from the Level 1 curriculum.
 * @param {object} args
 * @param {Array}  args.library    rows from exercise_library
 * @param {number} args.dayIndex   0-based day since program start
 * @param {number} [args.difficulty]  reserved for level 2/3 (defaults 1)
 */
// Map a quiz answers object (clients.synrg_quiz) to the starting fitness
// level.  Rules:
//   • last_trained === 'gt_3y'                              → L1 forced
//   • activity >= 7  AND  last_trained !== 'gt_3y'          → L2 starter
//   • everything else (incl. missing quiz)                  → L1 starter
export function determineLevelStart(quiz) {
  if (!quiz) return 1
  const lt = String(quiz.last_trained || '').toLowerCase()
  if (lt === 'gt_3y') return 1
  const activity = Number(quiz.activity) || 0
  if (activity >= 7 && lt && lt !== 'gt_3y') return 2
  return 1
}

export function generateDailyWorkout({ library, dayIndex, difficulty = 1, quiz = null }) {
  if (!Array.isArray(library) || library.length === 0) return null

  const weekIndex   = Math.floor((dayIndex || 0) / 7)
  const levelStart  = determineLevelStart(quiz)

  // Progression rules:
  //   • L1 starter, week 1   → L1 curriculum, 3 rounds
  //   • L1 starter, week 2+  → L2 curriculum, 4 rounds (default L2 cfg)
  //   • L2 starter, week 1   → L2 curriculum, 5 rounds
  //   • L2 starter, week 2+  → L2 curriculum, 6 rounds
  let curriculum, cfg, numberOffset
  if (levelStart === 2) {
    curriculum   = LEVEL_2_CURRICULUM
    numberOffset = LEVEL_1_CURRICULUM.length
    cfg = weekIndex === 0
      ? { ...LEVEL_2_CONFIG, rounds: 5 }
      : { ...LEVEL_2_CONFIG, rounds: 6 }
  } else if (weekIndex === 0) {
    curriculum   = LEVEL_1_CURRICULUM
    cfg          = LEVEL_1_CONFIG
    numberOffset = 0
  } else {
    curriculum   = LEVEL_2_CURRICULUM
    cfg          = LEVEL_2_CONFIG
    numberOffset = LEVEL_1_CURRICULUM.length
  }

  const idx = ((dayIndex % curriculum.length) + curriculum.length) % curriculum.length
  const template = curriculum[idx]
  const workoutNumber = idx + 1 + numberOffset

  const bySlug = new Map(library.map(ex => [ex.slug, ex]))

  // Resolve each curriculum entry to a real library row.  Skip entries
  // whose slug isn't in the library (so an admin can iterate without
  // crashing the runtime).
  const exercises = template.map(item => {
    const ex = bySlug.get(item.slug)
    if (!ex) return null

    const out = {
      ...ex,
      prescribed: item.sec,
      prescribedType: 'sec',
    }

    if (item.perSide) {
      // Same exercise, two sides (single video, user switches sides
      // between work intervals).
      out.both_sides = true
    } else {
      // Mirror via -l/-r slug (e.g. lunge-l → lunge-r). Both sides run
      // back-to-back with the same prescribed duration.
      const mSlug = mirrorSlug(ex.slug)
      if (mSlug && bySlug.has(mSlug)) {
        out.pair_with = {
          ...bySlug.get(mSlug),
          prescribed: item.sec,
          prescribedType: 'sec',
        }
      }
    }
    return out
  }).filter(Boolean)

  if (exercises.length === 0) return null

  // ── Anti-repeat guard ────────────────────────────────────────────
  // The hand-authored curricula tend to alternate between the same 2
  // lead exercises (L1: bodyweight-squat / sumo-squat; L2: thruster /
  // swing). If the user happens to skip a day or the curriculum is
  // edited, two consecutive sessions can land on the same first
  // movement — which feels stale. Compare today's first base-slug to
  // yesterday's; if they match, rotate today's exercises by one until
  // they differ. Bounded loop so a curriculum where every entry shares
  // the same base-slug doesn't infinite-loop.
  const yLead = templateLeadSlug(dayIndex - 1, quiz)
  if (yLead && exercises.length > 1) {
    let safety = exercises.length
    while (safety-- > 0 && baseSlug(exercises[0]?.slug) === baseSlug(yLead)) {
      exercises.push(exercises.shift())
    }
  }

  // Total time. Unilateral entries (pair_with OR both_sides) cost 2 ×
  // prescribed seconds; everything else costs 1 ×.
  const slotWorkSecs = exercises.map(ex =>
    (ex.pair_with || ex.both_sides) ? 2 * ex.prescribed : ex.prescribed
  )
  const perRoundSec = slotWorkSecs.reduce((a, b) => a + b, 0)
                    + cfg.rest_between_exercises_sec * (exercises.length - 1)
  const totalSec = perRoundSec * cfg.rounds
                 + cfg.rest_between_rounds_sec * (cfg.rounds - 1)

  return {
    focus: 'Цяло тяло',
    dayIndex,
    workoutNumber,
    curriculumSize: LEVEL_1_CURRICULUM.length + LEVEL_2_CURRICULUM.length,
    difficulty,
    totalMinutes: Math.round(totalSec / 60),
    sections: [{
      type: 'main',
      title_bg: `Тренировка ${workoutNumber}`,
      rounds: cfg.rounds,
      time_cap_sec: totalSec,
      work_sec: 0, // varies per exercise — read step.sec at runtime
      rest_sec: cfg.rest_between_exercises_sec,
      round_rest_sec: cfg.rest_between_rounds_sec,
      exercises,
    }],
    rest: false,
  }
}

// ── Helpers ────────────────────────────────────────────────────────
export function focusLabelBg(focus) {
  return focus || 'Цяло тяло'
}

export function formatPrescription(ex) {
  if (ex.prescribedType === 'sec') return `${ex.prescribed} сек`
  return `${ex.prescribed} повт`
}

export const WORKOUT_TIMING = {
  ROUND_COUNT:     LEVEL_1_CONFIG.rounds,
  REST_SEC:        LEVEL_1_CONFIG.rest_between_exercises_sec,
  ROUND_REST_SEC:  LEVEL_1_CONFIG.rest_between_rounds_sec,
}
