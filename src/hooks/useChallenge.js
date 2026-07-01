// ── useChallenge ─────────────────────────────────────────────────
// Thin, NO DB calls. Reads `client` from context and runs challenge.js
// derivations. Reactive to log edits instantly because it derives from the
// in-memory client (meals / weightLogs / stepsLogs).

import { useMemo } from 'react'
import { useApp } from '../context/AppContext'
import {
  CHALLENGE_DAYS, CHALLENGE_LEN,
  progress, dayStatus, taskDone, currentDay,
} from '../lib/challenge'

export function useChallenge() {
  const { client } = useApp()

  return useMemo(() => {
    const status = client?.challengeStatus || null
    const startedOn = client?.challengeStartedOn || null
    const started = !!startedOn && status !== 'dismissed' && status !== null
      ? true
      : !!startedOn
    const p = progress(client)
    const day = startedOn ? currentDay(startedOn) : 0

    // Day-level progress dots (one per challenge day).
    const dots = CHALLENGE_DAYS.map(d => ({
      day: d.day,
      state: dayStatus(client, d.day), // locked | todo | done | missed
    }))

    // Today's checklist — the current day's tasks with per-task done flag.
    const todayDayObj = day >= 1 && day <= CHALLENGE_LEN ? CHALLENGE_DAYS[day - 1] : null
    const todayTasks = todayDayObj
      ? todayDayObj.tasks.map(t => ({ ...t, done: taskDone(client, day, t) }))
      : []
    const todayDone = todayTasks.length > 0 && todayTasks.every(t => t.done)

    return {
      status,
      startedOn,
      started,
      day: p.day,
      len: CHALLENGE_LEN,
      completedDays: p.completedDays,
      allDone: p.allDone,
      isOverdue: p.isOverdue,
      dots,
      todayTasks,
      todayDone,
    }
  }, [client])
}
