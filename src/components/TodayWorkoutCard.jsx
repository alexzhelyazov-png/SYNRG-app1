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
import StopIcon             from '@mui/icons-material/Stop'
import { C } from '../theme'
import { DB } from '../lib/db'
import { useApp } from '../context/AppContext'
import {
  generateDailyWorkout,
  focusLabelBg,
  WORKOUT_TIMING,
} from '../lib/workoutGenerator'
import { recordWorkoutCompletion, countWorkoutsThisWeek, loadTodayWorkoutCompletion } from '../lib/dailyTracking'

const WEEKLY_WORKOUT_TARGET = 5

function daysSince(startDateStr) {
  if (!startDateStr) return 0
  const start = new Date(startDateStr)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
}

// ── LoopingClip ─────────────────────────────────────────────────
// Source MOVs have a black frame at both ends:
//   • ~0.1 s of black at the very start
//   • ~0.7-1.0 s of black at the end
// We skip past both:
//   • on `loadedmetadata` we jump to HEAD_SKIP so the very first frame
//     painted is the live action, not the leading black frame
//   • a tight rAF poll seeks back to HEAD_SKIP whenever we cross the
//     `duration - TRIM_SEC` threshold — restarts the loop cleanly with
//     no trailing black flash
function LoopingClip({ src, poster, style, ...rest }) {
  const ref = useRef(null)
  const rafRef = useRef(0)
  const [ready, setReady] = useState(false)
  const TRIM_SEC = 1.2
  const HEAD_SKIP = 0.15

  useEffect(() => {
    setReady(false)
    const v = ref.current
    if (!v) return

    // Reveal the <video> as soon as we have a real frame to show.
    // Listen on EVERY event that signals "frames are flowing" so we
    // never get stuck on a black wrapper if one of them doesn't fire
    // (iOS Safari PWA, low-end Android, slow networks).
    const reveal = () => setReady(true)
    const events = ['playing', 'canplay', 'canplaythrough', 'seeked', 'timeupdate']
    events.forEach(e => v.addEventListener(e, reveal))

    const onMeta = () => {
      try { v.currentTime = HEAD_SKIP } catch {}
      // Some browsers (notably iOS PWA) suspend autoplay when the video
      // is mounted off-screen; explicitly call play() so it doesn't sit
      // on a black first frame waiting for user gesture.
      v.play?.().catch(() => {})
    }
    v.addEventListener('loadedmetadata', onMeta)
    if (v.readyState >= 1) onMeta()

    // Hard fallback: if no event has fired in 1.5 s just reveal the
    // element regardless — better to show a partial black frame for a
    // moment than to leave the user staring at a permanently dark box.
    const fallbackTimer = setTimeout(() => setReady(true), 1500)

    const tick = () => {
      if (v.duration && !v.paused) {
        if (v.currentTime >= v.duration - TRIM_SEC) {
          try { v.currentTime = HEAD_SKIP } catch {}
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(rafRef.current)
      clearTimeout(fallbackTimer)
      events.forEach(e => v.removeEventListener(e, reveal))
      v.removeEventListener('loadedmetadata', onMeta)
    }
  }, [src])

  // Solid-black wrapper while the video is still decoding/seeking past
  // its leading black frame.  We deliberately do NOT use the poster as
  // a background: Bunny generates the poster at an arbitrary moment of
  // the clip, so the still image and the first played frame (at
  // HEAD_SKIP) show the person in slightly different positions — that
  // visible "jump" reads as a glitch.  A short black wrapper followed
  // by an opacity fade-in is cleaner.
  return (
    <div
      style={{
        position: 'relative',
        width:  style?.width  || '100%',
        height: style?.height || '100%',
        backgroundColor: '#0a0a0a',
      }}
    >
      <video
        ref={ref}
        src={src}
        muted autoPlay loop playsInline preload="auto"
        style={{ ...style, opacity: ready ? 1 : 0, transition: 'opacity 140ms ease' }}
        {...rest}
      />
    </div>
  )
}

// ── Sound cues ────────────────────────────────────────────────────
// Synthesized via Web Audio API so the app stays self-contained
// (no audio files to bundle, no CORS, no preload).
//   • beep(880, 0.10)  — countdown blip (3, 2, 1)
//   • beep(440, 0.45)  — "go" tone fired when a new WORK step starts
let _audioCtx = null
function getAudioCtx() {
  if (typeof window === 'undefined') return null
  if (_audioCtx) return _audioCtx
  const Ctx = window.AudioContext || window.webkitAudioContext
  if (!Ctx) return null
  _audioCtx = new Ctx()
  return _audioCtx
}
function beep(freq, duration, vol = 0.25, type = 'sine', startOffset = 0) {
  const ctx = getAudioCtx()
  if (!ctx) return
  // iOS Safari starts the context suspended; resume on every play attempt.
  if (ctx.state === 'suspended') { try { ctx.resume() } catch {} }
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  // Quick attack + decay envelope so beeps don't click.
  const t0 = ctx.currentTime + startOffset
  gain.gain.setValueAtTime(0, t0)
  gain.gain.linearRampToValueAtTime(vol, t0 + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + duration + 0.05)
}

// Single, slightly extended tone fired when a new WORK step starts.
// Triangle wave gives a fuller body than a pure sine without sounding
// shrill on phone speakers.
function playGoTone() {
  beep(660, 0.55, 0.30, 'triangle')   // E5, ~0.55s
}

function fmtMSS(sec) {
  const s = Math.max(0, Math.round(sec))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export default function TodayWorkoutCard({ clientId, programStartedAt, difficulty = 1, flat = false, quiz = null }) {
  const { t } = useApp()
  const [library, setLibrary] = useState(null)
  const [open, setOpen] = useState(false)
  const [weekCount, setWeekCount] = useState(0)
  const [doneToday, setDoneToday] = useState(false)
  const dayIndex = useMemo(() => daysSince(programStartedAt), [programStartedAt])

  useEffect(() => {
    let cancel = false
    DB.selectAll('exercise_library').then(rows => {
      if (!cancel) setLibrary(Array.isArray(rows) ? rows : [])
    }).catch(() => { if (!cancel) setLibrary([]) })
    return () => { cancel = true }
  }, [])

  // Load this week's workout count + whether today is done.
  // Re-runs when the player closes so the banner updates immediately
  // after the user finishes (or marks "Завърши") today's workout.
  useEffect(() => {
    if (!clientId) return
    let cancel = false
    countWorkoutsThisWeek(clientId).then(n => { if (!cancel) setWeekCount(n) })
    loadTodayWorkoutCompletion(clientId).then(row => { if (!cancel) setDoneToday(!!row) })
    return () => { cancel = true }
  }, [clientId, open])

  const recordCompletion = async () => {
    if (!clientId || !workout) return
    await recordWorkoutCompletion({
      clientId,
      dayIndex,
      workoutNumber: workout.workoutNumber || 1,
      durationSec: workout.totalMinutes ? workout.totalMinutes * 60 : null,
    })
    const n = await countWorkoutsThisWeek(clientId)
    setWeekCount(n)
  }

  const workout = useMemo(() => {
    if (!library || library.length === 0) return null
    return generateDailyWorkout({ library, clientId, dayIndex, difficulty, quiz })
  }, [library, clientId, dayIndex, difficulty, quiz])

  if (!library) {
    return (
      <Paper sx={cardSx} elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <CircularProgress size={18} sx={{ color: C.primary }} />
          <Typography sx={{ fontSize: 13, color: C.muted }}>
            {t('workoutLoading')}
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
          <Typography sx={overlineSx}>{t('workoutToday')}</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
          {t('workoutComingSoon')}
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5 }}>
          {t('workoutComingSoonBody')}
        </Typography>
      </Paper>
    )
  }

  const main = workout.sections[0]
  const totalExercises = main.exercises.length

  const bannerSx = flat
    ? {
        px: 1, py: 0.75, mb: 0,
        display: 'flex', alignItems: 'center', gap: 1.25,
        cursor: 'pointer',
        background: 'transparent', border: 'none', boxShadow: 'none', borderRadius: 1.5,
        '&:hover': { background: 'rgba(196,233,191,0.06)' },
      }
    : {
        ...cardSx,
        p: 1.25,
        display: 'flex', alignItems: 'center', gap: 1.5,
        cursor: 'pointer',
        transition: 'border-color 200ms ease, transform 200ms ease',
        '&:hover': { borderColor: C.primary, transform: 'translateY(-1px)' },
      }

  return (
    <>
      <Paper
        sx={bannerSx}
        elevation={0}
        onClick={() => setOpen(true)}
      >
        <Box sx={{
          width: 32, height: 32, borderRadius: '50%',
          background: doneToday ? C.primary : 'rgba(196,233,191,0.10)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          {doneToday
            ? <CheckCircleIcon sx={{ fontSize: 19, color: '#0d1510' }} />
            : <FitnessCenterIcon sx={{ fontSize: 17, color: C.primary }} />
          }
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 0.1 }}>
          <Typography sx={{
            fontSize: 14, fontWeight: 700, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif",
            color: doneToday ? C.muted : C.text, lineHeight: 1.25,
            // Wrap onto a second line so the banner is fully readable
            // ("Тренировка · Готова" no longer gets ellipsised).
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            textDecoration: doneToday ? 'line-through' : 'none',
          }}>
            {doneToday ? t('workoutDoneBanner') : t('workoutTitle')}
          </Typography>
          {workout?.totalMinutes ? (
            <Typography sx={{
              fontSize: 11, fontWeight: 600,
              color: C.muted, lineHeight: 1,
            }}>
              ~{workout.totalMinutes} мин
            </Typography>
          ) : null}
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          <Typography sx={{
            fontSize: 11, fontWeight: 700,
            color: weekCount >= WEEKLY_WORKOUT_TARGET ? C.primary : C.muted,
          }}>
            {weekCount}/{WEEKLY_WORKOUT_TARGET}
          </Typography>
          <Button
            variant={doneToday ? 'outlined' : 'contained'}
            size="small"
            onClick={(e) => { e.stopPropagation(); setOpen(true) }}
            sx={{
              borderRadius: 100, px: 1.5, py: 0.25, minWidth: 0,
              fontWeight: 700, fontSize: 11, fontStyle: 'italic',
              fontFamily: "'MontBlanc', sans-serif",
              background: doneToday ? 'transparent' : C.primary,
              color: doneToday ? C.primary : '#0d1510',
              borderColor: doneToday ? C.primaryA20 : 'transparent',
              boxShadow: 'none',
              '&:hover': {
                background: doneToday ? 'rgba(196,233,191,0.08)' : '#d4f0cf',
                borderColor: doneToday ? C.primary : 'transparent',
                boxShadow: 'none',
              },
            }}
          >
            {doneToday ? t('workoutReplay') : t('workoutStart')}
          </Button>
        </Box>
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen
        slotProps={{ paper: { sx: { background: C.bg, color: C.text } } }}
      >
        <DialogContent sx={{ p: 0, height: '100vh', overflow: 'hidden' }}>
          <WorkoutPlayer
            workout={workout}
            onClose={() => setOpen(false)}
            onCompleted={recordCompletion}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Player state machine ──────────────────────────────────────────
// Build a flat sequence of steps so the runtime is simple.
function buildSteps(workout) {
  const main = workout.sections[0]
  const { exercises, rounds, rest_sec, round_rest_sec } = main
  const steps = []
  for (let r = 0; r < rounds; r++) {
    exercises.forEach((ex, exIdx) => {
      const sec = ex.prescribed || 30
      const hasTwoSides = !!(ex.pair_with || ex.both_sides)

      // First side (or the only side for non-unilateral exercises)
      steps.push({
        kind: 'work', round: r + 1, exIdx, ex, sec,
        side: hasTwoSides ? 'left' : null,
      })

      // Second side: mirrored exercise (pair_with) or same video again (both_sides)
      if (ex.pair_with) {
        steps.push({
          kind: 'work', round: r + 1, exIdx, ex: ex.pair_with, sec,
          side: 'right',
        })
      } else if (ex.both_sides) {
        steps.push({
          kind: 'work', round: r + 1, exIdx, ex, sec,
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

function WorkoutPlayer({ workout, onClose, onCompleted }) {
  const { t } = useApp()
  const steps = useMemo(() => buildSteps(workout), [workout])
  const [phase, setPhase] = useState('prep')   // 'prep' | 'running' | 'done'
  const [stepIdx, setStepIdx] = useState(0)
  const [secLeft, setSecLeft] = useState(steps[0]?.sec || 0)
  const [paused, setPaused] = useState(false)
  const tickRef = useRef(null)
  const completedFiredRef = useRef(false)

  // Persist completion exactly once when we transition into the done phase
  useEffect(() => {
    if (phase === 'done' && !completedFiredRef.current) {
      completedFiredRef.current = true
      try { onCompleted && onCompleted() } catch {}
    }
    if (phase !== 'done') completedFiredRef.current = false
  }, [phase, onCompleted])

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

  // When stepIdx advances, prime the new countdown.  We also fire a
  // "go" tone whenever we enter a WORK step so the user can keep their
  // eyes on form instead of the screen.
  useEffect(() => {
    if (phase !== 'running') return
    setSecLeft(steps[stepIdx]?.sec || 0)
    const s = steps[stepIdx]
    if (s?.kind === 'work') playGoTone()
  }, [stepIdx, phase, steps])

  // Countdown beeps on the last 3 seconds of every step.
  useEffect(() => {
    if (phase !== 'running' || paused) return
    if (secLeft > 0 && secLeft <= 3) beep(880, 0.10)
  }, [secLeft, phase, paused])

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
  const sideLabel = step.side === 'left' ? t('workoutSideLeft') : step.side === 'right' ? t('workoutSideRight') : ''
  const stateLabel = isWork ? `WORK${sideLabel}` : isRoundRest ? t('workoutBetweenRounds') : 'REST'
  const ex = step.ex
  const stepProgress = step.sec > 0 ? ((step.sec - secLeft) / step.sec) * 100 : 0

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh', overflow: 'hidden',
      background: C.bg, color: C.text,
      paddingTop: 'env(safe-area-inset-top)',
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      {/* Top bar — compact */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 1.5, py: 0.75, borderBottom: `1px solid ${C.border}`,
      }}>
        <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
          {t('workoutRound')} {step.round}/{totalRounds}
        </Typography>
        {!isRoundRest && (
          <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
            {(step.exIdx ?? 0) + 1}/{exPerRound}
          </Typography>
        )}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Button
            onClick={() => setPhase('done')}
            size="small"
            startIcon={<StopIcon sx={{ fontSize: 16 }} />}
            sx={{
              minWidth: 0, px: 1.25, py: 0.25,
              color: C.text, textTransform: 'none',
              fontSize: 12, fontWeight: 700, fontStyle: 'italic',
              fontFamily: "'MontBlanc', sans-serif",
              border: `1px solid ${C.border}`, borderRadius: 99,
            }}
          >
            {t('workoutFinish')}
          </Button>
          <IconButton size="small" onClick={onClose} sx={{ color: C.text }}>
            <CloseIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Box>
      </Box>

      {/* Overall workout progress — solid mint bar fills as steps complete */}
      <LinearProgress
        variant="determinate"
        value={steps.length > 0 ? ((stepIdx + (step.sec > 0 ? (step.sec - secLeft) / step.sec : 0)) / steps.length) * 100 : 0}
        sx={{
          flexShrink: 0,
          height: 3, background: 'rgba(255,255,255,0.06)',
          '& .MuiLinearProgress-bar': {
            background: C.primary,
            transition: 'transform 250ms linear',
          },
        }}
      />

      {/* Per-step segmented bar — one dot per step. Done = solid mint,
          current = mint, upcoming = dim. Lets the user see exactly
          where they are in the workout at a glance. */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex', gap: 0.5,
        px: 1, py: 0.75,
      }}>
        {steps.map((s, i) => {
          const done = i < stepIdx
          const current = i === stepIdx
          const isWorkSeg = s.kind === 'work'
          const bg = done
            ? C.primary
            : current
              ? C.primary
              : 'rgba(255,255,255,0.10)'
          return (
            <Box
              key={i}
              sx={{
                flex: 1,
                height: isWorkSeg ? 4 : 3,
                borderRadius: 99,
                background: bg,
                opacity: current ? (paused ? 0.6 : 1) : 1,
                transition: 'background 200ms ease',
              }}
            />
          )
        })}
      </Box>

      {/* Body — flex column, video uses available space */}
      <Box sx={{
        flex: 1, minHeight: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        px: 2, py: 1, gap: 0.75,
      }}>
        <Typography sx={{
          fontSize: 'clamp(20px, 3.2vh, 28px)',
          fontWeight: 800, letterSpacing: 2.5,
          color: colorAccent, textTransform: 'uppercase',
        }}>
          {stateLabel}
        </Typography>

        <Typography sx={{
          fontSize: 'clamp(48px, 14vh, 96px)', fontWeight: 800, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif",
          color: secLeft > 0 && secLeft <= 3 ? '#FF7A50' : C.text,
          transition: 'color 120ms ease',
          lineHeight: 1,
        }}>
          {fmtMSS(secLeft)}
        </Typography>

        {/* Clip — flex grows to fill remaining space */}
        {ex?.clip_url && (
          <Box sx={{
            flex: 1, minHeight: 0,
            width: '100%', maxWidth: 360, aspectRatio: '4/5',
            borderRadius: 3, overflow: 'hidden',
            border: `1px solid ${C.loganBorder}`, background: 'rgba(0,0,0,0.4)',
            display: 'flex',
          }}>
            <LoopingClip
              key={ex.clip_url + step.kind + stepIdx}
              src={ex.clip_url}
              poster={ex.thumb_url || undefined}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </Box>
        )}

        <Typography sx={{
          fontSize: 'clamp(15px, 2.4vh, 20px)', fontWeight: 700, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, textAlign: 'center', lineHeight: 1.15,
        }}>
          {isRoundRest ? t('workoutBreathe') : ex?.name_bg || '—'}
        </Typography>

        {!isWork && !isRoundRest && (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
            {t('workoutNext')} {ex?.name_bg}
          </Typography>
        )}
      </Box>

      {/* Controls — compact */}
      <Box sx={{
        flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 1.25, px: 2, py: 1.25, borderTop: `1px solid ${C.border}`,
      }}>
        <IconButton onClick={prev} sx={{ color: C.text, border: `1px solid ${C.border}`, width: 44, height: 44 }} disabled={stepIdx === 0}>
          <SkipPreviousIcon />
        </IconButton>
        <IconButton
          onClick={() => setPaused(p => !p)}
          sx={{
            color: '#0d1510', background: C.primary, width: 56, height: 56,
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          {paused ? <PlayArrowIcon sx={{ fontSize: 28 }} /> : <PauseIcon sx={{ fontSize: 28 }} />}
        </IconButton>
        <IconButton onClick={next} sx={{ color: C.text, border: `1px solid ${C.border}`, width: 44, height: 44 }}>
          <SkipNextIcon />
        </IconButton>
      </Box>
    </Box>
  )
}

// ── Prep / Done screens ──────────────────────────────────────────
function PrepScreen({ workout, onStart, onClose }) {
  const { t } = useApp()
  const main = workout.sections[0]
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh',
      background: C.bg, color: C.text,
      paddingTop: 'env(safe-area-inset-top)',
      paddingLeft: 'env(safe-area-inset-left)',
      paddingRight: 'env(safe-area-inset-right)',
    }}>
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25, borderBottom: `1px solid ${C.border}`,
      }}>
        <Typography sx={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.2, color: C.muted }}>
          {t('workoutDay')} {workout.dayIndex + 1} · {workout.focus.toUpperCase()}
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
          {t('workoutTitle')} {workout.workoutNumber} {t('workoutOfTotal')} {workout.curriculumSize || 20}
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.muted, mb: 2.5 }}>
          {t('workoutSummary')(main.rounds, main.exercises.length, workout.totalMinutes, WORKOUT_TIMING.REST_SEC, WORKOUT_TIMING.ROUND_REST_SEC)}
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
                  <LoopingClip src={ex.clip_url} poster={ex.thumb_url}
                         style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : null}
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{
                  fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 1, textTransform: 'uppercase',
                }}>
                  {String(i + 1).padStart(2, '0')} · {ex.prescribed} {t('workoutSec')}
                  {(ex.pair_with || ex.both_sides) ? t('workoutPerSide') : ''}
                </Typography>
                <Typography sx={{
                  fontSize: 15, fontWeight: 700, fontStyle: 'italic',
                  fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.2,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {(ex.pair_with || ex.both_sides)
                    ? ex.name_bg.replace(/\s*\((ляв|десен)\)\s*$/i, '').trim()
                    : ex.name_bg}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{
        p: 2.5,
        pb: 'calc(20px + env(safe-area-inset-bottom))',
        borderTop: `1px solid ${C.border}`,
        background: C.bg,
        flexShrink: 0,
      }}>
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
          {t('workoutStartNow')}
        </Button>
      </Box>
    </Box>
  )
}

function DoneScreen({ workout, onRestart, onClose }) {
  const { t } = useApp()
  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', maxHeight: '100dvh',
      background: C.bg, color: C.text,
      alignItems: 'center', justifyContent: 'center', px: 3, gap: 2,
      paddingTop: 'calc(16px + env(safe-area-inset-top))',
      paddingBottom: 'calc(16px + env(safe-area-inset-bottom))',
      paddingLeft: 'calc(24px + env(safe-area-inset-left))',
      paddingRight: 'calc(24px + env(safe-area-inset-right))',
    }}>
      <CheckCircleIcon sx={{ fontSize: 96, color: C.primary }} />
      <Typography sx={{
        fontSize: 32, fontWeight: 800, fontStyle: 'italic',
        fontFamily: "'MontBlanc', sans-serif", color: C.text, textAlign: 'center', lineHeight: 1.1,
      }}>
        {t('workoutDone')}
      </Typography>
      <Typography sx={{ fontSize: 14, color: C.muted, textAlign: 'center', maxWidth: 320 }}>
        {t('workoutDoneBody')}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.5, mt: 2 }}>
        <Button
          variant="outlined" startIcon={<ReplayIcon />} onClick={onRestart}
          sx={{ borderRadius: 100, color: C.text, borderColor: C.border, fontWeight: 700, fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif" }}
        >
          {t('workoutRestart')}
        </Button>
        <Button
          variant="contained" onClick={onClose}
          sx={{
            borderRadius: 100, fontWeight: 800, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif", background: C.primary, color: '#0d1510',
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          {t('workoutToDashboard')}
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
