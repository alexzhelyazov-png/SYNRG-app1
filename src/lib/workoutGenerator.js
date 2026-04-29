// ── Workout Generator ─────────────────────────────────────────────
// Deterministic daily workout assembler.
//
// Given a client (start date + difficulty) and a day index, produces a
// 25-30 minute workout with three sections: warmup, main, finisher.
//
// Design:
//   • Difficulty 1-3 — taken from quiz (or defaulted to 1 until quiz is
//     wired). Each cohort sees exercises at their level and below.
//   • Body focus rotates by day so muscle groups recover:
//       day 1  lower
//       day 2  upper
//       day 3  full
//       day 4  core / cardio
//       day 5  lower (alt picks)
//       day 6  upper (alt picks)
//       day 7  rest (caller may skip)
//   • Progression: every 7 days the rep/sec defaults bump by ~10 %, and
//     once a difficulty tier is exhausted the pool widens upward.
//   • Same workout for the same (clientId, day) → repeatable, shareable.

// Rotation pattern (1-indexed by day in program)
const FOCUS_ROTATION = ['lower', 'upper', 'full', 'core', 'lower', 'upper', 'rest']

// Cheap deterministic shuffle: stable Fisher–Yates seeded by string hash.
function seededShuffle(arr, seed) {
  const out = arr.slice()
  let h = 2166136261 >>> 0
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0
  }
  function rng() {
    h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0
    h = Math.imul(h ^ (h >>> 13), 3266489909) >>> 0
    return ((h ^= h >>> 16) >>> 0) / 4294967296
  }
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function pick(library, predicate, count, seed) {
  const pool = library.filter(predicate)
  return seededShuffle(pool, seed).slice(0, count)
}

function progressionMultiplier(dayIndex) {
  // +10 % every 7 days, capped at +30 %
  const weeks = Math.min(3, Math.floor(dayIndex / 7))
  return 1 + 0.1 * weeks
}

function withProgression(exercise, dayIndex) {
  const mult = progressionMultiplier(dayIndex)
  if (exercise.default_reps) {
    return { ...exercise, prescribed: Math.round(exercise.default_reps * mult), prescribedType: 'reps' }
  }
  if (exercise.default_sec) {
    return { ...exercise, prescribed: Math.round(exercise.default_sec * mult), prescribedType: 'sec' }
  }
  return { ...exercise, prescribed: 12, prescribedType: 'reps' }
}

/**
 * Build today's workout.
 * @param {object} args
 * @param {Array}  args.library - rows from exercise_library
 * @param {string} args.clientId - used as seed
 * @param {number} args.dayIndex - 0-based day since program start
 * @param {number} args.difficulty - 1..3 (default 1)
 * @returns {{focus, sections, totalMinutes, dayIndex}}
 */
export function generateDailyWorkout({ library, clientId, dayIndex, difficulty = 1 }) {
  const focus = FOCUS_ROTATION[dayIndex % FOCUS_ROTATION.length]
  if (focus === 'rest') {
    return { focus, dayIndex, totalMinutes: 0, sections: [], rest: true }
  }

  const cap = Math.min(3, difficulty + Math.floor(dayIndex / 14)) // tier widens slowly
  const seed = `${clientId || 'anon'}|${dayIndex}|${focus}`

  // ── Warmup: 3 ex × 1 round, ~5 min ────────────────────────────────
  const warmupPool = library.filter(e =>
    (e.category === 'cardio' || e.category === 'core') && (e.difficulty || 1) <= 2
  )
  const warmup = seededShuffle(warmupPool, seed + '|w').slice(0, 3).map(e => withProgression(e, dayIndex))

  // ── Main: 4 ex × 3 rounds, ~15-18 min ────────────────────────────
  const focusPool = focus === 'core'
    ? library.filter(e => e.category === 'core' || e.category === 'full')
    : library.filter(e => e.category === focus || e.category === 'full')
  const mainCandidates = focusPool.filter(e => (e.difficulty || 1) <= cap)
  const main = seededShuffle(mainCandidates, seed + '|m').slice(0, 4).map(e => withProgression(e, dayIndex))

  // ── Finisher: 1 ex × short burst, ~3-5 min ───────────────────────
  const finisherPool = library.filter(e =>
    (e.category === 'cardio' || e.category === 'full') && (e.difficulty || 1) <= cap
  )
  const finisher = seededShuffle(finisherPool, seed + '|f').slice(0, 1).map(e => withProgression(e, dayIndex))

  const sections = []
  if (warmup.length) {
    sections.push({
      type: 'warmup',
      title_bg: 'Загрявка',
      rounds: 1,
      time_cap_sec: 300,
      exercises: warmup,
    })
  }
  if (main.length) {
    sections.push({
      type: 'main',
      title_bg: 'Основна',
      rounds: 3,
      time_cap_sec: 1080,
      exercises: main,
    })
  }
  if (finisher.length) {
    sections.push({
      type: 'finisher',
      title_bg: 'Финиш',
      rounds: 1,
      time_cap_sec: 240,
      exercises: finisher,
    })
  }

  const totalSec = sections.reduce((s, sec) => s + sec.time_cap_sec, 0)
  return {
    focus,
    dayIndex,
    totalMinutes: Math.round(totalSec / 60),
    sections,
  }
}

// ── Helpers ────────────────────────────────────────────────────────
export function focusLabelBg(focus) {
  return ({
    lower: 'Долна част',
    upper: 'Горна част',
    full:  'Цяло тяло',
    core:  'Корем и стабилност',
    cardio:'Кардио',
    rest:  'Възстановяване',
  })[focus] || focus
}

export function formatPrescription(ex) {
  if (ex.prescribedType === 'sec') return `${ex.prescribed} сек`
  return `${ex.prescribed} повт`
}
