// ── Workout Generator ─────────────────────────────────────────────
// Picks today's workout from a fixed Level 1 curriculum (20 workouts,
// rotating by day index).  Level 2 / Level 3 curricula will plug into
// the same shape later via the difficulty parameter.
//
// Each workout is 3 rounds, ~25-30 minutes total. Per-exercise duration
// comes from the curriculum entry (varies between 25-40 sec). Rest
// between exercises is 12 s; rest between rounds is 45 s.

import { LEVEL_1_CURRICULUM, LEVEL_1_CONFIG } from './levelOneCurriculum'

// Unilateral pair detection — slugs end in "-l" or "-r" for the two sides.
const SIDE_RE = /-(l|r)$/i
function mirrorSlug(slug) {
  if (!SIDE_RE.test(slug || '')) return null
  return slug.endsWith('-l')
    ? slug.replace(/-l$/, '-r')
    : slug.replace(/-r$/, '-l')
}

/**
 * Build today's workout from the Level 1 curriculum.
 * @param {object} args
 * @param {Array}  args.library    rows from exercise_library
 * @param {number} args.dayIndex   0-based day since program start
 * @param {number} [args.difficulty]  reserved for level 2/3 (defaults 1)
 */
export function generateDailyWorkout({ library, dayIndex, difficulty = 1 }) {
  if (!Array.isArray(library) || library.length === 0) return null

  // Until we have level 2/3 curricula, every difficulty rotates Level 1
  const curriculum = LEVEL_1_CURRICULUM
  const cfg = LEVEL_1_CONFIG
  const idx = ((dayIndex % curriculum.length) + curriculum.length) % curriculum.length
  const template = curriculum[idx]
  const workoutNumber = idx + 1

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
    curriculumSize: curriculum.length,
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
