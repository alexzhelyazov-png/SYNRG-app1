import { useState, useMemo, useEffect } from 'react'
import { Box, Typography, Paper, Button, TextField, Collapse, Divider } from '@mui/material'
import RestaurantMenuIcon  from '@mui/icons-material/RestaurantMenu'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import RuleIcon            from '@mui/icons-material/Rule'
import ExpandMoreIcon      from '@mui/icons-material/ExpandMore'
import AutorenewIcon       from '@mui/icons-material/Autorenew'
import CheckCircleIcon     from '@mui/icons-material/CheckCircle'
import ArrowBackIcon       from '@mui/icons-material/ArrowBack'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import { getSustainableRules } from '../data/habitPlan'
import {
  calcNutritionTargets, isProfileComplete, buildDayMenu, formatFactor,
  STEP_BANDS, GOALS, SEXES,
} from '../lib/nutritionPlan'
import { todayDate } from '../lib/utils'

// ─── The three approaches ─────────────────────────────────────────
const MODES = [
  {
    key: 'menu',
    Icon: RestaurantMenuIcon,
    color: '#C4E9BF',
    title: 'Хранителен режим',
    desc: 'Сметнато меню за деня — три хранения, по три опции на всяко. Не мислиш какво да ядеш.',
  },
  {
    key: 'calories',
    Icon: LocalFireDepartmentIcon,
    color: '#FFD070',
    title: 'Калорийна рамка',
    desc: 'Само числата. Ядеш каквото искаш, стига да се вместиш в тях.',
  },
  {
    key: 'rules',
    Icon: RuleIcon,
    color: '#C8C5FF',
    title: '15 правила за устойчиво сваляне',
    desc: 'Без броене и без меню. Спазваш правилата и теглото тръгва надолу.',
  },
]

// ─── Small pill-style choice row ──────────────────────────────────
function ChoiceRow({ label, options, value, onChange }) {
  return (
    <Box sx={{ mb: 2 }}>
      <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.75, fontWeight: 700 }}>{label}</Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
        {options.map(o => {
          const sel = value === o.value
          return (
            <Box key={o.value} onClick={() => onChange(o.value)} sx={{
              px: 1.5, py: 0.85, borderRadius: '10px', cursor: 'pointer',
              fontSize: '13px', fontWeight: 700, userSelect: 'none',
              color: sel ? C.primaryOn : C.text,
              background: sel ? C.primary : 'transparent',
              border: `1px solid ${sel ? C.primary : C.border}`,
              transition: `all 0.15s ${EASE.standard}`,
              '&:hover': { borderColor: sel ? C.primary : C.borderHover },
            }}>
              {o.labelBg}
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}

// ─── Step 1 — pick an approach ────────────────────────────────────
function ModeChooser({ onPick }) {
  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 0.5 }}>Твоят хранителен план</Typography>
      <Typography sx={{ color: C.muted, fontSize: '13px', mb: 2.5, lineHeight: 1.5 }}>
        Избери един подход — този, който наистина ще спазваш. Можеш да го смениш по всяко време.
      </Typography>

      {MODES.map((m, i) => (
        <Paper key={m.key} onClick={() => onPick(m.key)} sx={{
          mb: 1.25, p: '16px 18px', cursor: 'pointer',
          border: `1px solid ${m.color}25`,
          background: `linear-gradient(145deg, ${m.color}0A 0%, var(--c-cardDeep) 100%)`,
          transition: `all 0.2s ${EASE.standard}`,
          animation: `fadeInUp 0.22s ${EASE.decelerate} ${i * 0.05}s both`,
          '&:hover': { transform: 'translateY(-1px)', borderColor: `${m.color}55` },
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{
              width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${m.color}22`, border: `1.5px solid ${m.color}60`,
            }}>
              <m.Icon sx={{ fontSize: 22, color: m.color }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontWeight: 800, fontSize: '15.5px', color: C.text, lineHeight: 1.3 }}>
                {m.title}
              </Typography>
              <Typography sx={{ color: C.muted, fontSize: '12.5px', mt: 0.35, lineHeight: 1.45 }}>
                {m.desc}
              </Typography>
            </Box>
          </Box>
        </Paper>
      ))}
    </Box>
  )
}

// ─── Step 2 — the body data behind the numbers ────────────────────
function ProfileForm({ initial, onSave, onBack, saving }) {
  const [p, setP] = useState(() => ({
    sex: 'female', age: '', height: '', weight: '',
    steps: 'medium', sessions: '2', goal: 'lose',
    ...(initial || {}),
  }))
  const [touched, setTouched] = useState(false)
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }))

  const missing = !isProfileComplete(p)

  return (
    <Box>
      {/* Not "Назад" — App.jsx already renders a global back-to-dashboard
          button above this, and two identical labels read as a bug. */}
      <Button size="small" startIcon={<ArrowBackIcon />} onClick={onBack}
        sx={{ color: C.muted, pl: 0, mb: 1, '&:hover': { color: C.purple } }}>
        Смени подхода
      </Button>
      <Typography variant="h2" sx={{ mb: 0.5 }}>Твоите данни</Typography>
      <Typography sx={{ color: C.muted, fontSize: '13px', mb: 2.5, lineHeight: 1.5 }}>
        От тях смятаме колко ти трябва. Отнема минута и се прави веднъж.
      </Typography>

      <Paper sx={{ p: '18px 20px', mb: 2 }}>
        <ChoiceRow label="Пол" options={SEXES} value={p.sex} onChange={v => set('sex', v)} />

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2 }}>
          {[
            { k: 'age',    label: 'Възраст', suffix: 'г.' },
            { k: 'height', label: 'Височина', suffix: 'см' },
            { k: 'weight', label: 'Тегло',   suffix: 'кг' },
          ].map(f => (
            <Box key={f.k}>
              <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.75, fontWeight: 700 }}>{f.label}</Typography>
              <TextField
                type="number" size="small" fullWidth
                value={p[f.k]}
                onChange={e => set(f.k, e.target.value)}
                inputProps={{ inputMode: 'numeric' }}
                InputProps={{ endAdornment: <Typography sx={{ fontSize: '12px', color: C.muted }}>{f.suffix}</Typography> }}
              />
            </Box>
          ))}
        </Box>

        <ChoiceRow label="Крачки на ден" options={STEP_BANDS} value={p.steps} onChange={v => set('steps', v)} />
        <ChoiceRow
          label="Тренировки на седмица"
          options={[0, 1, 2, 3, 4, 5].map(n => ({ value: String(n), labelBg: n === 5 ? '5+' : String(n) }))}
          value={String(p.sessions)}
          onChange={v => set('sessions', v)}
        />
        <ChoiceRow label="Цел" options={GOALS} value={p.goal} onChange={v => set('goal', v)} />
      </Paper>

      {touched && missing && (
        <Typography sx={{ fontSize: '12.5px', color: C.danger, mb: 1.5 }}>
          Попълни възраст, височина и тегло, за да сметнем плана.
        </Typography>
      )}

      <Button
        variant="contained" color="primary" fullWidth disabled={saving}
        onClick={() => { setTouched(true); if (!missing) onSave(p) }}
        sx={{ fontWeight: 800, py: 1.2 }}
      >
        {saving ? 'Смятам…' : 'Изчисли плана ми'}
      </Button>
    </Box>
  )
}

// ─── The four numbers, shared by menu + calorie modes ─────────────
function TargetsCard({ targets, selectedTotals }) {
  const cells = [
    { label: 'калории',    value: targets.kcal,    unit: '',  now: selectedTotals?.kcal,    color: '#FFD070' },
    { label: 'протеин',    value: targets.protein, unit: 'г', now: selectedTotals?.protein, color: '#C4E9BF' },
    { label: 'въглехидрати', value: targets.carbs, unit: 'г', now: selectedTotals?.carbs,   color: '#6EC6E8' },
    { label: 'мазнини',    value: targets.fat,     unit: 'г', now: selectedTotals?.fat,     color: '#C8C5FF' },
  ]
  return (
    <Paper sx={{ p: '16px 18px', mb: 2 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1 }}>
        {cells.map(c => (
          <Box key={c.label} sx={{ textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10.5px', color: C.muted, mb: 0.25 }}>{c.label}</Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, color: c.color, lineHeight: 1.1 }}>
              {c.value}{c.unit}
            </Typography>
            {c.now != null && (
              <Typography sx={{ fontSize: '10.5px', color: C.muted, mt: 0.25 }}>
                избрано {c.now}{c.unit}
              </Typography>
            )}
          </Box>
        ))}
      </Box>
      <Typography sx={{ fontSize: '11px', color: C.muted, opacity: 0.7, mt: 1.5, textAlign: 'center' }}>
        Основен обмен {targets.bmr} kcal · активност ×{targets.multiplier.toFixed(2)} · дневен разход {targets.tdee} kcal
      </Typography>
    </Paper>
  )
}

// ─── One meal option ──────────────────────────────────────────────
function MealOption({ opt, selected, onSelect }) {
  const [open, setOpen] = useState(false)
  const portionLabel = opt.mode === 'portion'
    ? `${formatFactor(opt.factor)} порция · ${opt.grams} г`
    : `${opt.grams} г порция`

  return (
    <Box sx={{
      borderRadius: '12px', mb: 1,
      border: `1px solid ${selected ? C.primary : C.border}`,
      background: selected ? 'rgba(196,233,191,0.06)' : 'transparent',
      transition: `all 0.15s ${EASE.standard}`,
    }}>
      <Box onClick={onSelect} sx={{
        display: 'flex', alignItems: 'center', gap: 1.25, p: '11px 13px',
        cursor: 'pointer', userSelect: 'none',
      }}>
        <Box sx={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `1.5px solid ${selected ? C.primary : C.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && <CheckCircleIcon sx={{ fontSize: 20, color: C.primary }} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, lineHeight: 1.3 }}>
            {opt.recipe.name}
          </Typography>
          <Typography sx={{ fontSize: '11.5px', color: C.muted, mt: 0.2 }}>
            {portionLabel} · {opt.kcal} kcal · {opt.protein} г протеин
          </Typography>
        </Box>
      </Box>

      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', gap: 0.5, px: '13px', pb: '9px',
        cursor: 'pointer', userSelect: 'none',
        '&:hover .prodLabel': { color: C.primary },
      }}>
        <Typography className="prodLabel" sx={{ fontSize: '11.5px', fontWeight: 700, color: C.muted, transition: `color 0.15s ${EASE.standard}` }}>
          Продукти
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 16, color: C.muted,
          transition: `transform 0.2s ${EASE.standard}`,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </Box>

      <Collapse in={open}>
        <Box sx={{ px: '13px', pb: '13px' }}>
          {opt.isBatch && (
            <Typography sx={{ fontSize: '11px', color: '#FFD070', mb: 0.75, lineHeight: 1.45 }}>
              Рецептата е за цяла тенджера — продуктите са за всичкото. Ти изяждаш {opt.grams} г от него.
            </Typography>
          )}
          {opt.ingredients.map((ing, i) => (
            <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.35 }}>
              <Typography sx={{ fontSize: '12.5px', color: C.text, opacity: 0.85 }}>{ing.name}</Typography>
              <Typography sx={{ fontSize: '12.5px', color: C.muted, flexShrink: 0 }}>
                {ing.grams != null ? `${ing.grams} ${ing.unit || 'г'}` : ing.unit}
              </Typography>
            </Box>
          ))}
          <Typography sx={{ fontSize: '11px', color: C.muted, opacity: 0.65, mt: 0.75 }}>
            {opt.kcal} kcal · {opt.protein} г протеин · {opt.carbs} г въглехидрати · {opt.fat} г мазнини
          </Typography>
        </Box>
      </Collapse>
    </Box>
  )
}

// ─── Mode: generated day menu ─────────────────────────────────────
function MenuView({ targets, seedKey }) {
  const [shuffle, setShuffle] = useState(0)
  const menu = useMemo(() => buildDayMenu(targets, seedKey, shuffle), [targets, seedKey, shuffle])

  // Default to the best-scoring option in every meal; the client can switch.
  const [picked, setPicked] = useState({})
  useEffect(() => { setPicked({}) }, [shuffle, seedKey])

  const chosen = menu.map(m => {
    const idx = picked[m.key] ?? 0
    return m.options[idx] || m.options[0]
  }).filter(Boolean)

  const totals = chosen.reduce((a, o) => ({
    kcal: a.kcal + o.kcal, protein: a.protein + o.protein,
    carbs: a.carbs + o.carbs, fat: a.fat + o.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  return (
    <Box>
      <TargetsCard targets={targets} selectedTotals={totals} />

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '15px', color: C.text }}>Менюто за днес</Typography>
        <Button
          size="small" startIcon={<AutorenewIcon sx={{ fontSize: 16 }} />}
          onClick={() => setShuffle(s => s + 1)}
          sx={{ fontSize: '12px', color: C.primary, textTransform: 'none' }}
        >
          Друго меню
        </Button>
      </Box>

      {menu.map((meal, mi) => (
        <Paper key={meal.key} sx={{
          mb: 1.5, p: '14px 16px',
          animation: `fadeInUp 0.22s ${EASE.decelerate} ${mi * 0.05}s both`,
        }}>
          <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', mb: 1.25 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '15px', color: C.text }}>{meal.labelBg}</Typography>
            <Typography sx={{ fontSize: '11.5px', color: C.muted }}>~{meal.kcalTarget} kcal</Typography>
          </Box>

          {meal.options.length === 0 ? (
            <Typography sx={{ fontSize: '12.5px', color: C.muted }}>
              Няма подходяща рецепта за това хранене. Натисни „Друго меню“.
            </Typography>
          ) : meal.options.map((opt, oi) => (
            <MealOption
              key={opt.recipe.id}
              opt={opt}
              selected={(picked[meal.key] ?? 0) === oi}
              onSelect={() => setPicked(p => ({ ...p, [meal.key]: oi }))}
            />
          ))}
        </Paper>
      ))}

      <Typography sx={{ fontSize: '11.5px', color: C.muted, lineHeight: 1.5, mb: 1 }}>
        Менюто е ориентир, не рецепта на лекар. Ако някой продукт не ти понася — смени опцията.
      </Typography>
    </Box>
  )
}

// ─── Mode: calorie framework ──────────────────────────────────────
function CaloriesView({ targets, onOpenTracker }) {
  return (
    <Box>
      <TargetsCard targets={targets} />
      <Paper sx={{ p: '16px 18px', mb: 2 }}>
        <Typography sx={{ fontSize: '13px', color: C.text, opacity: 0.85, lineHeight: 1.6 }}>
          Ядеш каквото решиш — стига да се вместиш в тези числа. Най-важното е протеинът:
          той пази мускулите докато сваляш и те държи сит. Калориите са границата,
          протеинът е целта.
        </Typography>
      </Paper>
      <Button variant="contained" color="primary" fullWidth onClick={onOpenTracker}
        sx={{ fontWeight: 800, py: 1.2 }}>
        Отвори тракера за храна
      </Button>
    </Box>
  )
}

// ─── Mode: the 15 rules ───────────────────────────────────────────
function RuleRow({ index, rule, last }) {
  const [open, setOpen] = useState(false)
  return (
    <Box sx={{ borderBottom: last ? 'none' : `1px solid ${C.border}` }}>
      <Box onClick={() => setOpen(o => !o)} sx={{
        display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5,
        cursor: 'pointer', userSelect: 'none',
        '&:hover .ruleTitle': { color: C.primary },
      }}>
        <Box sx={{
          width: 26, height: 26, borderRadius: '8px', flexShrink: 0,
          background: C.accentSoft, border: `1px solid ${C.primaryA20}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '12px', fontWeight: 800, color: C.text,
        }}>
          {index + 1}
        </Box>
        <Typography className="ruleTitle" sx={{
          flex: 1, minWidth: 0, fontWeight: 700, fontSize: '14.5px',
          color: C.text, lineHeight: 1.35, transition: `color 0.15s ${EASE.standard}`,
        }}>
          {rule.title}
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 20, color: C.muted, flexShrink: 0,
          transition: `transform 0.2s ${EASE.standard}`,
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ pl: '38px', pb: 1.75 }}>
          {rule.description && (
            <Typography sx={{ color: C.text, opacity: 0.82, fontSize: '13px', lineHeight: 1.5 }}>
              {rule.description}
            </Typography>
          )}
          {rule.rationale && (
            <Typography sx={{ color: C.muted, fontSize: '12px', mt: 0.75, lineHeight: 1.5, fontStyle: 'italic' }}>
              {rule.rationale}
            </Typography>
          )}
          {rule.source && (
            <Typography sx={{ color: C.muted, opacity: 0.6, fontSize: '10.5px', mt: 0.5, lineHeight: 1.4 }}>
              {rule.source}
            </Typography>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

export function RulesView() {
  const rules = useMemo(() => getSustainableRules(), [])
  return (
    <Paper sx={{ p: '18px 20px' }}>
      {rules.map((rule, i) => (
        <RuleRow key={rule.title} index={i} rule={rule} last={i === rules.length - 1} />
      ))}
    </Paper>
  )
}

// ─── Page ─────────────────────────────────────────────────────────
export default function NutritionPlan() {
  const {
    client, auth, setView, saveNutritionPlan, updateClientTargets, showSnackbar,
  } = useApp()

  const mode    = client?.nutritionMode || null
  const profile = client?.nutritionProfile || null
  const targets = useMemo(() => calcNutritionTargets(profile), [profile])

  // 'chooser' when nothing is picked yet, 'form' while collecting body data.
  const [stage, setStage]   = useState(null)
  const [saving, setSaving] = useState(false)

  const activeMode = MODES.find(m => m.key === mode)
  // Every mode needs the numbers, so an incomplete profile always routes to
  // the form first — even for the rules, whose targets feed the tracker.
  const needsForm = !!mode && !isProfileComplete(profile)
  const showChooser = stage === 'chooser' || !mode
  const showForm    = !showChooser && (stage === 'form' || needsForm)

  // Prefill from whatever the app already knows about them.
  const formInitial = useMemo(() => {
    if (profile) return profile
    const quiz = client?.synrgQuiz || {}
    const lastWeight = client?.weightLogs?.length
      ? client.weightLogs[client.weightLogs.length - 1]?.weight
      : null
    return {
      height: quiz.height ? String(quiz.height) : '',
      weight: lastWeight ? String(Math.round(lastWeight)) : (quiz.weight ? String(quiz.weight) : ''),
      steps:  quiz.steps || 'medium',
      goal:   quiz.goal  || 'lose',
    }
  }, [profile, client?.synrgQuiz, client?.weightLogs])

  async function pickMode(key) {
    setSaving(true)
    try {
      await saveNutritionPlan(key, null)
      setStage(isProfileComplete(profile) ? null : 'form')
    } catch (e) {
      showSnackbar('Не успях да запазя избора. Опитай пак.', 'error')
    } finally { setSaving(false) }
  }

  async function saveProfile(p) {
    setSaving(true)
    const clean = {
      sex: p.sex, age: Number(p.age), height: Number(p.height), weight: Number(p.weight),
      steps: p.steps, sessions: Number(p.sessions) || 0, goal: p.goal,
    }
    try {
      await saveNutritionPlan(mode || 'menu', clean)
      // The plan is only useful if the tracker agrees with it.
      const next = calcNutritionTargets(clean)
      if (next && client?.id) {
        await updateClientTargets(client.id, next.kcal, next.protein, next.carbs, next.fat)
      }
      setStage(null)
      showSnackbar('Планът ти е готов.')
    } catch (e) {
      showSnackbar('Не успях да запазя данните. Опитай пак.', 'error')
    } finally { setSaving(false) }
  }

  if (showChooser) return <ModeChooser onPick={pickMode} />

  if (showForm) {
    return (
      <ProfileForm
        initial={formInitial}
        saving={saving}
        onSave={saveProfile}
        onBack={() => setStage('chooser')}
      />
    )
  }

  const seedKey = `${client?.id || auth?.id || 'anon'}|${todayDate()}`

  return (
    <Box>
      {/* Header — which approach is active */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2 }}>
        {activeMode && (
          <Box sx={{
            width: 34, height: 34, borderRadius: '10px', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${activeMode.color}22`, border: `1.5px solid ${activeMode.color}60`,
          }}>
            <activeMode.Icon sx={{ fontSize: 18, color: activeMode.color }} />
          </Box>
        )}
        <Typography variant="h2" sx={{ flex: 1, minWidth: 0 }}>
          {activeMode?.title || 'Хранителен план'}
        </Typography>
      </Box>

      {mode === 'menu'     && targets && <MenuView targets={targets} seedKey={seedKey} />}
      {mode === 'calories' && targets && <CaloriesView targets={targets} onOpenTracker={() => setView('food')} />}
      {mode === 'rules'    && (
        <>
          {targets && <TargetsCard targets={targets} />}
          <RulesView />
        </>
      )}

      <Divider sx={{ borderColor: C.border, my: 2.5 }} />
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => setStage('chooser')}
          sx={{ fontSize: '12.5px', color: C.muted, textTransform: 'none', '&:hover': { color: C.purple } }}>
          Смени подхода
        </Button>
        <Button size="small" onClick={() => setStage('form')}
          sx={{ fontSize: '12.5px', color: C.muted, textTransform: 'none', '&:hover': { color: C.purple } }}>
          Редактирай данните ми
        </Button>
      </Box>
    </Box>
  )
}
