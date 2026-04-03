import { useState, useCallback } from 'react'
import {
  Box, Typography, Paper, Button, TextField,
  IconButton, Divider,
} from '@mui/material'
import CloseIcon    from '@mui/icons-material/Close'
import LockIcon     from '@mui/icons-material/Lock'
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'
import { C, EASE } from '../theme'

// ── Questions ──────────────────────────────────────────────────
// ── Target calculators from questionnaire ──────────────────────
function calcTargets(weight, height, goal) {
  const w = Number(weight) || 0
  const h = Number(height) || 0

  // Protein: ≤80kg → 2g/kg, ≥90kg → 1.5g/kg, linear interpolation between
  let protein = 0
  if (w > 0) {
    if (w <= 80)      protein = Math.round(w * 2)
    else if (w >= 90) protein = Math.round(w * 1.5)
    else              protein = Math.round(w * (2 - (w - 80) * 0.05))
  }

  // Weight target: BMI 22 (middle of healthy range)
  let weightTarget = 0
  if (h > 0) weightTarget = Math.round(22 * (h / 100) ** 2)

  // Calorie target by goal: lose=23 (20 if >90kg), maintain=30, gain=35 kcal/kg
  const kcalPerKg = goal === 'gain' ? 35 : goal === 'maintain' ? 30 : (w > 90 ? 20 : 23)
  const kcal = w > 0 ? Math.round(w * kcalPerKg) : 2000

  return { protein, weightTarget, kcal }
}

const QUESTIONS = [
  {
    id: 'weight',
    type: 'number',
    labelBg: 'Колко килограма си?',
    labelEn: 'What is your current weight?',
    suffix: 'кг',
  },
  {
    id: 'height',
    type: 'number',
    labelBg: 'Колко си висок/а?',
    labelEn: 'What is your height?',
    suffix: 'см',
  },
  {
    id: 'goal',
    type: 'choice',
    labelBg: 'Каква е твоята цел?',
    labelEn: 'What is your goal?',
    options: [
      { value: 'lose',     labelBg: 'Отслабване',  labelEn: 'Lose weight' },
      { value: 'maintain', labelBg: 'Поддръжка',   labelEn: 'Maintain'    },
      { value: 'gain',     labelBg: 'Покачване',   labelEn: 'Gain'        },
    ],
  },
  {
    id: 'steps',
    type: 'choice',
    labelBg: 'Колко крачки правиш на ден?',
    labelEn: 'How many steps do you walk daily?',
    options: [
      { value: 'low',       labelBg: 'под 5 000',   labelEn: 'Under 5,000'  },
      { value: 'medium',    labelBg: '5–8 000',     labelEn: '5–8,000'      },
      { value: 'high',      labelBg: '8–12 000',    labelEn: '8–12,000'     },
      { value: 'very_high', labelBg: 'над 12 000',  labelEn: 'Over 12,000'  },
    ],
  },
  {
    id: 'packaged',
    type: 'choice',
    labelBg: 'Пакетирана / готова храна?',
    labelEn: 'Packaged / processed food?',
    options: [
      { value: 'rare',      labelBg: 'Рядко',    labelEn: 'Rarely'     },
      { value: 'sometimes', labelBg: 'Понякога', labelEn: 'Sometimes'  },
      { value: 'often',     labelBg: 'Често',    labelEn: 'Often'      },
    ],
  },
  {
    id: 'soda',
    type: 'choice',
    labelBg: 'Газирано / сладки напитки?',
    labelEn: 'Soda / sugary drinks?',
    options: [
      { value: 'none',      labelBg: 'Не пия',   labelEn: "Don't drink" },
      { value: 'sometimes', labelBg: 'Понякога', labelEn: 'Sometimes'   },
      { value: 'daily',     labelBg: 'Всеки ден',labelEn: 'Daily'       },
    ],
  },
  {
    id: 'nuts',
    type: 'choice',
    labelBg: 'Ядки, тахан, ядкови масла?',
    labelEn: 'Nuts, tahini, nut butters?',
    options: [
      { value: 'rare',      labelBg: 'Рядко',    labelEn: 'Rarely'    },
      { value: 'sometimes', labelBg: 'Понякога', labelEn: 'Sometimes' },
      { value: 'daily',     labelBg: 'Всеки ден',labelEn: 'Daily'     },
    ],
  },
  {
    id: 'fried',
    type: 'choice',
    labelBg: 'Пържено?',
    labelEn: 'Fried food?',
    options: [
      { value: 'rare',      labelBg: 'Рядко',      labelEn: 'Rarely'     },
      { value: 'sometimes', labelBg: '2–3х/седм',  labelEn: '2–3x/week'  },
      { value: 'daily',     labelBg: 'Всеки ден',  labelEn: 'Daily'      },
    ],
  },
  {
    id: 'alcohol',
    type: 'choice',
    labelBg: 'Алкохол?',
    labelEn: 'Alcohol?',
    options: [
      { value: 'none',      labelBg: 'Не пия',     labelEn: "Don't drink" },
      { value: 'sometimes', labelBg: 'Понякога',   labelEn: 'Sometimes'   },
      { value: 'daily',     labelBg: 'Всеки ден',  labelEn: 'Daily'       },
    ],
  },
]

// ── Show conditions (keyed by show_condition from DB) ──────────
const SHOW_IF_MAP = {
  always:    ()  => true,
  steps:     a   => ['low', 'medium'].includes(a.steps),
  soda:      a   => ['sometimes', 'daily'].includes(a.soda),
  packaged:  a   => ['sometimes', 'often'].includes(a.packaged),
  fried:     a   => ['sometimes', 'daily'].includes(a.fried),
  nuts:      a   => ['sometimes', 'daily'].includes(a.nuts),
  alcohol:   a   => ['sometimes', 'daily'].includes(a.alcohol),
}

// ── Kcal/monthly calculations (keyed by habit_key) ─────────────
const KCAL_MAP = {
  weigh_daily: { kcal: () => 0, monthly: () => 0 },
  log_food:    { kcal: () => 0, monthly: () => 0 },
  steps:       { kcal: a => Math.round((a.weight||70)*1.65), monthly: a => Math.round((a.weight||70)*1.65*30/7700*1000) },
  soda:        { kcal: a => a.soda === 'daily' ? 140 : 70, monthly: a => Math.round((a.soda==='daily'?140:70)*30/7700*1000) },
  packaged:    { kcal: () => 280, monthly: () => Math.round(280*30/7700*1000) },
  fat:         { kcal: () => 200, monthly: () => Math.round(200*30/7700*1000) },
  fried:       { kcal: () => 200, monthly: () => Math.round(200*30/7700*1000) },
  nuts:        { kcal: () => 300, monthly: () => Math.round(300*30/7700*1000) },
  fast_food:      { kcal: () => 500, monthly: () => Math.round(500*30/7700*1000) },
  carbs_dinner:   { kcal: () => 0, monthly: () => 0 },
  alcohol:        { kcal: () => 200, monthly: () => Math.round(200*30/7700*1000) },
  balance_meal:   { kcal: () => 0, monthly: () => 0 },
  protein_target: { kcal: () => 0, monthly: () => 0 },
  fiber_meal:     { kcal: () => 0, monthly: () => 0 },
  protein_meal:   { kcal: () => 0, monthly: () => 0 },
}

// ── Interpolate {weight}, {kcal_steps}, {protein} placeholders ──
function interpolate(text, answers, client) {
  const w       = answers?.weight || 70
  const kcal    = Math.round(w * 1.65)
  const protein = client?.proteinTarget || 140
  return (text || '')
    .replace(/\{weight\}/g, w)
    .replace(/\{kcal_steps\}/g, kcal)
    .replace(/\{protein\}/g, protein)
}

// ── Merge DB row with runtime functions ─────────────────────────
function mergeHabit(row, answers, client) {
  const calc   = KCAL_MAP[row.habit_key] || { kcal: () => 0, monthly: () => 0 }
  const showFn = SHOW_IF_MAP[row.show_condition] || (() => true)
  return {
    id:          row.habit_key,
    week:        row.week,
    labelBg:     row.label_bg,
    labelEn:     row.label_en,
    whyBg:       a => interpolate(row.why_bg, a, client),
    whyEn:       a => interpolate(row.why_en, a, client),
    practicalBg: Array.isArray(row.practical_bg) ? row.practical_bg : [],
    practicalEn: Array.isArray(row.practical_en) ? row.practical_en : [],
    showIf:      showFn,
    kcal:        calc.kcal,
    monthly:     calc.monthly,
    noKcal:      row.no_kcal,
    enabled:     row.enabled !== false,
  }
}

function todayKey(clientId) {
  return `synrg_checked_${clientId || 'guest'}_${new Date().toISOString().split('T')[0]}`
}

function loadState(key, fallback) {
  try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : fallback }
  catch { return fallback }
}
function saveState(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ── Quiz Screen ────────────────────────────────────────────────
function QuizScreen({ onDone, isBg }) {
  const [answers, setAnswers] = useState({})

  const allAnswered = QUESTIONS.every(q => {
    if (q.type === 'number') return answers[q.id] && Number(answers[q.id]) > 0
    return answers[q.id]
  })

  function set(id, val) {
    setAnswers(p => ({ ...p, [id]: val }))
  }

  return (
    <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      <Typography variant="h2" sx={{ mb: 0.5 }}>SYNRG метод</Typography>
      <Typography sx={{ fontSize: '13px', color: C.muted, mb: 3 }}>
        {isBg ? 'Отговори веднъж → планът е твой' : 'Answer once → the plan is yours'}
      </Typography>

      <Paper sx={{ overflow: 'hidden' }}>
        {QUESTIONS.map((q, qi) => {
          const label = isBg ? q.labelBg : q.labelEn
          return (
            <Box key={q.id}>
              <Box sx={{ px: 2, py: '14px' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '14px', mb: 1.5 }}>{label}</Typography>

                {q.type === 'number' ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                      size="small"
                      type="number"
                      placeholder={isBg ? 'напр. 75' : 'e.g. 75'}
                      value={answers[q.id] || ''}
                      onChange={e => set(q.id, e.target.value)}
                      inputProps={{ style: { fontSize: '14px', width: '80px' } }}
                      sx={{ width: '110px' }}
                    />
                    <Typography sx={{ color: C.muted, fontSize: '13px' }}>{q.suffix}</Typography>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {q.options.map(opt => {
                      const selected = answers[q.id] === opt.value
                      return (
                        <Box
                          key={opt.value}
                          onClick={() => set(q.id, opt.value)}
                          sx={{
                            px: 1.5, py: '6px', borderRadius: '8px', cursor: 'pointer',
                            fontSize: '13px', fontWeight: selected ? 700 : 500,
                            background: selected ? C.primary : 'rgba(255,255,255,0.06)',
                            color: selected ? C.primaryOn : C.muted,
                            border: `1px solid ${selected ? C.primary : C.border}`,
                            transition: `all 0.15s ${EASE.standard}`,
                            '&:hover': { borderColor: C.primaryA20, color: C.text },
                          }}
                        >
                          {isBg ? opt.labelBg : opt.labelEn}
                        </Box>
                      )
                    })}
                  </Box>
                )}
              </Box>
              {qi < QUESTIONS.length - 1 && <Divider sx={{ borderColor: C.border }} />}
            </Box>
          )
        })}

        {/* CTA */}
        <Box sx={{ p: 2 }}>
          <Button
            fullWidth variant="contained"
            disabled={!allAnswered}
            onClick={() => onDone(answers)}
            sx={{ py: 1.5, fontWeight: 700, fontSize: '14px' }}
          >
            {isBg ? 'Виж плана си →' : 'See my plan →'}
          </Button>
        </Box>
      </Paper>
    </Box>
  )
}

// ── Habit Popup ────────────────────────────────────────────────
function HabitPopup({ habit, answers, isBg, onClose }) {
  const label    = isBg ? habit.labelBg    : habit.labelEn
  const why      = isBg ? habit.whyBg(answers)  : habit.whyEn(answers)
  const practical = isBg ? habit.practicalBg : habit.practicalEn
  const kcal     = habit.kcal(answers)
  const monthly  = habit.monthly(answers)

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 1400,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      animation: `fadeIn 0.15s ${EASE.decelerate} both`,
    }} onClick={onClose}>
      <Box
        onClick={e => e.stopPropagation()}
        sx={{
          width: '100%', maxWidth: '520px',
          background: C.card, borderRadius: '20px 20px 0 0',
          p: 0, overflow: 'hidden',
          animation: `slideUp 0.22s ${EASE.decelerate} both`,
          '@keyframes slideUp': { from: { transform: 'translateY(60px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
        }}
      >
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2.5, pb: 1.5 }}>
          <Typography sx={{ fontWeight: 800, fontSize: '16px', fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif" }}>
            {label}
          </Typography>
          <IconButton size="small" onClick={onClose} sx={{ color: C.muted }}>
            <CloseIcon sx={{ fontSize: '18px' }} />
          </IconButton>
        </Box>
        <Divider sx={{ borderColor: C.border }} />

        <Box sx={{ px: 2.5, py: 2, display: 'grid', gap: 2 }}>
          {/* Why for you */}
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: C.muted, textTransform: 'uppercase', mb: 0.75 }}>
              {isBg ? 'Защо точно при теб?' : 'Why for you specifically?'}
            </Typography>
            <Typography sx={{ fontSize: '13.5px', color: C.text, lineHeight: 1.65 }}>
              {why}
            </Typography>
          </Box>

          {/* Practical */}
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: C.muted, textTransform: 'uppercase', mb: 1 }}>
              {isBg ? 'Как изглежда на практика' : 'How it looks in practice'}
            </Typography>
            {practical.map((tip, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.75 }}>
                <Box sx={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0, mt: '1px',
                  background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '11px', fontWeight: 900, color: C.primaryOn,
                }}>✓</Box>
                <Typography sx={{ fontSize: '13px', color: C.text }}>{tip}</Typography>
              </Box>
            ))}
          </Box>

          {/* Calorie impact — skip for awareness habits */}
          {!habit.noKcal && <Box sx={{
            display: 'flex', gap: 1.5,
            p: '12px 14px', borderRadius: '12px',
            background: C.accentSoft, border: `1px solid ${C.primaryA20}`,
          }}>
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.25 }}>
                {isBg ? 'Изгорени/ден' : 'Saved/day'}
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: C.primary }}>
                ~{kcal}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>ккал</Typography>
            </Box>
            <Divider orientation="vertical" flexItem sx={{ borderColor: C.border }} />
            <Box sx={{ flex: 1, textAlign: 'center' }}>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.25 }}>
                {isBg ? 'На месец' : 'Per month'}
              </Typography>
              <Typography sx={{ fontSize: '20px', fontWeight: 800, color: C.primary }}>
                ~{monthly}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>г</Typography>
            </Box>
          </Box>}
        </Box>

        <Box sx={{ px: 2.5, pb: 3 }}>
          <Button fullWidth variant="contained" onClick={onClose} sx={{ py: 1.25, fontWeight: 700 }}>
            {isBg ? 'Разбрах ✓' : 'Got it ✓'}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}

// ── Plan Screen ────────────────────────────────────────────────
function PlanScreen({ answers, isBg, onReset, allHabits, currentWeek, clientId }) {
  const [checked, setChecked] = useState(() => loadState(todayKey(clientId), {}))
  const [popup, setPopup]     = useState(null)

  function toggle(id) {
    const next = { ...checked, [id]: !checked[id] }
    setChecked(next)
    saveState(todayKey(clientId), next)
  }

  const myHabits = allHabits.filter(h => h.enabled && h.showIf(answers))
  const byWeek   = [1, 2, 3, 4, 5].map(w => myHabits.filter(h => h.week === w))

  const activeHabits  = byWeek[0]
  const doneCount     = activeHabits.filter(h => checked[h.id]).length
  const totalKcal     = activeHabits.reduce((s, h) => s + h.kcal(answers), 0)

  const popupHabit = popup ? allHabits.find(h => h.id === popup) : null

  return (
    <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h2" sx={{ mb: 0.25 }}>
          {isBg ? 'Твоят план' : 'Your plan'}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted }}>
          {isBg ? 'Базиран на твоите отговори' : 'Based on your answers'}
        </Typography>
        <Typography sx={{ fontSize: '12px', color: C.primary, mt: 0.5, fontWeight: 700 }}>
          {isBg
            ? `Активни правила: ${doneCount}/${activeHabits.length} · Дефицит: ~${totalKcal} ккал/ден`
            : `Active rules: ${doneCount}/${activeHabits.length} · Deficit: ~${totalKcal} kcal/day`}
        </Typography>
      </Box>

      {/* Weeks */}
      {[1, 2, 3, 4, 5].map(week => {
        const habits  = byWeek[week - 1]
        if (!habits.length) return null
        const locked  = week > currentWeek

        return (
          <Box key={week} sx={{ mb: 2 }}>
            {/* Week label */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, px: 0.5 }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: locked ? C.muted : C.primary }}>
                {isBg ? `Седмица ${week}` : `Week ${week}`}
              </Typography>
              {locked && <LockIcon sx={{ fontSize: '13px', color: C.muted }} />}
              {locked && (
                <Typography sx={{ fontSize: '11px', color: C.muted }}>
                  {isBg ? `· Отключва се след седмица ${week - 1}` : `· Unlocks after week ${week - 1}`}
                </Typography>
              )}
            </Box>

            {!locked && <Paper sx={{ overflow: 'hidden' }}>
              {habits.map((habit, i) => {
                const label = isBg ? habit.labelBg : habit.labelEn
                const done  = !!checked[habit.id]

                return (
                  <Box key={habit.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: '13px' }}>
                      {/* Circular checkbox */}
                      <Box
                        onClick={() => !locked && toggle(habit.id)}
                        sx={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          border: `2px solid ${done && !locked ? C.primary : 'rgba(255,255,255,0.18)'}`,
                          background: done && !locked ? C.primary : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: locked ? 'default' : 'pointer',
                          transition: `all 0.18s ${EASE.spring}`,
                          fontSize: '13px', color: C.primaryOn, fontWeight: 900,
                        }}
                      >
                        {done && !locked && '✓'}
                      </Box>

                      {/* Label */}
                      <Typography
                        onClick={() => !locked && toggle(habit.id)}
                        sx={{
                          flex: 1, fontWeight: 600, fontSize: '14px',
                          color: done && !locked ? C.muted : C.text,
                          textDecoration: done && !locked ? 'line-through' : 'none',
                          cursor: locked ? 'default' : 'pointer',
                          transition: `color 0.18s ${EASE.standard}`,
                        }}
                      >
                        {label}
                      </Typography>

                      {/* Info icon */}
                      <Box
                        onClick={() => setPopup(habit.id)}
                        sx={{
                          color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center',
                          cursor: 'pointer', p: '2px',
                          '&:hover': { color: C.purple },
                          transition: `color 0.15s ${EASE.standard}`,
                        }}
                      >
                        <InfoOutlinedIcon sx={{ fontSize: '17px' }} />
                      </Box>
                    </Box>
                    {i < habits.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
                  </Box>
                )
              })}
            </Paper>}
          </Box>
        )
      })}

      {/* Reset link */}
      <Typography
        onClick={onReset}
        sx={{ fontSize: '12px', color: C.muted, textAlign: 'center', mt: 1, cursor: 'pointer', '&:hover': { color: C.text } }}
      >
        {isBg ? 'Попълни въпросника отново' : 'Redo the questionnaire'}
      </Typography>

      {/* Popup */}
      {popupHabit && (
        <HabitPopup
          habit={popupHabit}
          answers={answers}
          isBg={isBg}
          onClose={() => setPopup(null)}
        />
      )}
    </Box>
  )
}

// ── Week from start date ────────────────────────────────────────
function calcWeek(startedAt) {
  if (!startedAt) return 1
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000)
  return Math.min(5, Math.floor(days / 7) + 1)
}

// ── Main ───────────────────────────────────────────────────────
export default function SynrgMethod() {
  const { lang, synrgHabits, client, updateClient } = useApp()
  const isBg = lang !== 'en'
  const answersKey = `synrg_answers_${client?.id || 'guest'}`

  const [answers, setAnswers] = useState(() => {
    const stored = loadState(answersKey, null)
    if (stored) return stored
    // Fallback to DB-saved quiz data (different device / cleared localStorage)
    if (client?.synrgQuiz) {
      saveState(answersKey, client.synrgQuiz)
      return client.synrgQuiz
    }
    return null
  })

  const allHabits   = synrgHabits.map(row => mergeHabit(row, answers, client))
  const currentWeek = calcWeek(client?.synrgStartedAt)

  const handleQuizDone = useCallback(async (a) => {
    saveState(answersKey, a)
    setAnswers(a)

    if (!client?.id) return
    const patch = {}

    // Save start date once
    if (!client.synrgStartedAt) {
      patch.synrg_started_at = new Date().toISOString().split('T')[0]
    }

    // Always update protein + calorie targets from questionnaire
    const { protein, kcal } = calcTargets(a.weight, a.height, a.goal)
    if (protein > 0) patch.protein_target = protein
    if (kcal > 0)    patch.calorie_target = kcal

    // Save full quiz answers so admin can monitor
    patch.synrg_quiz = a

    if (Object.keys(patch).length) {
      try {
        await DB.update('clients', client.id, patch)
        updateClient(c => ({
          ...c,
          ...(patch.synrg_started_at ? { synrgStartedAt: patch.synrg_started_at } : {}),
          ...(patch.protein_target   ? { proteinTarget: patch.protein_target }    : {}),
          ...(patch.calorie_target   ? { calorieTarget: patch.calorie_target }    : {}),
          synrgQuiz: a,
        }))
      } catch(e) { console.error('quiz targets save failed', e) }
    }
  }, [client, updateClient])

  function handleReset() {
    localStorage.removeItem(answersKey)
    setAnswers(null)
  }

  if (!answers) {
    return <QuizScreen onDone={handleQuizDone} isBg={isBg} />
  }

  return <PlanScreen answers={answers} isBg={isBg} onReset={handleReset} allHabits={allHabits} currentWeek={currentWeek} clientId={client?.id} />
}
