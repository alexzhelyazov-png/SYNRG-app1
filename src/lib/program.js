// ── Online Program (SYNRG method) — data access helpers ────────────
// Additive helpers over DB for the 8-week online program.
// Tables: program_weeks, program_workouts, program_workout_exercises,
//         program_weekly_tasks, exercise_library,
//         client_program_state, client_workout_completions,
//         client_weekly_task_completions

import { DB } from './db'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

// ── Week cadence: compute which week a client is on ────────────────
export function computeCurrentWeek(startedAtIso, paused = false, fallback = 1) {
  if (!startedAtIso) return fallback
  if (paused) return fallback
  const started = new Date(startedAtIso).getTime()
  if (!Number.isFinite(started)) return fallback
  const diff = Date.now() - started
  if (diff < 0) return 1
  const week = Math.floor(diff / WEEK_MS) + 1
  return Math.max(1, Math.min(week, 8))
}

// ── Program catalog (weeks + workouts + exercises) ─────────────────
export async function loadProgramCatalog() {
  const [weeks, workouts, joins, exercises, tasks] = await Promise.all([
    DB.selectAll('program_weeks',              '&order=week_number.asc'),
    DB.selectAll('program_workouts',           '&order=position.asc'),
    DB.selectAll('program_workout_exercises',  '&order=position.asc'),
    DB.selectAll('exercise_library',           '&order=name_bg.asc'),
    DB.selectAll('program_weekly_tasks',       '&order=position.asc'),
  ])

  const exerciseById = new Map((exercises || []).map(e => [e.id, e]))
  const workoutsByWeek = new Map()
  const tasksByWeek = new Map()
  const exercisesByWorkout = new Map()

  for (const j of joins || []) {
    const list = exercisesByWorkout.get(j.workout_id) || []
    const ex = exerciseById.get(j.exercise_id)
    if (ex) list.push({ ...j, exercise: ex })
    exercisesByWorkout.set(j.workout_id, list)
  }

  for (const w of workouts || []) {
    const list = workoutsByWeek.get(w.week_id) || []
    list.push({ ...w, exercises: exercisesByWorkout.get(w.id) || [] })
    workoutsByWeek.set(w.week_id, list)
  }

  for (const t of tasks || []) {
    const list = tasksByWeek.get(t.week_id) || []
    list.push(t)
    tasksByWeek.set(t.week_id, list)
  }

  const weeksFull = (weeks || []).map(w => ({
    ...w,
    workouts: workoutsByWeek.get(w.id) || [],
    tasks:    tasksByWeek.get(w.id)    || [],
  }))

  return {
    weeks: weeksFull,
    exercises: exercises || [],
  }
}

// ── Client program state ───────────────────────────────────────────
export async function loadClientProgramState(clientId) {
  if (!clientId) return null
  const rows = await DB.findWhere('client_program_state', 'client_id', clientId)
  return rows?.[0] || null
}

/**
 * Start (or re-start) the program for a client.
 * Called immediately after the onboarding quiz completes.
 *
 * `opts.consentAcceptedAt` — ISO timestamp captured when the client accepts
 * the educational-only disclaimer in the consent dialog. Stored alongside
 * the program state so we can prove informed consent if asked.
 */
export async function startClientProgram(clientId, opts = {}) {
  if (!clientId) return null
  const existing = await loadClientProgramState(clientId)
  const nowIso = new Date().toISOString()
  const consentAt = opts.consentAcceptedAt || null
  if (existing) {
    const patch = {
      started_at:   nowIso,
      current_week: 1,
      paused:       false,
      completed_at: null,
      updated_at:   nowIso,
    }
    // Only set consent_accepted_at if it wasn't recorded before, so we
    // preserve the original acceptance moment across re-starts.
    if (consentAt && !existing.consent_accepted_at) {
      patch.consent_accepted_at = consentAt
    }
    return DB.update('client_program_state', existing.client_id, patch)
  }
  // client_program_state uses client_id as PK, so insert directly.
  return DB.insert('client_program_state', {
    client_id:           clientId,
    started_at:          nowIso,
    current_week:        1,
    paused:              false,
    consent_accepted_at: consentAt,
  })
}

export async function pauseClientProgram(clientId, paused = true) {
  if (!clientId) return null
  return DB.update('client_program_state', clientId, {
    paused,
    updated_at: new Date().toISOString(),
  })
}

export async function advanceClientWeek(clientId, weekNumber) {
  if (!clientId) return null
  const clamped = Math.max(1, Math.min(8, weekNumber | 0))
  return DB.update('client_program_state', clientId, {
    current_week: clamped,
    updated_at:   new Date().toISOString(),
  })
}

// ── Workout completions ────────────────────────────────────────────
export async function logWorkoutCompletion({ clientId, workoutId, durationSec, notes }) {
  if (!clientId || !workoutId) return null
  const nowIso = new Date().toISOString()
  return DB.insert('client_workout_completions', {
    client_id:    clientId,
    workout_id:   workoutId,
    started_at:   nowIso,
    completed_at: nowIso,
    duration_sec: durationSec || null,
    notes:        notes || null,
  })
}

export async function loadClientWorkoutCompletions(clientId) {
  if (!clientId) return []
  return DB.findWhere('client_workout_completions', 'client_id', clientId)
}

// ── Weekly task completions ────────────────────────────────────────
export async function toggleWeeklyTask({ clientId, taskId, done }) {
  if (!clientId || !taskId) return null
  const existing = (await DB.findWhere('client_weekly_task_completions', 'client_id', clientId))
    .filter(r => r.task_id === taskId)
  if (done) {
    if (existing.length) return existing[0]
    return DB.insert('client_weekly_task_completions', {
      client_id:    clientId,
      task_id:      taskId,
      completed_at: new Date().toISOString(),
    })
  }
  // unmark
  for (const r of existing) await DB.deleteById('client_weekly_task_completions', r.id)
  return null
}

// ── Admin: content editing ─────────────────────────────────────────
export const ProgramAdmin = {
  // Exercise library
  createExercise: (row)    => DB.insert('exercise_library', row),
  updateExercise: (id, p)  => DB.update('exercise_library', id, p),
  deleteExercise: (id)     => DB.deleteById('exercise_library', id),

  // Weeks
  updateWeek:     (id, p)  => DB.update('program_weeks', id, p),

  // Workouts
  createWorkout:  (row)    => DB.insert('program_workouts', row),
  updateWorkout:  (id, p)  => DB.update('program_workouts', id, p),
  deleteWorkout:  (id)     => DB.deleteById('program_workouts', id),

  // Workout ↔ exercise
  addExerciseToWorkout:   (row)   => DB.insert('program_workout_exercises', row),
  updateWorkoutExercise:  (id, p) => DB.update('program_workout_exercises', id, p),
  removeWorkoutExercise:  (id)    => DB.deleteById('program_workout_exercises', id),

  // Weekly tasks
  createWeeklyTask: (row)   => DB.insert('program_weekly_tasks', row),
  updateWeeklyTask: (id, p) => DB.update('program_weekly_tasks', id, p),
  deleteWeeklyTask: (id)    => DB.deleteById('program_weekly_tasks', id),
}
