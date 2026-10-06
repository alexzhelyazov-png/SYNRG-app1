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
  { key: 'lunch',     labelBg: 'Обяд',    share: 0.38, categories: ['main', 'side'] },
  { key: 'dinner',    labelBg: 'Вечеря',  share: 0.35, categories: ['main', 'side'] },
]

// Two meals — breakfast skipped (the usual reason someone wants 2/day),
// so the day's calories split across lunch and dinner only.
const MEAL_SLOTS_2 = [
  { key: 'lunch',  labelBg: 'Обяд',   share: 0.45, categories: ['main', 'side'] },
  { key: 'dinner', labelBg: 'Вечеря', share: 0.55, categories: ['main', 'side'] },
]

// Above this, three plates can't hold the day without portions no one will
// actually eat — add an afternoon snack and re-share.
const FOUR_MEAL_KCAL = 2600
const MEAL_SLOTS_4 = [
  { key: 'breakfast', labelBg: 'Закуска',  share: 0.25, categories: ['breakfast'] },
  { key: 'lunch',     labelBg: 'Обяд',     share: 0.33, categories: ['main', 'side'] },
  { key: 'snack',     labelBg: 'Следобед', share: 0.12, categories: ['snack', 'breakfast'] },
  { key: 'dinner',    labelBg: 'Вечеря',   share: 0.30, categories: ['main', 'side'] },
]

// Lunch/dinner-type slots are the only ones a soup option makes sense in —
// never breakfast or the afternoon snack.
const SOUP_ELIGIBLE_SLOTS = new Set(['lunch', 'dinner'])
function isSoup(recipe) {
  return recipe.category === 'side' && recipe.name.includes('упа')
}

// forceCount: Kari can pin 3 or 4 meals explicitly instead of letting kcal
// decide — a client's eating rhythm (shift work, kids' school schedule) is
// hers to know, not something the calorie math should override.
function slotsFor(kcal, forceCount) {
  if (forceCount === 2) return MEAL_SLOTS_2
  if (forceCount === 3) return MEAL_SLOTS
  if (forceCount === 4) return MEAL_SLOTS_4
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
    // Soups run low-calorie-density (meat broth, not oil) — a hearty bowl as
    // a full meal is legitimately a bigger portion than a rice/potato side,
    // so it gets its own wider range instead of SERVING_RANGE's 250-450g.
    const [minG, maxG] = isSoup(recipe) ? [250, 600] : (SERVING_RANGE[slotKey] || SERVING_RANGE.lunch)
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

// A recipe is excluded if any of its ingredient names (or its own name)
// contains one of the exclude terms — case/diacritic-insensitive substring
// match, which is enough for "риба", "гъби", "кашкавал" etc.
function normalize(s) {
  return String(s || '').toLowerCase()
}
function recipeMatchesExclude(recipe, excludeTerms) {
  if (!excludeTerms || !excludeTerms.length) return false
  const haystack = normalize(
    recipe.name + ' ' + (recipe.ingredients || []).map(i => i.name).join(' ')
  )
  return excludeTerms.some(term => term && haystack.includes(normalize(term)))
}

// seedKey: anything stable per client+day. shuffle: bump to reroll.
// excludeTerms: food/ingredient words to keep out of every slot (admin
// "храни, които не яде" field, or a parsed refine instruction).
export function buildDayMenu(targets, seedKey = '', shuffle = 0, excludeTerms = [], forceMealCount = null) {
  if (!targets) return []
  const rand = mulberry32(hashString(`${seedKey}|${shuffle}`))
  const used = new Set()

  const slots = slotsFor(targets.kcal, forceMealCount)
  const results = slots.map(slot => {
    const slotTargets = {
      kcal:    Math.round(targets.kcal    * slot.share),
      protein: Math.round(targets.protein * slot.share),
      carbs:   Math.round(targets.carbs   * slot.share),
      fat:     Math.round(targets.fat     * slot.share),
    }
    const kcalTarget    = slotTargets.kcal
    const proteinTarget = slotTargets.protein

    const candidates = RECIPES
      .filter(r => slot.categories.includes(r.category) && !used.has(r.id)
        && !recipeMatchesExclude(r, excludeTerms))
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

    return { ...slot, kcalTarget, proteinTarget, slotTargets, options }
  })

  // Guarantee a soup choice somewhere across lunch/dinner — not forced into
  // every slot, just makes sure the day has one available. A whole bowl of
  // soup scaled up to the full slot target isn't a realistic serving, so
  // it's paired with a plain lean protein side instead ("Супа 400г + 150г
  // пилешко филе/телешко/бяла риба") — generic on purpose, since at this
  // gram range any of the three is close enough in macros that the client's
  // own preference should decide, not a specific recipe match.
  const SOUP_SHARE = 0.4
  const LEAN_PROTEIN_PER100 = { kcal: 165, protein: 31, carbs: 0, fat: 3.6 }
  const isSoupOption = o => isSoup(o.recipe) || o.isCombo
  const hasSoupAlready = results.some(r => SOUP_ELIGIBLE_SLOTS.has(r.key) && r.options.some(isSoupOption))
  if (!hasSoupAlready) {
    let bestFit = null
    for (const r of results) {
      if (!SOUP_ELIGIBLE_SLOTS.has(r.key) || !r.options.length) continue

      const soupKcalTarget = Math.round(r.kcalTarget * SOUP_SHARE)
      const soupOpt = RECIPES
        .filter(rec => isSoup(rec) && !recipeMatchesExclude(rec, excludeTerms))
        .map(rec => scaleRecipe(rec, soupKcalTarget, r.key))
        .filter(Boolean)
        .map(opt => ({ ...opt, score: scoreOption(opt, { ...r.slotTargets, kcal: soupKcalTarget }) }))
        .sort((a, b) => a.score - b.score)[0]
      if (!soupOpt) continue

      // Remaining calories as plain lean protein, rounded to 25g — no recipe
      // lookup needed, chicken/turkey/white fish all land close to this.
      const proteinKcalTarget = Math.max(100, r.kcalTarget - soupOpt.kcal)
      const proteinGrams = Math.round((proteinKcalTarget / LEAN_PROTEIN_PER100.kcal) * 100 / 25) * 25
      const proteinPer = proteinGrams / 100
      const proteinTotals = {
        kcal:    Math.round(LEAN_PROTEIN_PER100.kcal    * proteinPer),
        protein: Math.round(LEAN_PROTEIN_PER100.protein * proteinPer),
        carbs:   Math.round(LEAN_PROTEIN_PER100.carbs   * proteinPer),
        fat:     Math.round(LEAN_PROTEIN_PER100.fat     * proteinPer),
      }

      const comboTotals = {
        kcal:    soupOpt.kcal    + proteinTotals.kcal,
        protein: soupOpt.protein + proteinTotals.protein,
        carbs:   soupOpt.carbs   + proteinTotals.carbs,
        fat:     soupOpt.fat     + proteinTotals.fat,
      }
      const fatIng = (soupOpt.recipe.ingredients || []).find(ing => /олио|мазнина|зехтин/i.test(ing.name))
      // comboTotals already owns `protein` (the macro, in grams) — the
      // serving-info objects need their own names so the spread below
      // doesn't silently clobber one with the other.
      const combo = {
        recipe: { id: `combo-${soupOpt.recipe.id}`, name: 'Супа + протеин', category: 'combo' },
        mode: 'combo',
        isCombo: true,
        soupServing:    { grams: soupOpt.grams, label: 'Супа' },
        proteinServing: { grams: proteinGrams, label: 'пилешко филе / телешко / бяла риба' },
        fatNote: fatIng ? `При приготвяне на супата за цялата тенджера: ${fatIng.unit || ''} мазнина.` : null,
        ...comboTotals,
        score: scoreOption(comboTotals, r.slotTargets),
      }
      if (!bestFit || combo.score < bestFit.combo.score) {
        bestFit = { slotResult: r, combo }
      }
    }
    if (bestFit) {
      const { slotResult, combo } = bestFit
      slotResult.options = [...slotResult.options.slice(0, OPTIONS_PER_MEAL - 1), combo]
    }
  }

  return results.map(({ slotTargets, ...r }) => r)
}

// "1", "1½", "0¾" — portion multipliers read as fractions, not decimals.
export function formatFactor(factor) {
  const whole = Math.floor(factor)
  const frac  = factor - whole
  const glyph = frac === 0.25 ? '¼' : frac === 0.5 ? '½' : frac === 0.75 ? '¾' : ''
  if (!glyph) return String(whole)
  return whole === 0 ? glyph : `${whole}${glyph}`
}

// ── Admin "Хранителен план" builder (Кари) ─────────────────────────
// Overriding the calorie target never touches protein — it's tied to body
// weight, not to how aggressive the cut is. Fat keeps its 30%-of-kcal /
// 0.6g-per-kg floor rule, carbs take whatever is left, exactly like
// calcNutritionTargets itself.
export function applyKcalOverride(targets, newKcal, weightKg) {
  if (!targets || !newKcal || newKcal <= 0) return targets
  const kcal    = Math.round(newKcal)
  const protein = targets.protein
  const w       = Number(weightKg) || 0
  const fat     = Math.max(Math.round(w * 0.6), Math.round((kcal * 0.30) / 9))
  const carbs   = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return { ...targets, kcal, fat, carbs }
}

// Deterministic, no-AI parser for Kari's refine box. Only acts on patterns
// it recognises with confidence; anything else is left alone and surfaced
// back to her as "not understood" rather than guessed at.
//   "намали калориите на 1600" / "калориен таргет 1600" / "1600 ккал"
//     → { kcalTarget: 1600 }
//   "без риба", "изключи гъби", "не яде кашкавал"
//     → { excludeAdd: ['риба'] }
export function parseInstruction(text) {
  const result = { kcalTarget: null, excludeAdd: [], understood: [] }
  if (!text) return result
  const lower = text.toLowerCase()

  const kcalMatches = [...lower.matchAll(/(\d{3,4})\s*(ккал|kcal|калории)?/g)]
    .map(m => Number(m[1]))
    .filter(n => n >= 800 && n <= 5000)
  if (kcalMatches.length && /калор|ккал|kcal|таргет/.test(lower)) {
    result.kcalTarget = kcalMatches[kcalMatches.length - 1]
    result.understood.push(`нов калориен таргет: ${result.kcalTarget} ккал`)
  }

  const excludeRe = /(?:без|изключи|премахни|не яде|не обича|не иска)\s+([а-яa-z\s]{2,20}?)(?:[,.;]|$)/g
  let m
  while ((m = excludeRe.exec(lower))) {
    const term = m[1].trim().split(/\s+/)[0]
    if (term && term.length > 2) {
      result.excludeAdd.push(term)
      result.understood.push(`изключена храна: ${term}`)
    }
  }

  return result
}
