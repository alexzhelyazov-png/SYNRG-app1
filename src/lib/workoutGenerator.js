// ── Workout Generator ─────────────────────────────────────────────
// Single-section circuit workout assembler.
//
// Design (per founder spec):
//   • 25-30 min total work time, no warmup, no separate finisher
//   • Circular format — N rounds × 5 exercises
//   • Each exercise hits a different body region so a full round trains
//     the whole body. Rotation per round picks the same slot from each
//     "bucket" so you don't redo the same muscle group back-to-back.
//   • Rounds: 4 (≈ 25 min with 40s work / 15s rest / 60s round-rest)
//   • Difficulty 1-3 from quiz; tier widens by +1 every 14 days.
//   • Deterministic per (clientId, day) so reloads stay consistent.

const ROUND_COUNT     = 4
const EXERCISES_PER_R = 5
const WORK_SEC        = 40   // boomerang loop drives the rep target
const REST_SEC        = 15   // between exercises within a round
const ROUND_REST_SEC  = 60   // between full rounds

// ── Body buckets (so each round trains the whole body) ──────────────
// Order matters → slot 0 of every round comes from BUCKET_ORDER[0], etc.
const BUCKET_ORDER = ['lower', 'upper', 'core', 'cardio', 'full']

// Map exercise.category → bucket (with fallback so nothing is dropped).
function bucketFor(ex) {
  const c = (ex.category || '').toLowerCase()
  if (c === 'lower' || c === 'upper' || c === 'core' || c === 'cardio' || c === 'full') return c
  return 'full'
}

// Unilateral pair detection — slugs end in "-l" or "-r" for the two sides.
const SIDE_RE = /-(l|r)$/i
function pairKey(ex) {
  return (ex.slug || '').replace(SIDE_RE, '')
}
function mirrorSlug(ex) {
  if (!SIDE_RE.test(ex.slug || '')) return null
  return ex.slug.endsWith('-l')
    ? ex.slug.replace(/-l$/, '-r')
    : ex.slug.replace(/-r$/, '-l')
}

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
  // Default to a 40-second AMRAP if the library row didn't specify either
  return { ...exercise, prescribed: WORK_SEC, prescribedType: 'sec' }
}

// Group exercises into body buckets honouring the difficulty cap.
function buildBuckets(library, cap) {
  const buckets = { lower: [], upper: [], core: [], cardio: [], full: [] }
  for (const ex of library) {
    if ((ex.difficulty || 1) > cap) continue
    buckets[bucketFor(ex)].push(ex)
  }
  return buckets
}

/**
 * Build today's workout — single circuit, 25-30 min, whole body.
 * @param {object} args
 * @param {Array}  args.library  - rows from exercise_library
 * @param {string} args.clientId - used as deterministic seed
 * @param {number} args.dayIndex - 0-based day since program start
 * @param {number} args.difficulty - 1..3 (defaults to 1)
 */
export function generateDailyWorkout({ library, clientId, dayIndex, difficulty = 1 }) {
  if (!Array.isArray(library) || library.length === 0) return null

  const cap = Math.min(3, difficulty + Math.floor(dayIndex / 14))
  const seed = `${clientId || 'anon'}|${dayIndex}|circuit|v2`

  const buckets = buildBuckets(library, cap)
  // Index for fast mirror lookup
  const bySlug = new Map(library.map(ex => [ex.slug, ex]))

  // For each slot in the round, prepare a shuffled queue from the
  // matching bucket. Slots fall back to "full" when the chosen bucket
  // is empty (e.g. early on with very small libraries).
  const slotPools = BUCKET_ORDER.slice(0, EXERCISES_PER_R).map((bucket, slotIdx) => {
    const pool = buckets[bucket]?.length ? buckets[bucket] : buckets.full
    return seededShuffle(pool, `${seed}|slot${slotIdx}|${bucket}`)
  })

  // Pick one exercise per slot. Dedup by pairKey() so we never end up
  // with both sides of the same unilateral exercise as separate slots.
  const takenIds = new Set()
  const takenPairs = new Set()
  const picks = slotPools.map((pool, slotIdx) => {
    const candidate = pool.find(ex => !takenIds.has(ex.id) && !takenPairs.has(pairKey(ex)))
    const chosen = candidate || pool[slotIdx % pool.length] || null
    if (chosen) {
      takenIds.add(chosen.id)
      takenPairs.add(pairKey(chosen))
    }
    return chosen
  }).filter(Boolean)

  // Top-up if library was too small for the bucket selection above.
  if (picks.length < EXERCISES_PER_R) {
    const remainder = seededShuffle(
      library.filter(ex => !takenIds.has(ex.id) && !takenPairs.has(pairKey(ex)) && (ex.difficulty || 1) <= cap),
      seed + '|fill'
    )
    for (const ex of remainder) {
      if (picks.length >= EXERCISES_PER_R) break
      picks.push(ex); takenIds.add(ex.id); takenPairs.add(pairKey(ex))
    }
  }

  // Enrich: for unilateral exercises (-l/-r slug suffix), attach the
  // mirror side so the player can run both sides back-to-back without
  // a rest between sides.
  const exercises = picks.map(ex => {
    const out = withProgression(ex, dayIndex)
    const mSlug = mirrorSlug(ex)
    if (mSlug && bySlug.has(mSlug)) {
      out.pair_with = withProgression(bySlug.get(mSlug), dayIndex)
    }
    return out
  })

  // Total work time. Unilateral exercises run BOTH sides per slot
  // (no rest between sides), so they cost 2 × WORK_SEC instead of 1.
  const slotWorkSecs = exercises.map(ex => ex.pair_with ? 2 * WORK_SEC : WORK_SEC)
  const perRoundSec  = slotWorkSecs.reduce((a,b) => a + b, 0) + REST_SEC * (exercises.length - 1)
  const totalSec     = perRoundSec * ROUND_COUNT + ROUND_REST_SEC * (ROUND_COUNT - 1)

  const sections = [{
    type: 'main',
    title_bg: 'Кръгова тренировка',
    rounds: ROUND_COUNT,
    time_cap_sec: totalSec,
    work_sec: WORK_SEC,
    rest_sec: REST_SEC,
    round_rest_sec: ROUND_REST_SEC,
    exercises,
  }]

  return {
    focus: 'Цяло тяло',
    dayIndex,
    totalMinutes: Math.round(totalSec / 60),
    sections,
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
  WORK_SEC,
  REST_SEC,
  ROUND_REST_SEC,
  ROUND_COUNT,
  EXERCISES_PER_R,
}
