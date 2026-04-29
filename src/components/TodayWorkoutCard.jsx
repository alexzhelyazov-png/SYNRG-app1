// ── Today's Workout Card ──────────────────────────────────────────
// Surfaces the auto-assembled daily workout on the dashboard. Tapping
// opens a full-screen detail dialog with collapsible sections (warmup
// / main / finisher), Bunny boomerang previews and a "Start" CTA.
//
// Brand tokens: mint primary accent (movement context), logan border,
// MontBlanc italic headings. No emojis.

import { useEffect, useMemo, useState } from 'react'
import {
  Box, Typography, Paper, Dialog, DialogContent, IconButton, Button,
  CircularProgress,
} from '@mui/material'
import CloseIcon            from '@mui/icons-material/Close'
import FitnessCenterIcon    from '@mui/icons-material/FitnessCenter'
import PlayCircleFilledIcon from '@mui/icons-material/PlayCircleFilled'
import AccessTimeIcon       from '@mui/icons-material/AccessTime'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import { C } from '../theme'
import { DB } from '../lib/db'
import {
  generateDailyWorkout,
  focusLabelBg,
  formatPrescription,
} from '../lib/workoutGenerator'

function daysSince(startDateStr) {
  if (!startDateStr) return 0
  const start = new Date(startDateStr)
  const today = new Date()
  start.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.max(0, Math.floor((today - start) / (1000 * 60 * 60 * 24)))
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

  if (!workout || workout.rest) {
    return (
      <Paper sx={cardSx} elevation={0}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.75 }}>
          <FitnessCenterIcon sx={{ fontSize: 18, color: C.primary }} />
          <Typography sx={overlineSx}>Тренировка днес</Typography>
        </Box>
        <Typography sx={{ fontSize: 18, fontWeight: 700, fontStyle: 'italic', color: C.text, fontFamily: "'MontBlanc', sans-serif" }}>
          Ден за възстановяване
        </Typography>
        <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5 }}>
          Тялото ти расте между тренировките. Разходка, разтягане, сън.
        </Typography>
      </Paper>
    )
  }

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
          fontSize: 20, fontWeight: 700, fontStyle: 'italic', color: C.text,
          fontFamily: "'MontBlanc', sans-serif", lineHeight: 1.15, mb: 0.75,
        }}>
          {focusLabelBg(workout.focus)}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1.5, color: C.muted }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 14 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{workout.totalMinutes} мин</Typography>
          </Box>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            · {workout.sections.length} секции
          </Typography>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>
            · {workout.sections.reduce((s, sec) => s + sec.exercises.length, 0)} упражнения
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, color: C.primary }}>
          <PlayCircleFilledIcon sx={{ fontSize: 24 }} />
          <Typography sx={{ fontSize: 14, fontWeight: 700, fontStyle: 'italic' }}>
            Виж тренировката →
          </Typography>
        </Box>
      </Paper>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullScreen
        slotProps={{ paper: { sx: { background: C.bg, color: C.text } } }}
      >
        <DialogContent sx={{ p: 0 }}>
          <WorkoutDetail workout={workout} onClose={() => setOpen(false)} />
        </DialogContent>
      </Dialog>
    </>
  )
}

// ── Detail view ────────────────────────────────────────────────────
function WorkoutDetail({ workout, onClose }) {
  return (
    <Box sx={{ minHeight: '100vh', background: C.bg }}>
      {/* Top bar */}
      <Box sx={{
        position: 'sticky', top: 0, zIndex: 10,
        background: C.bg,
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        px: 2, py: 1.25,
      }}>
        <Typography sx={{
          fontSize: 13, fontWeight: 700, letterSpacing: 1.2, color: C.muted,
        }}>
          ДЕН {workout.dayIndex + 1} · {focusLabelBg(workout.focus).toUpperCase()}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: C.text }}>
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Hero summary */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Typography sx={{
          fontSize: 28, fontWeight: 700, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.1, mb: 1,
        }}>
          {focusLabelBg(workout.focus)}
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, color: C.muted, fontSize: 13, fontWeight: 700 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <AccessTimeIcon sx={{ fontSize: 15 }} />
            {workout.totalMinutes} мин
          </Box>
          <Box>· {workout.sections.length} секции</Box>
        </Box>
      </Box>

      {/* Sections */}
      <Box sx={{ px: 2, pb: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {workout.sections.map((sec, i) => (
          <SectionCard key={i} section={sec} />
        ))}
      </Box>

      {/* Action footer */}
      <Box sx={{
        position: 'sticky', bottom: 0, background: `linear-gradient(180deg, transparent 0%, ${C.bg} 30%)`,
        px: 2, pt: 4, pb: 2.5,
      }}>
        <Button
          fullWidth variant="contained"
          startIcon={<CheckCircleIcon />}
          sx={{
            py: 1.5, borderRadius: 100, fontWeight: 700, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif", fontSize: 15,
            background: C.primary, color: '#0d1510',
            '&:hover': { background: '#d4f0cf' },
          }}
        >
          Отбележи като завършена
        </Button>
      </Box>
    </Box>
  )
}

// ── Single section (warmup / main / finisher) ────────────────────
function SectionCard({ section }) {
  const [open, setOpen] = useState(true)
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2, borderRadius: 3,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${C.loganBorder}`,
        position: 'relative', overflow: 'hidden',
        '&::before': {
          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: section.type === 'main'
            ? `linear-gradient(90deg, ${C.logan} 0%, ${C.primary} 100%)`
            : section.type === 'warmup' ? C.primary : C.logan,
        },
      }}
    >
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', mt: 0.5 }}
      >
        <Box>
          <Typography sx={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1.4, color: C.primary, textTransform: 'uppercase',
          }}>
            {section.type === 'warmup' ? 'WARMUP' : section.type === 'main' ? 'OСНОВНА' : 'ФИНИШ'}
          </Typography>
          <Typography sx={{
            fontSize: 18, fontWeight: 700, fontStyle: 'italic',
            fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.15, mt: 0.25,
          }}>
            {section.rounds > 1 ? `${section.rounds} рунда` : `${Math.round(section.time_cap_sec / 60)} мин`}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: 12, color: C.muted, fontWeight: 700 }}>
          {section.exercises.length} упр.
        </Typography>
      </Box>
      {open && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px dashed ${C.border}`, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {section.exercises.map((ex) => (
            <ExerciseRow key={ex.id || ex.slug} ex={ex} />
          ))}
        </Box>
      )}
    </Paper>
  )
}

// ── One exercise row inside a section ────────────────────────────
function ExerciseRow({ ex }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box sx={{
        width: 64, height: 64, borderRadius: 2,
        overflow: 'hidden', flexShrink: 0,
        background: 'rgba(0,0,0,0.4)',
        border: `1px solid ${C.border}`,
      }}>
        {ex.clip_url ? (
          <video
            src={ex.clip_url}
            poster={ex.thumb_url || undefined}
            muted autoPlay loop playsInline
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : ex.thumb_url ? (
          <img src={ex.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : null}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{
          fontSize: 11, fontWeight: 700, color: C.primary, letterSpacing: 1, textTransform: 'uppercase',
        }}>
          {formatPrescription(ex)}
        </Typography>
        <Typography sx={{
          fontSize: 14, fontWeight: 700, fontStyle: 'italic',
          fontFamily: "'MontBlanc', sans-serif", color: C.text, lineHeight: 1.2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ex.name_bg}
        </Typography>
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
