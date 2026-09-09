// ─── Nutrition plan — targets + generated day menu ────────────────
// Powers the "Хранителен план" tab. Two halves:
//   1. calcNutritionTargets — Mifflin-St Jeor BMR → TDEE → kcal/macros.
//      This is the accurate version of calcTargets() in SynrgMethod.jsx,
//      which only knows kcal-per-kg and has no age/sex input.
//   2. buildDayMenu — assembles a concrete 3-meal day out of the recipe
//      DB, scaled to the client's own numbers, 3 swappable options per meal.

import RECIPES, { recipePortionGrams } from './recipes'

// ── Inputs ────────────────────────────────────────────────────────
export const STEP_BANDS = [
  { value: 'low',       labelBg: 'под 5 000',  mult: 1.25 },
  { value: 'medium',    labelBg: '5–8 000',    mult: 1.375 },
  { value: 'high',      labelBg: '8–12 000',   mult: 1.5 },
  { value: 'very_high', labelBg: 'над 12 000', mult: 1.65 },
]

export const GOALS = [
  { value: 'lose',     labelBg: 'Отслабване', factor: 0.80 },
  { value: 'maintain', labelBg: 'Поддръжка',  factor: 1.00 },
  { value: 'gain',     labelBg: 'Покачване',  factor: 1.12 },
]

export const SEXES = [
  { value: 'female', labelBg: 'Жена' },
  { value: 'male',   labelBg: 'Мъж'  },
]

// Each session/week adds ~2.5% on top of the step-derived multiplier,
// capped at 5 sessions — beyond that the steps band already covers it.
const PER_SESSION_BUMP = 0.025
const MAX_SESSION_BUMP = 0.125
const MAX_MULTIPLIER   = 1.85

// A cut is never allowed below BMR × this — going under is where people
// stall, lose muscle and rebound.
const MIN_KCAL_VS_BMR = 1.1

// ── Targets ───────────────────────────────────────────────────────
// profile: { sex, age, height, weight, steps, sessions, goal }
// Returns null for a missing or half-filled profile — callers render the
// form instead. A default parameter is not enough here: the column is null
// until the client fills it in, and `= {}` only covers undefined.
export function calcNutritionTargets(profileArg) {
  const profile = profileArg || {}
  const w    = Number(profile.weight)   || 0
  const h    = Number(profile.height)   || 0
  const age  = Number(profile.age)      || 0
  const sex  = profile.sex === 'male' ? 'male' : 'female'
  const sess = Math.max(0, Math.min(7, Number(profile.sessions) || 0))

  if (!w || !h || !age) return null

  // Mifflin-St Jeor
  const bmr = Math.round(10 * w + 6.25 * h - 5 * age + (sex === 'male' ? 5 : -161))

  const band = STEP_BANDS.find(b => b.value === profile.steps) || STEP_BANDS[1]
  const multiplier = Math.min(
    MAX_MULTIPLIER,
    band.mult + Math.min(MAX_SESSION_BUMP, sess * PER_SESSION_BUMP),
  )
  const tdee = Math.round(bmr * multiplier)

  const goal = GOALS.find(g => g.value === profile.goal) || GOALS[0]
  const kcal = Math.max(Math.round(bmr * MIN_KCAL_VS_BMR), Math.round(tdee * goal.factor))

  // Protein: same curve as calcTargets() so the two never contradict —
  // ≤80kg → 2g/kg, ≥90kg → 1.5g/kg, linear in between.
  let protein
  if (w <= 80)      protein = Math.round(w * 2)
  else if (w >= 90) protein = Math.round(w * 1.5)
  else              protein = Math.round(w * (2 - (w - 80) * 0.05))

  // Fat: 30% of intake, never below 0.6g/kg (hormones, vitamins). 30 rather
  // than the textbook 25 because real Bulgarian cooking — the recipe DB this
  // plan draws from — lands there anyway; a 25% target just makes every
  // generated menu look "over" on fat.
  const fat = Math.max(Math.round(w * 0.6), Math.round((kcal * 0.30) / 9))

  // Carbs take whatever is left.
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))

  return { bmr, multiplier, tdee, kcal, protein, carbs, fat, goal: goal.value }
}

export function isProfileComplete(p) {
  return !!(p && p.sex && Number(p.age) > 0 && Number(p.height) > 0 &&
            Number(p.weight) > 0 && p.steps && p.goal)
}

// ── Day menu ──────────────────────────────────────────────────────
// Three meals by default. Percentages are of the daily kcal target.
export const MEAL_SLOTS = [
  { key: 'breakfast', labelBg: 'Закуска', share: 0.27, categories: ['breakfast'] },
  { key: 'lunch',     labelBg: 'Обяд',    share: 0.38, categories: ['main'] },
  { key: 'dinner',    labelBg: 'Вечеря',  share: 0.35, categories: ['main', 'side'] },
]

// Above this, three plates can't hold the day without portions no one will
// actually eat — add an afternoon snack and re-share.
const FOUR_MEAL_KCAL = 2600
const MEAL_SLOTS_4 = [
  { key: 'breakfast', labelBg: 'Закуска',  share: 0.25, categories: ['breakfast'] },
  { key: 'lunch',     labelBg: 'Обяд',     share: 0.33, categories: ['main'] },
  { key: 'snack',     labelBg: 'Следобед', share: 0.12, categories: ['snack', 'breakfast'] },
  { key: 'dinner',    labelBg: 'Вечеря',   share: 0.30, categories: ['main', 'side'] },
]

function slotsFor(kcal) {
  return kcal >= FOUR_MEAL_KCAL ? MEAL_SLOTS_4 : MEAL_SLOTS
}

const OPTIONS_PER_MEAL = 3
// How far a recipe may be scaled and still be a believable plate.
const MIN_FACTOR = 0.65
const MAX_FACTOR = 1.9
// Pool the N best-fitting recipes, then let the seed choose within it —
// so "Друго меню" gives real variety instead of the same runner-up.
const POOL_SIZE = 7

// The recipe DB holds two conventions, and mixing them up turns a 95 kcal
// bean stew into a 95 kcal dinner:
//   · "portion" — ingredients carry grams, recipe.kcal is for one portion.
//   · "per100"  — batch pot recipes, ingredients are grams-less prose and
//                 recipe.kcal is per 100 g (see the "На 100г:" comments).
// recipePortionGrams() returns 0 for the second kind, which is the tell.
function recipeMode(recipe) {
  return recipePortionGrams(recipe) > 0 ? 'portion' : 'per100'
}

// Believable served weight for a grams-less batch recipe, per meal slot.
const SERVING_RANGE = {
  breakfast: [150, 350],
  lunch:     [250, 450],
  dinner:    [250, 450],
  snack:     [80,  250],
}

// Deterministic PRNG so a given client + day always renders the same menu
// (no reshuffle on every re-render), while the shuffle counter can advance it.
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashString(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// Batch recipes (servings > 1) list ingredients for the whole tray, while
// kcal/protein are already per portion — divide the grams to match.
function perServingGrams(recipe, grams) {
  const servings = recipe.servings > 1 ? recipe.servings : 1
  return grams / servings
}

// Scale one recipe to a meal's kcal budget. Returns null when the portion
// would have to be unrealistically small or large.
function scaleRecipe(recipe, kcalTarget, slotKey) {
  if (!recipe.kcal) return null

  if (recipeMode(recipe) === 'per100') {
    // Batch recipe: pick how much of the pot to serve instead of scaling it.
    const [minG, maxG] = SERVING_RANGE[slotKey] || SERVING_RANGE.lunch
    const wanted = (kcalTarget / recipe.kcal) * 100
    if (wanted < minG * 0.8 || wanted > maxG * 1.25) return null
    // Round to 25 g — nobody weighs a stew to the gram.
    const grams = Math.min(maxG, Math.max(minG, Math.round(wanted / 25) * 25))
    const per   = grams / 100
    return {
      recipe,
      mode:    'per100',
      grams,
      kcal:    Math.round(recipe.kcal * per),
      protein: Math.round(recipe.protein * per),
      carbs:   Math.round((recipe.carbs || 0) * per),
      fat:     Math.round((recipe.fat || 0) * per),
      // Ingredients describe the whole pot — pass them through untouched.
      ingredients: recipe.ingredients,
      isBatch: true,
    }
  }

  const raw = kcalTarget / recipe.kcal
  if (raw < MIN_FACTOR || raw > MAX_FACTOR) return null
  // Round to a quarter portion — "1½ порции" reads better than "1.37".
  const factor = Math.round(raw * 4) / 4
  if (factor < MIN_FACTOR || factor > MAX_FACTOR) return null

  const ingredients = recipe.ingredients.map(ing => ({
    name:  ing.name,
    grams: ing.grams == null ? null : Math.round(perServingGrams(recipe, ing.grams) * factor),
    // A piece count ("2 бр.") stops being true once scaled — keep the unit
    // only at full portion, otherwise grams alone.
    unit:  ing.grams == null ? ing.unit : (factor === 1 ? ing.unit : 'г'),
  }))

  return {
    recipe,
    mode:    'portion',
    factor,
    kcal:    Math.round(recipe.kcal * factor),
    protein: Math.round(recipe.protein * factor),
    carbs:   Math.round((recipe.carbs || 0) * factor),
    fat:     Math.round((recipe.fat || 0) * factor),
    grams:   Math.round(recipePortionGrams(recipe) * factor),
    ingredients,
  }
}

// Lower is better: distance from the meal's kcal budget, plus a penalty for
// missing the protein share, plus a nudge toward near-whole portions.
function scoreOption(opt, targets) {
  const miss = (got, want) => Math.abs(got - want) / Math.max(1, want)
  // Carbs and fat carry less weight than kcal and protein, but without them
  // the top picks skew protein-heavy and the day lands far under its carb
  // target while overshooting fat.
  const stretch = opt.mode === 'portion' ? Math.abs(opt.factor - 1) : 0
  return miss(opt.kcal, targets.kcal) * 2
       + miss(opt.protein, targets.protein) * 1.5
       + miss(opt.carbs, targets.carbs) * 0.7
       + miss(opt.fat, targets.fat) * 0.7
       + stretch * 0.5
}

// seedKey: anything stable per client+day. shuffle: bump to reroll.
export function buildDayMenu(targets, seedKey = '', shuffle = 0) {
  if (!targets) return []
  const rand = mulberry32(hashString(`${seedKey}|${shuffle}`))
  const used = new Set()

  return slotsFor(targets.kcal).map(slot => {
    const slotTargets = {
      kcal:    Math.round(targets.kcal    * slot.share),
      protein: Math.round(targets.protein * slot.share),
      carbs:   Math.round(targets.carbs   * slot.share),
      fat:     Math.round(targets.fat     * slot.share),
    }
    const kcalTarget    = slotTargets.kcal
    const proteinTarget = slotTargets.protein

    const candidates = RECIPES
      .filter(r => slot.categories.includes(r.category) && !used.has(r.id))
      .map(r => scaleRecipe(r, kcalTarget, slot.key))
      .filter(Boolean)
      .map(opt => ({ ...opt, score: scoreOption(opt, slotTargets) }))
      .sort((a, b) => a.score - b.score)

    // Take the best-fitting pool, shuffle it with the seed, keep 3.
    const pool = candidates.slice(0, POOL_SIZE)
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    const options = pool.slice(0, OPTIONS_PER_MEAL)
    options.forEach(o => used.add(o.recipe.id))

    return { ...slot, kcalTarget, proteinTarget, options }
  })
}

// "1", "1½", "0¾" — portion multipliers read as fractions, not decimals.
export function formatFactor(factor) {
  const whole = Math.floor(factor)
  const frac  = factor - whole
  const glyph = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : ''
  if (!glyph) return String(whole)
  return whole === 0 ? glyph : `${whole}${glyph}`
}
