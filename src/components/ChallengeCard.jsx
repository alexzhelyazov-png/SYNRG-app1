// ── ChallengeCard ───────────────────────────────────────────────
// In-app challenge card shown ONLY on LeadHome (freemium users).
// Three states:
//   1. Invite  — never started (or dismissed): overwhelm-relief copy + Start.
//   2. Active  — a day's checklist: progress dots + one or more task rows,
//                each with its own CTA + optional "виж как" / "why" note.
//   3. Done    — all days complete: Phase A shows a congrats placeholder;
//                Phase B wires the €79 graduate offer + checkout here.
//
// All completion is DERIVED from real logs via useChallenge (anti-cheat).

import { Box, Typography, Button, Stack, CircularProgress, Collapse } from '@mui/material'
import ArrowForwardIcon from '@mui/icons-material/ArrowForward'
import CheckCircleIcon  from '@mui/icons-material/CheckCircle'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import EmojiEventsIcon  from '@mui/icons-material/EmojiEvents'
import ExpandMoreIcon   from '@mui/icons-material/ExpandMore'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { useChallenge } from '../hooks/useChallenge'
import { CHALLENGE_DAYS, CHALLENGE_LEN } from '../lib/challenge'
import { C } from '../theme'

// DEV-only preview: lets us click through all 7 days locally. import.meta.env.DEV
// is false in the production build, so real users never see this switcher.
const DEV_PREVIEW = import.meta.env.DEV

// ── Day-7 personalized offer: one question, 5 tappable answers. Tapping shows
// a tailored reason, then the "Започни SYNRG Метод →" CTA. Pure copy, no logic.
// Guarantee text confirmed by Aleks: 100% money-back on completion.
const GUARANTEE_TEXT =
  'Затова имаш 100% гаранция: завършиш ли Метода докрай и резултатът не те устройва, връщаме ти парите. Рискът е изцяло наш.'

const NEEDS = [
  {
    key: 'count',
    label: 'Да не броя всяка хапка цял живот',
    text: 'Точно това е идеята. Броенето беше само за тези 7 дни — за да видиш. Методът е за живота след това: малки, незабележими промени, без да броиш вечно и без забранени храни.',
  },
  {
    key: 'person',
    label: 'Човек до мен',
    text: 'Не оставаш насаме с целта си. В Метода имаш треньор, когото питаш всичко — когато се обезсърчиш, когато не знаеш какво да ядеш, когато ти се откаже. Отговаря ти човек, не приложение.',
  },
  {
    key: 'activity',
    label: 'Физическа активност',
    text: 'Вътре имаш кратки тренировки от Елина — физиотерапевт в болница и треньор в студиото ни във Варна. Безопасни за тялото, без болки в кръста, по 15 минути. Няма да ти отнемат половин ден.',
  },
  {
    key: 'time',
    label: 'Време',
    text: 'Методът е задачи по 5–10 минути на ден, вградени в ежедневието ти. Не искаме да преобърнеш живота си — искаме да го подобрим отвътре.',
  },
  {
    key: 'guarantee',
    label: 'Съмнявам се, че ще проработи',
    text: GUARANTEE_TEXT,
  },
]

const DOT_COLOR = {
  done:   C.primary,
  todo:   C.purple,
  missed: C.danger,
  locked: C.purpleA20,
}

function ProgressDots({ dots }) {
  return (
    <Stack direction="row" spacing={0.75} sx={{ my: 1 }}>
      {dots.map(d => (
        <Box
          key={d.day}
          sx={{
            width: 28, height: 6, borderRadius: 3,
            background: DOT_COLOR[d.state] || C.purpleA20,
            opacity: d.state === 'locked' ? 0.4 : 1,
            transition: 'background 0.2s, opacity 0.2s',
          }}
        />
      ))}
    </Stack>
  )
}

const cardSx = {
  position: 'relative',
  background: `linear-gradient(135deg, ${C.primaryContainer} 0%, rgba(200,197,255,0.06) 100%)`,
  border: `1px solid ${C.purpleA20}`,
  borderRadius: '20px',
  p: { xs: 2, sm: 2.75 },
  overflow: 'hidden',
}

export default function ChallengeCard() {
  const { startChallenge, dismissChallenge, setView } = useApp()
  const ch = useChallenge()
  const [busy, setBusy] = useState(false)
  const [openHow, setOpenHow] = useState({})   // per-task "виж как" toggle, keyed by task id
  const toggleHow = (id) => setOpenHow(o => ({ ...o, [id]: !o[id] }))
  const [previewDay, setPreviewDay] = useState(null)   // DEV-only forced day (1..7) or null
  const [selectedNeed, setSelectedNeed] = useState(null)   // Day-7 offer: chosen answer key or null

  // Same target as LeadHome's CTA — the full SYNRG Метод sales LP (has checkout).
  const openMethod = () => { window.location.href = '../synrg-method.html' }

  // DEV switcher UI — rendered above the card so we can jump to any day.
  const devBar = DEV_PREVIEW ? (
    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
      <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, mr: 0.5 }}>DEV:</Typography>
      {CHALLENGE_DAYS.map(d => (
        <Button
          key={d.day}
          onClick={() => setPreviewDay(d.day)}
          sx={{
            minWidth: 0, px: 1, py: 0.25, fontSize: '11px', fontWeight: 800, borderRadius: '8px',
            color: previewDay === d.day ? '#0A0A14' : C.purple,
            background: previewDay === d.day ? C.purple : C.purpleA5,
            '&:hover': { background: previewDay === d.day ? C.purpleLighter : C.purpleA20 },
          }}
        >
          {d.day}
        </Button>
      ))}
      <Button onClick={() => setPreviewDay(null)} sx={{ minWidth: 0, px: 1, py: 0.25, fontSize: '11px', fontWeight: 800, color: C.muted }}>
        изход
      </Button>
    </Stack>
  ) : null

  const onStart = async () => {
    setBusy(true)
    try { await startChallenge() } finally { setBusy(false) }
  }
  const onDismiss = async () => {
    setBusy(true)
    try { await dismissChallenge() } finally { setBusy(false) }
  }

  // DEV preview override — force the active checklist for the chosen day so we
  // can eyeball every day without touching the DB. Tasks show as not-done.
  const preview = DEV_PREVIEW && previewDay != null
  const previewVm = preview ? {
    day: previewDay,
    len: CHALLENGE_LEN,
    completedDays: previewDay - 1,
    todayDone: false,
    dots: CHALLENGE_DAYS.map(d => ({
      day: d.day,
      state: d.day < previewDay ? 'done' : d.day === previewDay ? 'todo' : 'locked',
    })),
    todayTasks: (CHALLENGE_DAYS[previewDay - 1]?.tasks || []).map(t => ({ ...t, done: false })),
  } : null
  // Day 7 (or later) shows the offer directly — DEV preview of day 7 too.
  const previewOffer = preview && previewDay >= CHALLENGE_LEN

  // ── State 1: Invite (not started, or previously dismissed) ──────
  const notStarted = !ch.startedOn || ch.status === 'dismissed'
  if (notStarted && !preview) {
    return (
      <>
      {devBar}
      <Box sx={cardSx}>
        <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '3px', color: C.purple, mb: 1.25 }}>
          {ch.len}-ДНЕВЕН CHALLENGE
        </Typography>
        <Typography sx={{
          fontSize: { xs: '20px', sm: '24px' }, lineHeight: 1.15, fontWeight: 800,
          fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif", color: C.text, mb: 1.25,
        }}>
          Отвори приложението и не знаеш откъде да започнеш?
        </Typography>
        <Typography sx={{ fontSize: { xs: '13px', sm: '14px' }, lineHeight: 1.5, color: C.muted, mb: 2, maxWidth: 560 }}>
          Ето кратък безплатен challenge, който те води стъпка по стъпка — малки действия всеки ден. Без диети, без натиск.
        </Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            onClick={onStart}
            disabled={busy}
            variant="contained"
            endIcon={busy ? <CircularProgress size={16} sx={{ color: '#0A0A14' }} /> : <ArrowForwardIcon />}
            sx={{
              background: C.purple, color: '#0A0A14', fontWeight: 800, textTransform: 'none',
              px: 2.5, py: 1.1, borderRadius: '12px', letterSpacing: '0.2px',
              '&:hover': { background: C.purpleLighter },
            }}
          >
            Започни
          </Button>
          <Button
            onClick={onDismiss}
            disabled={busy}
            sx={{ color: C.muted, fontWeight: 700, textTransform: 'none', fontSize: '13px', opacity: 0.7 }}
          >
            Не сега
          </Button>
        </Stack>
      </Box>
      </>
    )
  }

  // ── State 3: Offer — shown FROM day 7 onward (evergreen: days unlock by
  // time, so day 7 = the offer directly, not a checklist) or once all done. ──
  if (previewOffer || ((ch.day >= ch.len || ch.allDone) && !preview)) {
    return (
      <>
      {devBar}
      <Box sx={cardSx}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
          <EmojiEventsIcon sx={{ color: C.purple, fontSize: 22 }} />
          <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '3px', color: C.purple }}>
            ЗАВЪРШИ CHALLENGE-А
          </Typography>
        </Stack>
        <Typography sx={{
          fontSize: { xs: '20px', sm: '24px' }, lineHeight: 1.15, fontWeight: 800,
          fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif", color: C.text, mb: 1.25,
        }}>
          Вече {ch.len} дни си в приложението. Браво!
        </Typography>
        <Typography sx={{ fontSize: { xs: '13px', sm: '14px' }, lineHeight: 1.5, color: C.muted, maxWidth: 560 }}>
          Вече знаеш да си следиш калориите. Но да го правиш цял живот е изтощително — точно това решава SYNRG Метод с д-р Желязова.
        </Typography>
        <ProgressDots dots={previewOffer ? previewVm.dots : ch.dots} />

        {/* ── Personalized offer: one question, 5 answers, tailored reason + CTA ── */}
        <Box sx={{ mt: 2.5, pt: 2.5, borderTop: `1px solid ${C.purpleA20}` }}>
          <Typography sx={{
            fontSize: { xs: '16px', sm: '18px' }, lineHeight: 1.2, fontWeight: 800,
            fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif", color: C.text, mb: 1.5,
          }}>
            От какво имаш нужда, за да постигнеш целта си?
          </Typography>

          <Stack spacing={1}>
            {NEEDS.map(n => {
              const active = selectedNeed === n.key
              return (
                <Button
                  key={n.key}
                  onClick={() => setSelectedNeed(n.key)}
                  fullWidth
                  sx={{
                    justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none',
                    fontSize: '13.5px', fontWeight: 800, lineHeight: 1.3, py: 1.1, px: 1.75,
                    borderRadius: '12px',
                    color: active ? '#0A0A14' : C.purple,
                    background: active ? C.purple : C.purpleA5,
                    border: `1.5px solid ${active ? C.purple : C.purpleA20}`,
                    '&:hover': { background: active ? C.purpleLighter : C.purpleA20, borderColor: C.purple },
                  }}
                >
                  {n.label}
                </Button>
              )
            })}
          </Stack>

          <Collapse in={!!selectedNeed}>
            <Box sx={{ borderLeft: `3px solid ${C.purple}`, pl: 1.75, py: 0.75, mt: 1.75 }}>
              <Typography sx={{ fontSize: { xs: '13px', sm: '13.5px' }, lineHeight: 1.55, color: C.text }}>
                {NEEDS.find(n => n.key === selectedNeed)?.text}
              </Typography>
            </Box>
            <Button
              onClick={openMethod}
              variant="contained"
              endIcon={<ArrowForwardIcon sx={{ fontSize: 18 }} />}
              sx={{
                mt: 1.75, background: C.purple, color: '#0A0A14', fontWeight: 800, textTransform: 'none',
                px: 2.75, py: 1.1, borderRadius: '12px', fontSize: '14px', letterSpacing: '0.2px',
                '&:hover': { background: C.purpleLighter },
              }}
            >
              Започни SYNRG Метод
            </Button>
          </Collapse>
        </Box>
      </Box>
      </>
    )
  }

  // ── State 2: Active (checklist of today's tasks) ────────────────
  // vm = real challenge, or the DEV preview override when a day is selected.
  const vm = preview ? previewVm : ch
  const tasks = vm.todayTasks
  return (
    <>
    {devBar}
    <Box sx={cardSx}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
        <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '3px', color: C.purple }}>
          ДЕН {vm.day} ОТ {vm.len}
        </Typography>
        {vm.todayDone ? (
          <Stack direction="row" spacing={0.5} alignItems="center">
            <CheckCircleIcon sx={{ color: C.primary, fontSize: 16 }} />
            <Typography sx={{ fontSize: '11px', fontWeight: 800, color: C.primary }}>
              Готово за днес
            </Typography>
          </Stack>
        ) : (
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted }}>
            {vm.completedDays}/{vm.len} дни
          </Typography>
        )}
      </Stack>

      <ProgressDots dots={vm.dots} />

      {/* Today's checklist — one or more tasks for the current day */}
      <Stack spacing={2.25} sx={{ mt: 1.5 }}>
        {tasks.map((task, idx) => (
          <Box key={task.id || idx}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              {task.done
                ? <CheckCircleIcon sx={{ color: C.primary, fontSize: 20, mt: '1px', flexShrink: 0 }} />
                : <RadioButtonUncheckedIcon sx={{ color: C.purpleA20, fontSize: 20, mt: '1px', flexShrink: 0 }} />}
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{
                  fontSize: { xs: '16px', sm: '17px' }, lineHeight: 1.2, fontWeight: 800,
                  fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif",
                  color: task.done ? C.muted : C.text, mb: 0.5,
                  textDecoration: task.done ? 'line-through' : 'none',
                }}>
                  {task.titleBg}
                </Typography>
                <Typography sx={{ fontSize: { xs: '13px', sm: '13.5px' }, lineHeight: 1.5, color: C.muted, mb: 0.75 }}>
                  {task.descBg}
                </Typography>

                {/* "виж как" — per-task, collapsed by default */}
                {task.howBg && (
                  <Box sx={{ mb: task.whyBg ? 1 : 1.25 }}>
                    <Button
                      onClick={() => toggleHow(task.id)}
                      endIcon={<ExpandMoreIcon sx={{ transform: openHow[task.id] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />}
                      sx={{
                        color: C.purple, fontWeight: 800, textTransform: 'none', fontSize: '13px',
                        p: 0, minWidth: 0, '&:hover': { background: 'transparent', color: C.purpleLighter },
                      }}
                    >
                      {task.seeLabel || 'Виж как'}
                    </Button>
                    <Collapse in={!!openHow[task.id]}>
                      <Box sx={{ borderLeft: `3px solid ${C.purpleA20}`, pl: 1.5, py: 0.5, mt: 1 }}>
                        {task.seeLabel === 'Виж защо' && (
                          <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: C.purple, mb: 0.5 }}>
                            Д-Р ЖЕЛЯЗОВА
                          </Typography>
                        )}
                        {task.howBg.map((line, i) => (
                          <Typography key={i} sx={{ fontSize: '12.5px', lineHeight: 1.55, color: C.muted, mb: i < task.howBg.length - 1 ? 0.5 : 0 }}>
                            {line}
                          </Typography>
                        ))}
                      </Box>
                    </Collapse>
                  </Box>
                )}

                {task.whyBg && (
                  <Box sx={{ borderLeft: `3px solid ${C.purpleA20}`, pl: 1.5, py: 0.5, mb: 1.25 }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1px', color: C.purple, mb: 0.25 }}>
                      ЗАЩО · Д-Р ЖЕЛЯЗОВА
                    </Typography>
                    <Typography sx={{ fontSize: '12.5px', lineHeight: 1.5, color: C.muted, fontStyle: 'italic' }}>
                      {task.whyBg}
                    </Typography>
                  </Box>
                )}

                <Button
                  onClick={() => task.view && setView(task.view)}
                  variant={task.done ? 'outlined' : 'contained'}
                  endIcon={<ArrowForwardIcon sx={{ fontSize: 16 }} />}
                  sx={task.done ? {
                    borderColor: C.purpleA20, color: C.purple, fontWeight: 800, textTransform: 'none',
                    px: 2, py: 0.75, borderRadius: '12px', fontSize: '13px',
                    '&:hover': { borderColor: C.purple, background: C.purpleA5 },
                  } : {
                    background: C.purple, color: '#0A0A14', fontWeight: 800, textTransform: 'none',
                    px: 2.25, py: 0.9, borderRadius: '12px', fontSize: '13px', letterSpacing: '0.2px',
                    '&:hover': { background: C.purpleLighter },
                  }}
                >
                  {task.action || 'Отвори'}
                </Button>
              </Box>
            </Stack>
          </Box>
        ))}
      </Stack>

      {vm.todayDone && vm.day < vm.len && (
        <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: C.primary, mt: 2 }}>
          Върни се утре за Ден {vm.day + 1}.
        </Typography>
      )}
    </Box>
    </>
  )
}
