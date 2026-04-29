// ── OnlineHome ─────────────────────────────────────────────────────
// Home screen for ONLINE clients (those with an active program_purchases row).
// Shows:
//   • Welcome card on day 1 (first visit only)
//   • Hero for the current week (title, subtitle, day N of 84)
//   • Week picker (1–12)
//   • Daily actions (food/weight/steps) — prominent, with weekly streak
//   • Weekly context list (secondary)
//   • Workouts for this week (or friendly empty state)
//   • Coach chat CTA
//
// Studio clients continue to see the original <Dashboard />.

import { useEffect, useMemo, useState } from 'react'
import { Box, Typography, Paper, LinearProgress, Chip, Button, Skeleton, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Checkbox, FormControlLabel } from '@mui/material'
import LockIcon from '@mui/icons-material/Lock'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import CloseIcon from '@mui/icons-material/Close'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import MonitorWeightOutlinedIcon from '@mui/icons-material/MonitorWeightOutlined'
import RestaurantOutlinedIcon from '@mui/icons-material/RestaurantOutlined'
import DirectionsRunOutlinedIcon from '@mui/icons-material/DirectionsRunOutlined'
import LocalDrinkOutlinedIcon from '@mui/icons-material/LocalDrinkOutlined'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import { Collapse } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import {
  loadProgramCatalog,
  loadClientProgramState,
  loadClientWorkoutCompletions,
  computeCurrentWeek,
  startClientProgram,
} from '../lib/program'
import { DB } from '../lib/db'
import { QuizScreen, calcTargets } from './SynrgMethod'
import ExpertTeam from '../components/ExpertTeam'
import TodayWorkoutCard from '../components/TodayWorkoutCard'

const TOTAL_WEEKS = 8
const TOTAL_DAYS  = TOTAL_WEEKS * 7

// Today's date string (YYYY-MM-DD local)
function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Days between two dates (UTC-agnostic)
function daysBetween(fromIso, toDate = new Date()) {
  if (!fromIso) return 0
  const from = new Date(fromIso)
  if (Number.isNaN(from.getTime())) return 0
  const dayMs = 24 * 60 * 60 * 1000
  return Math.floor((toDate.getTime() - from.getTime()) / dayMs)
}

// ── Task content helpers ───────────────────────────────────────────
// Tasks that mirror the workout-cards section below — hide from focus list.
function isWorkoutTask(t) {
  return /трениров/i.test(String(t?.title_bg || ''))
}
// Carry-over tasks ("Продължи да записваш ...", "Продължи с навиците от ...")
// are replaced by the generated "Продължи с навиците от предишни седмици" UI.
function isCarryOverTask(t) {
  const s = String(t?.title_bg || '').trim().toLowerCase()
  return /^продължи (да записваш|с (всички )?навиц)/i.test(s)
}
// Substitute placeholders in human-authored task copy.
// Supports `{weight}` and `{kcal_packaged}` (= weight × 3).
// Placeholders only — leaves any literal "тегло × 3" in descriptions
// intact so the formula can be shown as part of the explanation.
function applyTaskVars(text, weightKg) {
  if (!text) return text
  const w = Number(weightKg)
  if (!Number.isFinite(w) || w <= 0) {
    return String(text)
      .replace(/\{weight\}/gi, '')
      .replace(/\{kcal_packaged\}/gi, '')
  }
  const kcal = Math.round(w * 3)
  return String(text)
    .replace(/\{kcal_packaged\}/gi, String(kcal))
    .replace(/\{weight\}/gi, String(w))
}
// Back-compat alias used in render code.
function formatTaskTitle(title, weightKg) { return applyTaskVars(title, weightKg) }

// ── Shared row template used inside the unified ДНЕС block ──────────
// Every action in the day card uses the same shape — left circle icon,
// title in italic, optional right slot — so the eye reads them as
// siblings. The accent prop swaps the icon-circle colour to signal
// what kind of action the row represents:
//   • 'mint'  trackable daily action (workout, log, etc.)
//   • 'done'  same as mint but with the check icon (already complete)
//   • 'logan' informational / educational behavioural habit
function DailyTaskRow({ Icon, label, rightSlot, accent = 'mint', onClick }) {
  const isLogan = accent === 'logan'
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 1.25,
        px: 1, py: 0.75, borderRadius: 1.5,
        cursor: 'pointer', transition: 'background 120ms ease',
        '&:hover': { background: isLogan ? 'rgba(170,169,205,0.08)' : 'rgba(196,233,191,0.06)' },
      }}
    >
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%',
        background: isLogan ? 'rgba(170,169,205,0.14)' : 'rgba(196,233,191,0.10)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon sx={{ fontSize: 17, color: isLogan ? '#AAA9CD' : '#C4E9BF' }} />
      </Box>
      <Typography sx={{
        flex: 1, minWidth: 0,
        fontSize: 14, fontWeight: 700, fontStyle: 'italic',
        fontFamily: "'MontBlanc', sans-serif", color: '#f0eded', lineHeight: 1.2,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </Typography>
      {rightSlot}
    </Box>
  )
}

export default function OnlineHome() {
  const { auth, setView, t, client, updateClient } = useApp()
  const [loading,       setLoading]        = useState(true)
  const [weeks,         setWeeks]          = useState([])
  const [state,         setState]          = useState(null)
  const [completions,   setCompletions]    = useState([])
  const [taskCompletions, setTaskCompletions] = useState([])
  const [selectedWeek,  setSelectedWeek]   = useState(1)
  const [taskDialog, setTaskDialog] = useState(null) // { title_bg, description } or null
  const [showCarryHabits, setShowCarryHabits] = useState(false)
  // ── Onboarding flow state ──────────────────────────────────────
  // For brand-new online clients (no client_program_state row, no quiz),
  // we render a full-screen sequence BEFORE the dashboard:
  //   1. ConsentScreen — educational-only disclaimer + checkbox
  //   2. QuizScreen    — collects weight/height/goal/etc.
  //   3. startClientProgram() with consent timestamp
  //   4. Fall through to OnlineHome dashboard, WelcomeTour activates
  // `consentAccepted` is local-only (until program starts and we persist
  // consent_accepted_at). `quizSaving` flips while we POST quiz answers.
  const [consentChecked, setConsentChecked] = useState(false)
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [quizSaving, setQuizSaving] = useState(false)

  // Load catalog + per-client state
  useEffect(() => {
    if (!auth?.id) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      loadProgramCatalog(),
      loadClientProgramState(auth.id),
      loadClientWorkoutCompletions(auth.id),
      DB.findWhere('client_weekly_task_completions', 'client_id', auth.id),
    ]).then(async ([catalog, st, comps, tcomps]) => {
      if (cancelled) return
      // No auto-start anymore — the program is started only after the
      // client accepts the educational-only disclaimer in the consent
      // dialog (see <Dialog> below). If state is missing, we render the
      // page in a "pre-start" mode and prompt for consent.
      const effectiveState = st || null
      setWeeks(catalog?.weeks || [])
      setState(effectiveState)
      setCompletions(comps || [])
      setTaskCompletions(tcomps || [])
      const currentWeek = effectiveState
        ? (effectiveState.paused
            ? effectiveState.current_week
            : computeCurrentWeek(effectiveState.started_at, effectiveState.paused, effectiveState.current_week))
        : 1
      setSelectedWeek(currentWeek)
      setLoading(false)
    }).catch(() => {
      if (cancelled) return
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [auth?.id])

  const currentWeek = useMemo(() => {
    if (!state) return 1
    return state.paused
      ? state.current_week
      : computeCurrentWeek(state.started_at, state.paused, state.current_week)
  }, [state])

  // Day number (1..84). If no state yet, assume day 1.
  const dayNumber = useMemo(() => {
    if (!state?.started_at) return 1
    const d = daysBetween(state.started_at) + 1
    return Math.max(1, Math.min(d, TOTAL_DAYS))
  }, [state?.started_at])

  const selected = weeks.find(w => w.week_number === selectedWeek) || null

  // Weight from quiz (preferred) or fallback to most recent weight log.
  // Used to substitute placeholders like "3 × тегло (кг)" in task titles.
  const weightForTasks = useMemo(() => {
    const q = Number(client?.synrgQuiz?.weight)
    if (Number.isFinite(q) && q > 0) return q
    const logs = client?.weightLogs || []
    const last = logs[logs.length - 1] || logs[0]
    const w = Number(last?.weight)
    return Number.isFinite(w) && w > 0 ? w : null
  }, [client?.synrgQuiz?.weight, client?.weightLogs])

  // Visible focus tasks for the selected week — drop redundant
  // workout/journal nags; carry-over rendered separately below.
  const visibleTasks = useMemo(
    () => (selected?.tasks || []).filter(t => !isWorkoutTask(t) && !isCarryOverTask(t)),
    [selected]
  )

  // Behavioural habits = visible weekly tasks minus the few whose phrasing
  // overlaps the daily tracker buttons ("Тегли се…", "Записвай храната…").
  // Filtering by task_type alone is too aggressive — most nutrition-typed
  // tasks are valuable habits ("добави фибри", "яж когато си гладен").
  const DAILY_LOG_DUP_PATTERNS = [
    /тегли\s+се/i,                  // "Тегли се всяка сутрин" — same as weight log
    /записвай.*(?:храна|ядеш)/i,    // "Записвай всичко, което ядеш" — same as food log
  ]
  const behaviouralHabits = useMemo(
    () => visibleTasks.filter(t =>
      !DAILY_LOG_DUP_PATTERNS.some(p => p.test(t.title_bg || ''))
    ),
    [visibleTasks]
  )

  // Habits from earlier weeks, grouped per week. Empty groups are dropped.
  const previousHabits = useMemo(() => {
    if (!selectedWeek || selectedWeek < 2) return []
    return weeks
      .filter(w => w.week_number < selectedWeek)
      .sort((a, b) => a.week_number - b.week_number)
      .map(w => ({
        weekNumber: w.week_number,
        title:      w.title_bg || `Седмица ${w.week_number}`,
        tasks:      (w.tasks || []).filter(t => !isWorkoutTask(t) && !isCarryOverTask(t)),
      }))
      .filter(g => g.tasks.length > 0)
  }, [weeks, selectedWeek])

  const doneWorkoutIds = useMemo(() => {
    const s = new Set()
    for (const c of completions) if (c.completed_at) s.add(c.workout_id)
    return s
  }, [completions])

  // Daily compliance — food/weight/steps are the dailies.
  // Normalize stored dates: accept either YYYY-MM-DD or DD.MM.YYYY so a log
  // made today is recognized regardless of the field's storage format.
  const today = todayStr()
  const sameDay = (dateStr, target) => {
    if (!dateStr) return false
    let ds = String(dateStr)
    const m = ds.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
    if (m) ds = `${m[3]}-${m[2]}-${m[1]}`
    return ds === target
  }
  const didFoodToday   = useMemo(
    () => (client?.meals      || []).some(m => sameDay(m.date, today)),
    [client?.meals, today]
  )
  const didWeightToday = useMemo(
    () => (client?.weightLogs || []).some(w => sameDay(w.date, today)),
    [client?.weightLogs, today]
  )
  const didStepsToday  = useMemo(
    () => (client?.stepsLogs  || []).some(s => sameDay(s.date, today) && Number(s.steps) > 0),
    [client?.stepsLogs, today]
  )
  const dailiesDoneCount = (didFoodToday ? 1 : 0) + (didWeightToday ? 1 : 0) + (didStepsToday ? 1 : 0)

  // Weekly streak — how many days this week each tracker was logged.
  // If we have a program state, anchor to started_at + (currentWeek-1)*7.
  // Otherwise fall back to a rolling 7-day window ending today so counters
  // still work for online clients whose client_program_state row hasn't
  // been created yet (program auto-start isn't wired to quiz yet).
  const weeklyStreaks = useMemo(() => {
    const toYmd = (d) => {
      const y = d.getFullYear()
      const m = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${y}-${m}-${dd}`
    }
    let weekStartStr
    if (state?.started_at) {
      const ws = new Date(state.started_at)
      ws.setDate(ws.getDate() + (currentWeek - 1) * 7)
      weekStartStr = toYmd(ws)
    } else {
      const ws = new Date()
      ws.setDate(ws.getDate() - 6) // last 7 days including today
      weekStartStr = toYmd(ws)
    }
    const inWeek = (dateStr) => {
      if (!dateStr) return false
      // normalize DD.MM.YYYY → YYYY-MM-DD if needed
      let ds = String(dateStr)
      const m = ds.match(/^(\d{2})\.(\d{2})\.(\d{4})$/)
      if (m) ds = `${m[3]}-${m[2]}-${m[1]}`
      return ds >= weekStartStr && ds <= today
    }
    const foodDays   = new Set((client?.meals      || []).filter(m => inWeek(m.date)).map(m => m.date))
    const weightDays = new Set((client?.weightLogs || []).filter(w => inWeek(w.date)).map(w => w.date))
    const stepsDays  = new Set((client?.stepsLogs  || []).filter(s => inWeek(s.date) && Number(s.steps) > 0).map(s => s.date))
    return { food: foodDays.size, weight: weightDays.size, steps: stepsDays.size }
  }, [state?.started_at, currentWeek, today, client?.meals, client?.weightLogs, client?.stepsLogs])

  // First undone daily — priority marker
  const firstUndoneView = !didWeightToday ? 'weight' : !didFoodToday ? 'food' : !didStepsToday ? 'steps' : null

  const progressPct = Math.round((dayNumber / TOTAL_DAYS) * 100)

  if (loading) {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pb: 4 }}>
        <Skeleton variant="rounded" width="100%" height={180} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" width="100%" height={120} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" width="100%" height={200} />
      </Box>
    )
  }

  // ── Onboarding gate ─────────────────────────────────────────────
  // If the client has no program state row yet, walk them through the
  // post-payment flow (consent → quiz → program start) BEFORE showing
  // the dashboard. WelcomeTour will pick up automatically once we land
  // on the dashboard for the first time (its dismissed flag is unset
  // for new clients).
  const needsOnboarding = !state

  if (needsOnboarding && !consentAccepted) {
    return (
      <ConsentScreen
        checked={consentChecked}
        onToggle={(v) => setConsentChecked(v)}
        onAccept={() => setConsentAccepted(true)}
      />
    )
  }

  if (needsOnboarding && !client?.synrgQuiz) {
    return (
      <QuizScreen
        isBg={true}
        onDone={async (answers) => {
          if (!auth?.id || quizSaving) return
          setQuizSaving(true)
          try {
            // 1. Persist quiz answers + targets on clients row
            const patch = { synrg_quiz: answers }
            if (!client?.synrgStartedAt) {
              patch.synrg_started_at = new Date().toISOString().split('T')[0]
            }
            const { protein, kcal } = calcTargets(answers.weight, answers.height, answers.goal)
            if (protein > 0) patch.protein_target = protein
            if (kcal > 0)    patch.calorie_target = kcal
            await DB.update('clients', auth.id, patch)
            updateClient(c => ({
              ...c,
              ...(patch.synrg_started_at ? { synrgStartedAt: patch.synrg_started_at } : {}),
              ...(patch.protein_target   ? { proteinTarget:  patch.protein_target }   : {}),
              ...(patch.calorie_target   ? { calorieTarget:  patch.calorie_target }   : {}),
              synrgQuiz: answers,
            }))

            // 2. Start the program with the consent timestamp captured a moment ago
            const created = await startClientProgram(auth.id, {
              consentAcceptedAt: new Date().toISOString(),
            })
            const effective = created || await loadClientProgramState(auth.id)
            if (effective) {
              setState(effective)
              setSelectedWeek(
                effective.paused
                  ? effective.current_week
                  : computeCurrentWeek(effective.started_at, effective.paused, effective.current_week)
              )
            }
          } catch (e) {
            console.error('onboarding save failed', e)
          } finally {
            setQuizSaving(false)
          }
        }}
      />
    )
  }

  // Quiz already filled in a previous session but no program started yet
  // (e.g. user dropped off mid-flow). Skip directly to starting the program.
  if (needsOnboarding && client?.synrgQuiz && !quizSaving) {
    // Defer to next tick so we don't trigger a state update during render.
    Promise.resolve().then(async () => {
      if (state || quizSaving) return
      setQuizSaving(true)
      try {
        const created = await startClientProgram(auth.id, {
          consentAcceptedAt: new Date().toISOString(),
        })
        const effective = created || await loadClientProgramState(auth.id)
        if (effective) {
          setState(effective)
          setSelectedWeek(
            effective.paused
              ? effective.current_week
              : computeCurrentWeek(effective.started_at, effective.paused, effective.current_week)
          )
        }
      } finally {
        setQuizSaving(false)
      }
    })
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', pb: 4 }}>
        <Skeleton variant="rounded" width="100%" height={180} sx={{ mb: 2 }} />
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto', pb: 4 }}>
      {/* ── Hero: current week ── */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          mb: 2,
          borderRadius: 3,
          background: `linear-gradient(135deg, ${C.loganDim} 0%, ${C.primaryContainer} 55%, rgba(255,255,255,0.04) 100%)`,
          border: `1px solid ${C.loganBorder}`,
        }}
      >
        <Typography sx={{ fontSize: 12, color: C.logan, letterSpacing: 1.5, fontWeight: 700 }}>
          SYNRG МЕТОД · ДЕН {dayNumber} ОТ {TOTAL_DAYS}
        </Typography>
        <Typography
          sx={{
            mt: 1,
            fontSize: { xs: 28, sm: 34 },
            fontWeight: 800,
            fontStyle: 'italic',
            color: C.text,
            lineHeight: 1.15,
          }}
        >
          {weeks.find(w => w.week_number === currentWeek)?.title_bg || `Седмица ${currentWeek}`}
        </Typography>
        {weeks.find(w => w.week_number === currentWeek)?.subtitle_bg && (
          <Typography sx={{ mt: 0.5, color: C.muted, fontSize: 15 }}>
            {weeks.find(w => w.week_number === currentWeek).subtitle_bg}
          </Typography>
        )}
        <Box sx={{ mt: 2 }}>
          <LinearProgress
            variant="determinate"
            value={progressPct}
            sx={{
              height: 8,
              borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              '& .MuiLinearProgress-bar': {
                background: `linear-gradient(90deg, ${C.logan} 0%, ${C.primary} 100%)`,
                borderRadius: 99,
              },
            }}
          />
          <Typography sx={{ mt: 0.75, fontSize: 12, color: C.muted }}>
            Седмица {currentWeek} от {TOTAL_WEEKS}
          </Typography>
        </Box>
      </Paper>

      {/* ── Week picker strip ── */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
          mb: 2,
          '&::-webkit-scrollbar': { display: 'none' },
        }}
      >
        {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(n => {
          const locked = false // unlocked for dev — all weeks viewable
          const active = n === selectedWeek
          return (
            <Chip
              key={n}
              label={locked ? `${n}` : `Седмица ${n}`}
              icon={locked ? <LockIcon sx={{ fontSize: 14 }} /> : undefined}
              onClick={() => !locked && setSelectedWeek(n)}
              sx={{
                flexShrink: 0,
                height: 36,
                px: 1,
                borderRadius: 99,
                fontWeight: 700,
                fontSize: 13,
                cursor: locked ? 'default' : 'pointer',
                opacity: locked ? 0.45 : 1,
                background: active ? C.primary : 'rgba(255,255,255,0.06)',
                color: active ? '#0A2E0F' : C.text,
                border: `1px solid ${active ? C.primary : C.border}`,
                '&:hover': !locked && !active ? { background: 'rgba(255,255,255,0.10)' } : undefined,
              }}
            />
          )
        })}
      </Box>

      {!selected && (
        <Typography sx={{ color: C.muted, textAlign: 'center', py: 4 }}>
          Тази седмица все още няма съдържание.
        </Typography>
      )}

      {selected && (
        <>
          {/* ── ДНЕС — single visual block: workout + logs + habits ── */}
          <Box data-tour="today" sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.text, mb: 1.25 }}>
              ДНЕС
            </Typography>
            <Paper
              elevation={0}
              sx={{
                p: 1, borderRadius: 2.5,
                border: `1px solid ${C.loganBorder}`,
                background: `linear-gradient(135deg, rgba(196,233,191,0.04) 0%, rgba(255,255,255,0.02) 100%)`,
                display: 'flex', flexDirection: 'column',
              }}
            >
              {/* Тренировка днес — flat (no own border, parent owns the frame) */}
              <TodayWorkoutCard
                clientId={auth?.id}
                programStartedAt={state?.started_at}
                difficulty={1}
                flat
              />

              <Box sx={{ height: 1, background: C.border, my: 0.5 }} />

              {/* Daily logs (weight / food / steps) — same row template as the
                  workout banner above; mint accent signals they're trackable
                  daily actions. Streak count on the right shows weekly progress. */}
              <Box data-tour="dailies" sx={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { view: 'weight', label: 'тегло',  Icon: MonitorWeightOutlinedIcon, done: didWeightToday, streak: weeklyStreaks.weight },
                  { view: 'food',   label: 'храна',  Icon: RestaurantOutlinedIcon,    done: didFoodToday,   streak: weeklyStreaks.food   },
                  { view: 'steps',  label: 'стъпки', Icon: DirectionsRunOutlinedIcon, done: didStepsToday,  streak: weeklyStreaks.steps  },
                ].map(item => (
                  <DailyTaskRow
                    key={item.view}
                    Icon={item.Icon}
                    label={item.label}
                    rightSlot={
                      <Typography sx={{
                        fontSize: 11, fontWeight: 700,
                        color: item.streak >= 5 ? C.primary : C.muted,
                      }}>
                        {item.streak}/7 дни
                      </Typography>
                    }
                    accent={item.done ? 'done' : 'mint'}
                    onClick={() => setView(item.view)}
                  />
                ))}
              </Box>

              {/* Behavioural weekly habits (water, no-sugar drinks, etc.) — same
                  row template, with the logan accent signalling they're
                  informational/educational rather than trackable. */}
              {behaviouralHabits.length > 0 && (
                <>
                  <Box sx={{ height: 1, background: C.border, my: 0.25 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    {behaviouralHabits.map(task => (
                      <DailyTaskRow
                        key={task.id}
                        Icon={LocalDrinkOutlinedIcon}
                        label={formatTaskTitle(task.title_bg, weightForTasks)}
                        rightSlot={task.description
                          ? <InfoOutlinedIcon sx={{ fontSize: 16, color: C.muted }} />
                          : null}
                        accent="logan"
                        onClick={() => setTaskDialog(task)}
                      />
                    ))}
                  </Box>
                </>
              )}
            </Paper>
          </Box>{/* /ДНЕС unified block */}

          {/* Carry-over habits from earlier weeks (separate, collapsible) */}
          {previousHabits.length > 0 && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5, mb: 3, borderRadius: 2.5,
                border: `1px solid ${C.border}`,
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <Box
                onClick={() => setShowCarryHabits(s => !s)}
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', borderRadius: 1.5, px: 0.5, mx: -0.5, py: 0.25,
                  '&:hover': { background: 'rgba(170,169,205,0.06)' },
                }}
              >
                <Typography sx={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>
                  {t('continueWithHabitsFromWeeksLbl')
                    .replace('{from}', '1')
                    .replace('{to}', String(selectedWeek - 1))}
                </Typography>
                {showCarryHabits
                  ? <ExpandLessIcon sx={{ fontSize: 18, color: C.muted }} />
                  : <ExpandMoreIcon sx={{ fontSize: 18, color: C.muted }} />}
              </Box>
              <Collapse in={showCarryHabits} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {previousHabits.map(group => (
                    <Box key={group.weekNumber}>
                      <Typography sx={{
                        fontSize: 10, letterSpacing: 1.2, fontWeight: 700,
                        color: C.logan, mb: 0.25,
                      }}>
                        {t('weekShortLbl')} {group.weekNumber}
                      </Typography>
                      {group.tasks.map(t2 => (
                        <Box
                          key={t2.id}
                          onClick={() => setTaskDialog(t2)}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1,
                            py: 0.4, px: 0.5, mx: -0.5, borderRadius: 1, cursor: 'pointer',
                            '&:hover': { background: 'rgba(170,169,205,0.06)' },
                          }}
                        >
                          <Box sx={{
                            flexShrink: 0, width: 4, height: 4, borderRadius: '50%', background: C.muted,
                          }} />
                          <Typography sx={{
                            fontSize: 12.5, color: C.text, lineHeight: 1.35,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {formatTaskTitle(t2.title_bg, weightForTasks)}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  ))}
                </Box>
              </Collapse>
            </Paper>
          )}

          {/* ── Legacy week-based workouts (only when admin has seeded program_workouts) ── */}
          {selected.workouts?.length > 0 && (
            <Box data-tour="workout" sx={{ mb: 3 }}>
              <Typography sx={{ fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.muted, mb: 1.25 }}>
                ТРЕНИРОВКИ ОТ ПРОГРАМАТА
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                {selected.workouts.map(w => {
                  const done = doneWorkoutIds.has(w.id)
                  const locked = false // unlocked for dev — all weeks viewable
                  return (
                    <Paper
                      key={w.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        border: `1px solid ${done ? C.primaryA20 : C.border}`,
                        background: done ? C.primaryContainer : 'rgba(255,255,255,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        cursor: locked ? 'default' : 'pointer',
                        opacity: locked ? 0.5 : 1,
                        transition: 'background 120ms ease',
                        '&:hover': !locked ? { background: 'rgba(255,255,255,0.05)' } : undefined,
                      }}
                      onClick={() => {
                        if (locked) return
                        setView(`program_workout:${w.id}`)
                      }}
                    >
                      {done
                        ? <CheckCircleIcon sx={{ color: C.primary }} />
                        : <PlayArrowIcon sx={{ color: C.purple }} />}
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700, color: C.text, fontSize: 15 }}>
                          {w.title_bg}
                        </Typography>
                        <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.25 }}>
                          {w.workout_type === 'warmup'   ? 'ЗАГРЯВКА' :
                           w.workout_type === 'cooldown' ? 'ОХЛАЖДАНЕ' :
                           w.workout_type === 'mobility' ? 'МОБИЛНОСТ' : 'ОСНОВНА'}
                          {w.time_cap_sec ? ` · ${Math.round(w.time_cap_sec/60)} мин` : ''}
                          {w.rounds && w.rounds > 1 ? ` · ${w.rounds} рунда` : ''}
                          {w.exercises?.length ? ` · ${w.exercises.length} упражнения` : ''}
                        </Typography>
                      </Box>
                      {locked && <LockIcon sx={{ color: C.muted, fontSize: 18 }} />}
                    </Paper>
                  )
                })}
              </Box>
            </Box>
          )}

          {/* ── Coach chat CTA ── */}
          <Paper
            elevation={0}
            data-tour="chat"
            onClick={() => setView('coach_chat')}
            sx={{
              p: 2,
              borderRadius: 2.5,
              border: `1px solid ${C.primaryA20}`,
              background: C.primaryContainer,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              '&:hover': { background: 'rgba(196,233,191,0.08)' },
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 700, color: C.text, fontSize: 15 }}>
                Имаш въпрос?
              </Typography>
              <Typography sx={{ fontSize: 12, color: C.muted, mt: 0.25 }}>
                Пиши на твоя ментор →
              </Typography>
            </Box>
            <Button variant="contained" sx={{ borderRadius: 99, background: C.primary, color: '#0A2E0F', fontWeight: 700 }}>
              Чат
            </Button>
          </Paper>
        </>
      )}

      {/* ── Експертен екип (медицинска легитимност) — най-отдолу ── */}
      <Box sx={{ mt: 4 }}>
        <ExpertTeam />
      </Box>

      {/* ── Task explanation dialog ── */}
      <Dialog
        open={!!taskDialog}
        onClose={() => setTaskDialog(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{
          sx: {
            borderRadius: 3,
            border: `1px solid ${C.loganBorder}`,
            background: C.card || '#161618',
            backgroundImage: `linear-gradient(135deg, ${C.loganDim} 0%, rgba(255,255,255,0.01) 100%)`,
          },
        }}
      >
        <DialogTitle sx={{
          fontSize: 18,
          fontWeight: 800,
          fontStyle: 'italic',
          color: C.text,
          pr: 6,
        }}>
          {applyTaskVars(taskDialog?.title_bg, weightForTasks)}
          <IconButton
            onClick={() => setTaskDialog(null)}
            size="small"
            sx={{ position: 'absolute', top: 12, right: 12, color: C.muted }}
          >
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: 14, color: C.text, lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {applyTaskVars(taskDialog?.description, weightForTasks)
              || 'Няма допълнително обяснение за тази задача.'}
          </Typography>

          {taskDialog?.rationale_bg && (
            <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${C.border}` }}>
              <Typography sx={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: C.muted,
                textTransform: 'uppercase',
                mb: 0.75,
              }}>
                Защо това работи
              </Typography>
              <Typography sx={{ fontSize: 13, color: C.muted, lineHeight: 1.55, fontStyle: 'italic' }}>
                {applyTaskVars(taskDialog.rationale_bg, weightForTasks)}
              </Typography>
            </Box>
          )}

          {taskDialog?.source_citation && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.6,
                color: C.muted,
                textTransform: 'uppercase',
                mb: 0.5,
                opacity: 0.8,
              }}>
                Източник
              </Typography>
              <Typography sx={{
                fontSize: 11,
                color: C.muted,
                lineHeight: 1.45,
                fontStyle: 'italic',
                opacity: 0.85,
              }}>
                {taskDialog.source_citation}
              </Typography>
            </Box>
          )}

          <Typography sx={{
            mt: 2,
            fontSize: 10,
            color: C.muted,
            opacity: 0.55,
            lineHeight: 1.4,
          }}>
            Информацията е образователна и не замества медицинска консултация.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setTaskDialog(null)}
            variant="contained"
            sx={{
              borderRadius: 99,
              background: C.primary,
              color: '#0A2E0F',
              fontWeight: 700,
              textTransform: 'none',
              px: 3,
              '&:hover': { background: C.primaryHover },
            }}
          >
            Разбрах
          </Button>
        </DialogActions>
      </Dialog>

    </Box>
  )
}

// ── ConsentScreen ─────────────────────────────────────────────────
// Full-screen page rendered as STEP 1 of the post-payment onboarding
// for new online clients. Educational-only disclaimer + checkbox. The
// "продължи" button is disabled until the checkbox is checked.
function ConsentScreen({ checked, onToggle, onAccept }) {
  return (
    <Box sx={{ maxWidth: 560, mx: 'auto', pt: { xs: 1, md: 4 }, pb: 4, px: 1 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 3,
          border: `1px solid ${C.loganBorder}`,
          background: C.card || '#161618',
          backgroundImage: `linear-gradient(135deg, ${C.loganDim} 0%, rgba(255,255,255,0.01) 100%)`,
        }}
      >
        <Typography sx={{
          fontSize: 11, fontWeight: 700, letterSpacing: 0.8,
          color: C.muted, textTransform: 'uppercase', mb: 1,
        }}>
          стъпка 1 от 2
        </Typography>
        <Typography variant="h2" sx={{ fontSize: { xs: 24, md: 28 }, mb: 1.5 }}>
          добре дошла в synrg
        </Typography>
        <Typography sx={{ fontSize: 14, color: C.text, lineHeight: 1.6, mb: 2.5 }}>
          преди да започнеш своя 8-седмичен път с нас, искаме да си наясно
          с няколко неща:
        </Typography>

        <Box component="ul" sx={{
          pl: 2.5, m: 0, mb: 3,
          '& li': { fontSize: 14, color: C.text, lineHeight: 1.65, mb: 1 },
        }}>
          <li>synrg е <b>образователен метод</b> за здравословни навици — не е медицинска услуга.</li>
          <li>методът не диагностицира, не лекува и не предписва.</li>
          <li>ако имаш хронични заболявания, бременност или приемаш лекарства, консултирай се с лекар преди да започнеш.</li>
          <li>при поява на болка, замаяност или други симптоми — спри и потърси лекар.</li>
        </Box>

        <FormControlLabel
          sx={{
            alignItems: 'flex-start',
            ml: 0,
            mb: 3,
            '& .MuiCheckbox-root': { pt: 0, pl: 0, pr: 1.25 },
            '& .MuiFormControlLabel-label': {
              fontSize: 13.5,
              color: C.text,
              lineHeight: 1.5,
            },
          }}
          control={
            <Checkbox
              checked={checked}
              onChange={(e) => onToggle(e.target.checked)}
              sx={{
                color: C.muted,
                '&.Mui-checked': { color: C.primary },
              }}
            />
          }
          label="разбирам, че synrg е образователен инструмент и не замества медицинска консултация."
        />

        <Button
          onClick={onAccept}
          disabled={!checked}
          variant="contained"
          fullWidth
          sx={{
            borderRadius: 99,
            background: C.primary,
            color: '#0A2E0F',
            fontWeight: 700,
            textTransform: 'none',
            py: 1.25,
            fontSize: 15,
            '&:hover': { background: C.primaryHover },
            '&.Mui-disabled': { background: C.border, color: C.muted },
          }}
        >
          продължи
        </Button>
      </Paper>
    </Box>
  )
}
