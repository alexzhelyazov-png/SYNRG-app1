// ── Level 1 Curriculum — 20 fixed workouts (beginner, home) ───────
//
// Founder spec:
//   • 3 rounds per workout
//   • 10-15 sec rest between exercises  (we use 12)
//   • 40-50 sec rest between rounds     (we use 45)
//   • Moderate intensity, no overload, smooth tempo
//
// Each entry maps a Bulgarian exercise name to a library slug + the
// duration in seconds.  `perSide: true` means the same exercise runs
// twice in a row (left side then right side, no rest between sides) —
// this is for movements where the library has a single video that the
// user performs on each leg/arm separately (e.g. donkey-kick).
//
// Slugs ending in "-l" are paired automatically with their "-r" mirror
// at runtime, so writing { slug: 'lunge-l', sec: 30 } means 30 sec
// left + 30 sec right with no rest between.
//
// Substitutes — the library doesn't yet have dedicated clips for these
// movements, so we point at the closest existing exercise.  Replace
// the slug as soon as the proper clip is uploaded.
//   • "Клек до стол"           → bodyweight-squat   (closest squat)
//   • "Лицеви от колене"        → burpee-knee-pushup (push-up motion)
//   • "Лицеви на висока опора"  → burpee-knee-pushup (push-up motion)
//   • "Глутеус мост"            → glute-bridge-press (closest bridge)
//   • "Планк"                   → plank-jack        (planking shape)

export const LEVEL_1_CURRICULUM = [
  // Workout 1
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // Клек до стол [sub]
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // Лицеви от колене [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 2
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'shoulder-press',      sec: 30 },
    { slug: 'lunge-l',             sec: 30 },                 // pairs with lunge-r
    { slug: 'glute-bridge-press',  sec: 40 },                 // Глутеус мост [sub]
    { slug: 'jumping-jacks',       sec: 25 },
    { slug: 'plank-jack',          sec: 25 },                 // Планк [sub]
  ],
  // Workout 3
  [
    { slug: 'reverse-plank-crunch',sec: 25 },                 // Обратен планк
    { slug: 'lateral-raise',       sec: 30 },                 // Разтваряне за рамо
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 30 },                 // Лицеви на висока опора [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 4
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 5
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'shoulder-press',      sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 6
  [
    { slug: 'reverse-plank-crunch',sec: 25 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'lunge-l',             sec: 30 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'burpee-knee-pushup',  sec: 30 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 7
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'lateral-raise',       sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 8
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 9
  [
    { slug: 'reverse-plank-crunch',sec: 25 },
    { slug: 'shoulder-press',      sec: 30 },
    { slug: 'lunge-l',             sec: 30 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 30 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 10
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 11
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'lateral-raise',       sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 12
  [
    { slug: 'reverse-plank-crunch',sec: 25 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'lunge-l',             sec: 30 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 13
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'shoulder-press',      sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 30 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 14
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 15
  [
    { slug: 'reverse-plank-crunch',sec: 25 },
    { slug: 'lateral-raise',       sec: 30 },
    { slug: 'lunge-l',             sec: 30 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 16
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 17
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'shoulder-press',      sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 30 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 18
  [
    { slug: 'reverse-plank-crunch',sec: 25 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'lunge-l',             sec: 30 },
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
  // Workout 19
  [
    { slug: 'crunch',              sec: 30 },
    { slug: 'lateral-raise',       sec: 30 },
    { slug: 'sumo-squat',          sec: 40 },
    { slug: 'donkey-kick',         sec: 30, perSide: true },
    { slug: 'burpee-knee-pushup',  sec: 25 },                 // [sub]
    { slug: 'high-knees',          sec: 30 },
  ],
  // Workout 20
  [
    { slug: 'superman',            sec: 30 },
    { slug: 'bent-over-row',       sec: 30 },
    { slug: 'bodyweight-squat',    sec: 40 },                 // [sub]
    { slug: 'glute-bridge-press',  sec: 40 },                 // [sub]
    { slug: 'plank-jack',          sec: 25 },                 // [sub]
    { slug: 'jumping-jacks',       sec: 25 },
  ],
]

export const LEVEL_1_CONFIG = {
  rounds: 3,
  rest_between_exercises_sec: 12,
  rest_between_rounds_sec: 45,
}
