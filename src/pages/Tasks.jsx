import { useState } from 'react'
import { Box, Typography, Paper, Divider, Collapse } from '@mui/material'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { C, EASE } from '../theme'
import { HABIT_PLAN } from '../data/habitPlan'

// ─── Single habit row (collapsible) ───────────────────────────────
// Title is the tappable header; details (instructions, "защо", source)
// expand on click so the week reads as a clean list of habits.
function HabitRow({ index, habit, last }) {
  const [open, setOpen] = useState(false)

  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${C.border}` }}>
      {/* Header — number + title + chevron */}
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
          cursor: 'pointer', userSelect: 'none',
          '&:hover .habitTitle': { color: C.primary },
        }}
      >
        <Box sx={{
          width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
          background: C.accentSoft, border: `1px solid ${C.primaryA20}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, color: C.text,
        }}>
          {index + 1}
        </Box>
        <Typography className="habitTitle" sx={{
          flex: 1, minWidth: 0, fontWeight: 700, fontSize: '14.5px',
          color: C.text, lineHeight: 1.35, transition: `color 0.15s ${EASE.standard}`,
        }}>
          {habit.title}
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 20, color: C.muted, flexShrink: 0,
          transition: `transform 0.2s ${EASE.standard}`,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </Box>

      {/* Details */}
      <Collapse in={open}>
        <Box sx={{ pl: '38px', pb: 1.75 }}>
          {habit.description && (
            <Typography sx={{ color: C.text, opacity: 0.82, fontSize: '13px', lineHeight: 1.5 }}>
              {habit.description}
            </Typography>
          )}
          {habit.rationale && (
            <Typography sx={{ color: C.muted, fontSize: '12px', mt: 0.75, lineHeight: 1.5, fontStyle: 'italic' }}>
              {habit.rationale}
            </Typography>
          )}
          {habit.source && (
            <Typography sx={{ color: C.muted, opacity: 0.6, fontSize: '10.5px', mt: 0.5, lineHeight: 1.4 }}>
              {habit.source}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

// ─── Read-only habit plan ─────────────────────────────────────────
// Shown to studio clients (and coaches) in the "Задачи" tab.
function PlanView() {
  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 0.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        Твоят план
      </Typography>
      <Typography sx={{ color: C.muted, fontSize: '13px', mb: 3, lineHeight: 1.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        Навиците от SYNRG Метод, събрани в 3 седмици. Не бързай — добави ги един по един и ги направи свои.
      </Typography>

      {HABIT_PLAN.map((week, wi) => (
        <Paper key={wi} sx={{
          mb: 2, p: '18px 20px',
          animation: `fadeInUp 0.22s ${EASE.decelerate} ${wi * 0.05}s both`,
        }}>
          {/* Week header */}
          <Box sx={{ mb: 1 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 800, color: C.primary, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
              Седмица {wi + 1}
            </Typography>
            <Typography sx={{ fontWeight: 800, fontSize: '17px', color: C.text, mt: 0.25, lineHeight: 1.25 }}>
              {week.title}
            </Typography>
            {week.subtitle && (
              <Typography sx={{ color: C.muted, fontSize: '12.5px', mt: 0.25 }}>
                {week.subtitle}
              </Typography>
            )}
          </Box>

          <Divider sx={{ borderColor: C.border, mb: 0.5 }} />

          {week.habits.map((habit, hi) => (
            <HabitRow
              key={hi}
              index={hi}
              habit={habit}
              last={hi === week.habits.length - 1}
            />
          ))}
        </Paper>
      ))}
    </Box>
  )
}

// Coach view (Profile tab + App routing) renders the same read-only plan.
export function AllClientsTasks() { return <PlanView /> }
export default function Tasks() { return <PlanView /> }
