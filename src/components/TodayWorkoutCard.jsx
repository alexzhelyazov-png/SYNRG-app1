// ── Today's Workout Card + Player ────────────────────────────────
// Surfaces the auto-assembled circuit on the dashboard. Tap → opens a
// full-screen player that runs a WORK / REST countdown timer and auto-
// advances through the exercises and rounds.
//
// Brand tokens: mint primary accent (movement), logan border, MontBlanc
// italic headings. No emojis.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Typography, Paper, Dialog, DialogContent, IconButton, Button,
  CircularProgress, LinearProgress,
} from '@mui/material'
import CloseIcon            from '@mui/icons-material/Close'
import FitnessCenterIcon    from '@mui/icons-material/FitnessCenter'
import PlayArrowIcon        from '@mui/icons-material/PlayArrow'
import PauseIcon            from '@mui/icons-material/Pause'
import SkipNextIcon         from '@mui/icons-material/SkipNext'
import SkipPreviousIcon     from '@mui/icons-material/SkipPrevious'
import AccessTimeIcon       from '@mui/icons-material/AccessTime'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import ReplayIcon           from '@mui/icons-material/Replay'
import { C } from '../theme'
import { DB } from '../lib/db'
import {
  generateDailyWorkout,
  focusLabelBg,
  WORKOUT_TIMING,
} from '../lib/workoutGenerator'

function daysSince(startDateStr) {
  if (!startDateStr) return 0
  const start = new Date(startDateStr)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
}

function fmtMSS(sec) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function TodayWorkoutCard({ clientId, programStartedAt, difficulty = 1 }) {
  const [library, setLibrary] = useState(null)
  const [open, setOpen] = useState(false)
  const dayIndex = useMemo(() => daysSince(programStartedAt), [programStartedAt])

  useEffect(() => {
    let cancel = false
    DB.selectAll('exercise_library').then(rows => {
      if (!cancel) setLibrary(Array.isArray(rows) ? rows : [])
    }).catch(() => { if (!cancel) setLibrary([]) })
    return () => { cancel = true }
  }, [])

  const workout = useMemo(() => {
    if (!library || library.length === 0) return null
    return generateDailyWorkout({ library, clientId, dayIndex, difficulty })
  }, [library, clientId, dayIndex, difficulty])

  if (!library) {
    return (
      <Paper sx={cardSx} elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={18} sx={{ color: C.primary }} />
          <Typography sx={{ fontSize: 13, color: C.muted }}>
            Зареждам тренировката...
          </Typography>
        </Box>
      </Paper>
    )
  }

  if (!workout) {
    return (
      <Paper sx={cardSx} elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
          <FitnessCenterIcon sx={{ fontSize: 18, color: C.primary }} />
          <Typography sx={overlineSx}>Тренировка днес</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
          Скоро
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5 }}>
          Подреждаме библиотеката с упражнения. Върни се скоро.
        </Typography>
      </Paper>
    )
  }

  const main = workout.sections[0]
  const totalExercises = main.exercises.length

  return (
    <>
      <Paper
        sx={{ ...cardSx, cursor: 'pointer', transition: 'border-color 200ms ease, transform 200ms ease',
              '&:hover': { borderColor: C.primary, transform: 'translateY(-1px)' } }}
        elevation={0}
        onClick={() => setOpen(true)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <FitnessCenterIcon sx={{ fontSize: 18, color: C.primary }} />
            <Typography sx={overlineSx}>Тренировка днес</Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: C.muted, letterSpacing: 0.6, fontWeight: 700 }}>
            ДЕН {workout.dayIndex + 1}
          </Typography>
        </Box>
        <Typography sx={{
          fontSize: 22, fontWeight: 700, fontStyle: 'italic', color: C.text,
          fontFamily: "'MontBlanc', sans-serif", lineHeight: 1.1, mb: 0.75,
        }}>
          Кръгова · {workout.focus}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, color: C.muted, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{workout.totalMinutes} мин</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>· {main.rounds} рунда</Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>· {totalExercises} упражнения</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: C.primary }}>
          <PlayArrowIcon sx={{ fontSize: 26 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, fontStyle: 'italic' }}>
            Започни тренировката →
          </Typography>
        </Box>
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen
        slotProps={{ paper: { sx: { background: C.bg, color: C.text } } }}
      >
        <DialogContent sx={{ p: 0, height: '100vh', overflow: 'hidden' }}>
          <WorkoutPlayer workout={workout} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Player state machine ──────────────────────────────────────────
// Build a flat sequence of steps so the runtime is simple.
function buildSteps(workout) {
  const main = workout.sections[0]
  const { exercises, rounds, work_sec, rest_sec, round_rest_sec } = main
  const steps = []
  for (let r = 0; r < rounds; r++) {
    exercises.forEach((ex, exIdx) => {
      // Side 1 (or the only side for non-unilateral exercises)
      steps.push({
        kind: 'work', round: r + 1, exIdx, ex, sec: work_sec,
        side: ex.pair_with ? 'left' : null,
      })
      // If unilateral, run the mirror side immediately — no rest between
      if (ex.pair_with) {
        steps.push({
          kind: 'work', round: r + 1, exIdx, ex: ex.pair_with, sec: work_sec,
          side: 'right',
        })
      }
      const isLastEx = exIdx === exercises.length - 1
      if (!isLastEx) {
        const nextEx = exercises[exIdx + 1]
        steps.push({ kind: 'rest', round: r + 1, exIdx, ex: nextEx, sec: rest_sec })
      }
    })
    if (r < rounds - 1) {
      steps.push({ kind: 'round-rest', round: r + 1, ex: exercises[0], sec: round_rest_sec })
    }
  }
  return steps
}

function WorkoutPlayer({ workout, onClose }) {
  const steps = useMemo(() => buildSteps(workout), [workout])
  const [phase, setPhase] = useState('prep')   // 'prep' | 'running' | 'done'
  const [stepIdx, setStepIdx] = useState(0)
  const [secLeft, setSecLeft] = useState(steps[0]?.sec || 0)
  const [paused, setPaused] = useState(false)
  const tickRef = useRef(null)

  // Reset when steps change
  useEffect(() => {
    setStepIdx(0)
    setSecLeft(steps[0]?.sec || 0)
  }, [steps])

  // Tick down once per second while running and not paused
  useEffect(() => {
    if (phase !== 'running' || paused) return
    tickRef.current = setInterval(() => {
      setSecLeft(s => {
        if (s <= 1) {
          // advance to next step at the end of the tick
          setStepIdx(idx => {
            if (idx >= steps.length - 1) {
              setPhase('done')
              return idx
            }
            return idx + 1
          })
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [phase, paused, steps.length])

  // When stepIdx advances, prime the new countdown
  useEffect(() => {
    if (phase !== 'running') return
    setSecLeft(steps[stepIdx]?.sec || 0)
  }, [stepIdx, phase, steps])

  function start() {
    setPhase('running')
    setStepIdx(0)
    setSecLeft(steps[0]?.sec || 0)
    setPaused(false)
  }
  function next() {
    if (stepIdx >= steps.length - 1) { setPhase('done'); return }
    setStepIdx(stepIdx + 1)
  }
  function prev() {
    if (stepIdx === 0) return
    setStepIdx(stepIdx - 1)
  }
  function restart() {
    setPhase('prep')
    setStepIdx(0)
    setSecLeft(steps[0]?.sec || 0)
    setPaused(false)
  }

  const main = workout.sections[0]
  const totalRounds = main.rounds
  const exPerRound  = main.exercises.length

  if (phase === 'prep') {
    return (
      <PrepScreen workout={workout} onStart={start} onClose={onClose} />
    )
  }
  if (phase === 'done') {
    return (
      <DoneScreen workout={workout} onRestart={restart} onClose={onClose} />
    )
  }

  // Running
  const step = steps[stepIdx]
  const isWork = step.kind === 'work'
  const isRoundRest = step.kind === 'round-rest'
  const colorAccent = isWork ? C.primary : C.logan
  const sideLabel = step.side === 'left' ? ' · ЛЯВА СТРАНА' : step.side === 'right' ? ' · ДЯСНА СТРАНА' : ''
  const stateLabel = isWork ? `WORK${sideLabel}` : isRoundRest ? 'ПОЧИВКА МЕЖДУ РУНДИ' : 'REST'
  const ex = step.ex
  const stepProgress = step.sec > 0 ? ((step.sec - secLeft) / step.sec) * 100 : 0

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, color: C.text }}>
      {/* Top bar */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`,
      }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
          РУНД {step.round} / {totalRounds}
        </Typography>
        {!isRoundRest && (
          <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
            {(step.exIdx ?? 0) + 1} / {exPerRound}
          </Typography>
        )}
        <IconButton size="small" onClick={onClose} sx={{ color: C.text }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Step progress */}
      <LinearProgress
        variant="determinate"
        value={stepProgress}
        sx={{
          height: 3, background: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': { background: colorAccent },
        }}
      />

      {/* Body */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, gap: 2 }}>
        <Typography sx={{
          fontSize: 13, fontWeight: 800, letterSpacing: 2, color: colorAccent, textTransform: 'uppercase',
        }}>
          {stateLabel}
        </Typography>

        <Typography sx={{
          fontSize: 'clamp(64px, 22vw, 132px)', fontWeight: 800, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1, my: 1,
        }}>
          {fmtMSS(secLeft)}
        </Typography>

        {/* Clip */}
        {ex?.clip_url && (
          <Box sx={{
            width: '100%', maxWidth: 360, aspectRatio: '4/5', borderRadius: 3, overflow: 'hidden',
            border: `1px solid ${C.loganBorder}`, background: 'rgba(0,0,0,0.4)',
          }}>
            <video
              key={ex.clip_url + step.kind + stepIdx}
              src={ex.clip_url}
              poster={ex.thumb_url || undefined}
              muted autoPlay loop playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        )}

        <Typography sx={{
          fontSize: 22, fontWeight: 700, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, textAlign: 'center', lineHeight: 1.15,
        }}>
          {isRoundRest ? 'Поеми въздух · следва нов рунд' : ex?.name_bg || '—'}
        </Typography>

        {!isWork && !isRoundRest && (
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
            Следва: {ex?.name_bg}
          </Typography>
        )}
      </Box>

      {/* Controls */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 1.5, px: 2, py: 2, borderTop: `1px solid ${C.border}`,
      }}>
        <IconButton onClick={prev} sx={{ color: C.text, border: `1px solid ${C.border}` }} disabled={stepIdx === 0}>
          <SkipPreviousIcon />
        </IconButton>
        <IconButton
          onClick={() => setPaused(p => !p)}
          sx={{
            color: '#0d1510', background: C.primary, width: 64, height: 64,
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          {paused ? <PlayArrowIcon sx={{ fontSize: 30 }} /> : <PauseIcon sx={{ fontSize: 30 }} />}
        </IconButton>
        <IconButton onClick={next} sx={{ color: C.text, border: `1px solid ${C.border}` }}>
          <SkipNextIcon />
        </IconButton>
      </Box>
    </Box>
  )
}

// ── Prep / Done screens ──────────────────────────────────────────
function PrepScreen({ workout, onStart, onClose }) {
  const main = workout.sections[0]
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, color: C.text }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`,
      }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
          ДЕН {workout.dayIndex + 1} · {workout.focus.toUpperCase()}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: C.text }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <Box sx={{ flex: 1, overflow: 'auto', px: 2.5, pt: 3, pb: 4 }}>
        <Typography sx={{
          fontSize: 28, fontWeight: 800, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.05, mb: 1,
        }}>
          Кръгова тренировка
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.muted, mb: 2.5 }}>
          {main.rounds} рунда × {main.exercises.length} упражнения · {workout.totalMinutes} мин общо · {WORKOUT_TIMING.WORK_SEC} сек работа / {WORKOUT_TIMING.REST_SEC} сек почивка
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, mb: 3 }}>
          {main.exercises.map((ex, i) => (
            <Box key={ex.id || ex.slug} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              p: 1.25, borderRadius: 2,
              border: `1px solid ${C.loganBorder}`,
              background: 'rgba(255,255,255,0.02)',
            }}>
              <Box sx={{
                width: 56, height: 56, borderRadius: 1.5, overflow: 'hidden',
                background: 'rgba(0,0,0,0.4)', flexShrink: 0,
              }}>
                {ex.clip_url ? (
                  <video src={ex.clip_url} poster={ex.thumb_url} muted autoPlay loop playsInline
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {String(i + 1).padStart(2, '0')} · {ex.category || 'full'}
                  {ex.pair_with ? ' · 2 страни' : ''}
                </Typography>
                <Typography sx={{
                  fontSize: 15, fontWeight: 700, fontStyle: 'italic',
                  fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {ex.pair_with ? ex.name_bg.replace(/\s*\((ляв|десен)\)\s*$/i, '').trim() : ex.name_bg}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ p: 2.5, borderTop: `1px solid ${C.border}`, background: C.bg }}>
        <Button
          fullWidth variant="contained" startIcon={<PlayArrowIcon />}
          onClick={onStart}
          sx={{
            py: 1.75, borderRadius: 100, fontWeight: 800, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif", fontSize: 16,
            background: C.primary, color: '#0d1510',
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          Започни сега
        </Button>
      </Box>
    </Box>
  )
}

function DoneScreen({ workout, onRestart, onClose }) {
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg, color: C.text,
      alignItems: 'center', justifyContent: 'center', px: 3, gap: 2,
    }}>
      <CheckCircleIcon sx={{ fontSize: 96, color: C.primary }} />
      <Typography sx={{
        fontSize: 32, fontWeight: 800, fontStyle: 'italic',
        fontFamily: "'MontBlanc', sans-serif", color: C.text, textAlign: 'center', lineHeight: 1.1,
      }}>
        Готово.
      </Typography>
      <Typography sx={{ fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 320 }}>
        Един рунд по-силен от вчера. Спокойно дишане, малко вода, разтягане.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Button
          variant="outlined" startIcon={<ReplayIcon />} onClick={onRestart}
          sx={{ borderRadius: 100, color: C.text, borderColor: C.border, fontWeight: 700, fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif" }}
        >
          Отначало
        </Button>
        <Button
          variant="contained" onClick={onClose}
          sx={{
            borderRadius: 100, fontWeight: 800, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif", background: C.primary, color: '#0d1510',
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          Към dashboard
        </Button>
      </Box>
    </Box>
  )
}

// ── Style tokens ───────────────────────────────────────────────────
const cardSx = {
  p: 2, borderRadius: 2.5, mb: 3,
  border: `1px solid ${C.loganBorder}`,
  background: `linear-gradient(135deg, rgba(196,233,191,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
  position: 'relative', overflow: 'hidden',
  '&::before': {
    content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
    background: `linear-gradient(90deg, ${C.logan} 0%, ${C.primary} 100%)`,
  },
}

const overlineSx = {
  fontSize: 11, letterSpacing: 1.5, fontWeight: 700, color: C.primary,
  textTransform: 'uppercase',
}
