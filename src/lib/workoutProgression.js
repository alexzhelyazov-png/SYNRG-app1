// ── Main-lift recognition + small progressive-overload suggestions ──────
// Exercise names in `workouts.items` are free text typed by coaches, so we
// only recognize a short, curated list of "main lift" name variants rather
// than fuzzy-matching everything. Unrecognized names simply get no
// suggestion — never a guessed one.

function normalize(name) {
  return String(name || '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Gym's real increment: 1.25kg plates loaded on both sides of a barbell, and
// dumbbells stepped the same way, so the usable jump is always 2.5kg.
export const WEIGHT_STEP_KG = 2.5

// Rep ceiling before we switch from "add a rep" to "add weight" — matches
// the example in the brief (40кг 10/10/10 → 40кг 11/10/10 before jumping kg).
const REP_CEILING = 12

export const MAIN_LIFTS = [
  { id: 'squat',            label: 'Клек',           variants: ['клек', 'клекове', 'клек с щанга', 'приклекване'] },
  { id: 'deadlift',         label: 'Тяга',           variants: ['тяга', 'мъртва тяга', 'тяга от под'] },
  { id: 'bulgarian_squat',  label: 'Българско клекче', variants: ['бг клек', 'бг. клек', 'българско клекче', 'клек на един крак'] },
  { id: 'pullups',          label: 'Набирания',      variants: ['набирания', 'набиране'] },
  { id: 'pushups',          label: 'Лицеви опори',   variants: ['лицеви опори', 'л.о.', 'л.о', 'лицеви'] },
  { id: 'bench_press',      label: 'Лежанка',        variants: ['лежанка', 'бенч', 'бенч преса', 'лежанка с щанга'] },
  { id: 'shoulder_press',   label: 'Раменна преса',  variants: ['раменна преса', 'рамена преса', 'армейска преса', 'военна преса'] },
]

const VARIANT_TO_LIFT = new Map()
for (const lift of MAIN_LIFTS) {
  for (const v of lift.variants) VARIANT_TO_LIFT.set(v, lift.id)
}

// Returns the matched lift id, or null if `name` isn't a recognized main lift.
export function matchMainLift(name) {
  return VARIANT_TO_LIFT.get(normalize(name)) || null
}

// Parses a scheme string like "4x8" into { sets, reps }. Returns null for
// anything else (per-set notations like "3x12-15/12" or "10/10/10") rather
// than guessing — those need a coach's judgment, not an auto-suggestion.
function parseScheme(scheme) {
  const m = String(scheme || '').trim().match(/^(\d+)\s*[xх×]\s*(\d+)$/i)
  if (!m) return null
  return { sets: Number(m[1]), reps: Number(m[2]) }
}

// Parses a plain numeric weight like "40" or "42.5". Returns null for
// per-side/compound notations like "12.5/5" — same reasoning as above.
function parseWeight(weight) {
  const s = String(weight || '').trim()
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  return Number(s)
}

// Suggests the next small step for a main lift given what was last actually
// performed. Returns null when the last entry doesn't parse cleanly (no
// history, or a compound/per-set notation) — never fabricates a number.
export function suggestNextStep(lastScheme, lastWeight) {
  const parsedScheme = parseScheme(lastScheme)
  const parsedWeight = parseWeight(lastWeight)
  if (!parsedScheme || parsedWeight == null) return null

  if (parsedScheme.reps < REP_CEILING) {
    return {
      scheme: `${parsedScheme.sets}x${parsedScheme.reps + 1}`,
      weight: String(parsedWeight),
      reason: 'rep',
    }
  }
  return {
    scheme: `${parsedScheme.sets}x${parsedScheme.reps}`,
    weight: String(parsedWeight + WEIGHT_STEP_KG),
    reason: 'weight',
  }
}

// Finds the most recent logged entry for `exerciseName` in a client's
// workout history (any category — a lift stays the same lift regardless of
// which split day it was logged under). `workouts` = client.workouts
// (already sorted newest-first by created_at in AppContext).
export function findLastPerformance(workouts, exerciseName) {
  const target = normalize(exerciseName)
  for (const w of (workouts || [])) {
    const item = (w.items || []).find(it => normalize(it.exercise) === target)
    if (item) return { date: w.date, scheme: item.scheme, weight: item.weight }
  }
  return null
}
