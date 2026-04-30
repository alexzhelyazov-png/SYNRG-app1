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
export async function recordWorkoutCompletion({ clientId, dayIndex, workoutNumber, durationSec }) {
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
    return res.ok ? res.json() : null
  } catch { return null }
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
