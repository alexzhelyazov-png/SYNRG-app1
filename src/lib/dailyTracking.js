// ── Daily tracking helpers ───────────────────────────────────────
// Reads / writes the two completion tables that drive the unified
// "ДНЕС" block on the dashboard:
//
//   client_daily_workout_completions   one row per (client, date)
//   client_weekly_task_completions     one row per (client, task, date)

import { DB } from './db'

const SB_URL  = import.meta.env.VITE_SUPABASE_URL
const SB_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY
const SOFIA_TZ = 'Europe/Sofia'

function sbHeaders(extra = {}) {
  return {
    apikey: SB_ANON,
    Authorization: `Bearer ${SB_ANON}`,
    ...extra,
  }
}

// ── Date helpers (local Sofia time) ──────────────────────────────
function localDateString(d = new Date()) {
  // YYYY-MM-DD in Sofia local time, regardless of the device tz.
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: SOFIA_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  })
  return fmt.format(d)  // en-CA → "2026-04-30"
}

function startOfWeekString(d = new Date()) {
  // Monday = first day of week.
  const today = new Date(localDateString(d) + 'T00:00:00')
  const day = today.getDay()           // 0=Sunday … 6=Saturday
  const diffToMon = (day + 6) % 7      // days back to Monday
  const mon = new Date(today)
  mon.setDate(today.getDate() - diffToMon)
  return localDateString(mon)
}

export const todayLocalDate = () => localDateString()
export const monStartLocalDate = () => startOfWeekString()

// ── Workout completions ──────────────────────────────────────────
// Convert today's YYYY-MM-DD (Sofia tz) to the legacy DD.MM.YYYY format
// used by the `workouts` table + gamification engine.
function todayDotDate() {
  const iso = todayLocalDate()       // YYYY-MM-DD
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y}`
}

export async function recordWorkoutCompletion({ clientId, dayIndex, workoutNumber, durationSec, workout }) {
  if (!clientId || !SB_URL) return null
  const body = {
    client_id: clientId,
    day_index: dayIndex,
    workout_number: workoutNumber,
    for_date: todayLocalDate(),
    completed_at: new Date().toISOString(),
    duration_sec: durationSec || null,
  }
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/client_daily_workout_completions?on_conflict=client_id,for_date`,
      {
        method: 'POST',
        headers: sbHeaders({
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify(body),
      }
    )

    // ── Also write a row to legacy `workouts` so the gamification
    // engine (which reads client.workouts) counts this completion
    // toward badges, levels, monthly XP and streaks.
    // We dedupe on (client_id, date) — one workout row per training day.
    if (workout && workout.sections?.[0]?.exercises) {
      const dotDate = todayDotDate()
      const items = workout.sections[0].exercises.map(ex => ({
        exercise: ex.name_bg || ex.name_en || ex.slug || '',
        scheme:   `${workout.sections[0].rounds || 3}x${ex.prescribed || 30}sec`,
        weight:   '',
      }))
      // Only insert if no workout row for today exists yet (avoid duplicates
      // when the user replays the same workout). Cheap PATCH on conflict not
      // available since `workouts` has no unique constraint — use a guard fetch.
      const existing = await fetch(
        `${SB_URL}/rest/v1/workouts?client_id=eq.${clientId}&date=eq.${dotDate}&select=id&limit=1`,
        { headers: sbHeaders() }
      ).then(r => r.ok ? r.json() : []).catch(() => [])
      if (!Array.isArray(existing) || existing.length === 0) {
        await fetch(`${SB_URL}/rest/v1/workouts`, {
          method: 'POST',
          headers: sbHeaders({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }),
          body: JSON.stringify({
            client_id: clientId,
            date:      dotDate,
            coach:     'SYNRG',
            category:  'Цяло тяло',
            items,
          }),
        }).catch(() => {})
      }
    }

    return res.ok ? res.json() : null
  } catch { return null }
}

// Returns the completion row for today (or null if not done yet).
// Used by the dashboard banner to show "Готова" + checkmark instead of
// the "Започни" CTA after the user completes today's workout.
export async function loadTodayWorkoutCompletion(clientId) {
  if (!clientId) return null
  const today = todayLocalDate()
  const rows = await DB.selectAll(
    'client_daily_workout_completions',
    `&client_id=eq.${clientId}&for_date=eq.${today}&limit=1`
  )
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null
}

export async function countWorkoutsThisWeek(clientId) {
  if (!clientId) return 0
  const start = monStartLocalDate()
  const today = todayLocalDate()
  const rows = await DB.selectAll(
    'client_daily_workout_completions',
    `&client_id=eq.${clientId}&for_date=gte.${start}&for_date=lte.${today}`
  )
  return Array.isArray(rows) ? rows.length : 0
}

// ── Habit (weekly-task) completions ──────────────────────────────
export async function loadHabitCompletionsThisWeek(clientId) {
  if (!clientId) return {}
  const start = monStartLocalDate()
  const today = todayLocalDate()
  const rows = await DB.selectAll(
    'client_weekly_task_completions',
    `&client_id=eq.${clientId}&for_date=gte.${start}&for_date=lte.${today}`
  )
  // Build { taskId: { count, doneToday } }
  const out = {}
  if (Array.isArray(rows)) {
    for (const r of rows) {
      const slot = out[r.task_id] || { count: 0, doneToday: false }
      slot.count += 1
      if (r.for_date === today) slot.doneToday = true
      out[r.task_id] = slot
    }
  }
  return out
}

export async function toggleHabitForToday({ clientId, taskId, currentlyDone }) {
  if (!clientId || !taskId || !SB_URL) return null
  const today = todayLocalDate()
  if (currentlyDone) {
    try {
      await fetch(
        `${SB_URL}/rest/v1/client_weekly_task_completions?client_id=eq.${clientId}&task_id=eq.${taskId}&for_date=eq.${today}`,
        { method: 'DELETE', headers: sbHeaders() }
      )
      return { removed: true }
    } catch { return null }
  }
  try {
    const res = await fetch(
      `${SB_URL}/rest/v1/client_weekly_task_completions?on_conflict=client_id,task_id,for_date`,
      {
        method: 'POST',
        headers: sbHeaders({
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation',
        }),
        body: JSON.stringify({
          client_id: clientId,
          task_id: taskId,
          for_date: today,
          completed_at: new Date().toISOString(),
        }),
      }
    )
    return res.ok ? res.json() : null
  } catch { return null }
}
