// ── Curriculum — 40 fixed workouts (Level 1 + Level 2) ────────────
//
// Founder spec:
//   • 6 exercises per workout
//   • 30 sec work / 10 sec rest between exercises
//   • 60 sec rest between rounds
//   • Level 1 (Начинаещ):  3 rounds — workouts 1-20
//   • Level 2 (Среден):    4 rounds — workouts 21-40
//
// Each entry maps a slug from `exercise_library` to a duration.
// Slugs ending in "-l" auto-pair with their "-r" mirror at runtime.
// `perSide: true` means same video runs twice (left then right).

export const LEVEL_1_CURRICULUM = [
  // ── Workout 1 ──────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'bicep-curl',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 2 ──────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'donkey-kick',       sec: 30, perSide: true },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 3 ──────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'lunge-l',           sec: 30 },
    { slug: 'tricep-kickback',   sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 4 ──────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'hammer-curl',       sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 5 ──────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'side-lunge-l',      sec: 30 },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 6 ──────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'donkey-kick',       sec: 30, perSide: true },
    { slug: 'bicep-curl',        sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 7 ──────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'tricep-kickback',   sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 8 ──────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'lunge-l',           sec: 30 },
    { slug: 'hammer-curl',       sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 9 ──────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'side-lunge-l',      sec: 30 },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 10 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'bicep-curl',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 11 ─────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'donkey-kick',       sec: 30, perSide: true },
    { slug: 'tricep-kickback',   sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 12 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'lunge-l',           sec: 30 },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 13 ─────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'hammer-curl',       sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 14 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'side-lunge-l',      sec: 30 },
    { slug: 'bicep-curl',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 15 ─────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'donkey-kick',       sec: 30, perSide: true },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 16 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'tricep-kickback',   sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 17 ─────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'lunge-l',           sec: 30 },
    { slug: 'bicep-curl',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 18 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'side-lunge-l',      sec: 30 },
    { slug: 'hammer-curl',       sec: 30 },
    { slug: 'superman',          sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'crunch',            sec: 30 },
  ],
  // ── Workout 19 ─────────────────────────────────────────────────
  [
    { slug: 'bodyweight-squat',  sec: 30 },
    { slug: 'glute-bridge',      sec: 30 },
    { slug: 'lateral-raise',     sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'jumping-jacks',     sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
  // ── Workout 20 ─────────────────────────────────────────────────
  [
    { slug: 'sumo-squat',        sec: 30 },
    { slug: 'donkey-kick',       sec: 30, perSide: true },
    { slug: 'tricep-kickback',   sec: 30 },
    { slug: 'crunch',            sec: 30 },
    { slug: 'high-knees',        sec: 30 },
    { slug: 'superman',          sec: 30 },
  ],
]

export const LEVEL_1_CONFIG = {
  rounds: 3,
  rest_between_exercises_sec: 10,
  rest_between_rounds_sec: 60,
}

// ── Level 2 — Средно напреднали (workouts 21-40) ────────────────────
// 4 rounds, same 30/10 work/rest, 60 sec between rounds.

export const LEVEL_2_CURRICULUM = [
  // ── Workout 21 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 22 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 23 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
  ],
  // ── Workout 24 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 25 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
  ],
  // ── Workout 26 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 27 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 28 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
  ],
  // ── Workout 29 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 30 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 31 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
  ],
  // ── Workout 32 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 33 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 34 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
  ],
  // ── Workout 35 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 36 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 37 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
  ],
  // ── Workout 38 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'lunge-squat-combo',    sec: 30 },
    { slug: 'pulse-squat',          sec: 30 },
    { slug: 'bent-over-row',        sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
    { slug: 'burpee',               sec: 30 },
  ],
  // ── Workout 39 ─────────────────────────────────────────────────
  [
    { slug: 'thruster',             sec: 30 },
    { slug: 'bulgarian-split-squat', sec: 30, perSide: true },
    { slug: 'jumping-lunges',       sec: 30 },
    { slug: 'around-the-world',     sec: 30 },
    { slug: 'crunch',               sec: 30 },
    { slug: 'burpee-knee-pushup',   sec: 30 },
  ],
  // ── Workout 40 ─────────────────────────────────────────────────
  [
    { slug: 'swing',                sec: 30 },
    { slug: 'sumo-squat-weighted',  sec: 30 },
    { slug: 'squat-knee-drive',     sec: 30 },
    { slug: 'shoulder-press',       sec: 30 },
    { slug: 'mountain-climber',     sec: 30 },
    { slug: 'bicycle-crunch',       sec: 30 },
  ],
]

export const LEVEL_2_CONFIG = {
  rounds: 4,
  rest_between_exercises_sec: 10,
  rest_between_rounds_sec: 60,
}
