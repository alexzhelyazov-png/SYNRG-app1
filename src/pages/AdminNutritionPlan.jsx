// ─── Admin "Хранителен план" builder (Кари) ────────────────────────
// Lets an admin fill in a client's intake numbers, generate a day menu off
// the same engine the client-facing tab uses (calcNutritionTargets +
// buildDayMenu), refine it with a small set of deterministic instructions
// (no AI — a calorie-target change or an excluded food are both unambiguous
// enough to parse with regex, and a doctor-facing document shouldn't carry
// any hallucination risk), then either print it or push it into the
// client's own "Моят хранителен план" tab.
import { useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Button, TextField, MenuItem, Select,
  FormControl, InputLabel, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton,
} from '@mui/material'
import CloseIcon        from '@mui/icons-material/Close'
import AutorenewIcon    from '@mui/icons-material/Autorenew'
import DownloadIcon     from '@mui/icons-material/Download'
import SaveIcon         from '@mui/icons-material/Save'
import { C } from '../theme'
import { useApp } from '../context/AppContext'
import {
  calcNutritionTargets, buildDayMenu, applyKcalOverride, parseInstruction,
  STEP_BANDS, GOALS, SEXES, formatFactor,
} from '../lib/nutritionPlan'

// Batch recipes (whole-pot stews, yахнии) are where raw per-pot quantities
// next to a per-serving kcal number read as nonsense — "600г пилешко = 518
// ккал" looks like a mistake even though it's just 1/4 of the pot. Not
// explaining the whole recipe either — just the portion weight plus the one
// line that actually hides calories. The fat amount is always the same fixed
// cap rather than each recipe's own figure — one rule to remember instead of
// a different number per dish. Shared between the admin preview and the
// printed PDF so the two never say different things.
const FAT_RE   = /олио|мазнина|зехтин|масло/i
const MINCE_RE = /кайма/i
function batchNote(recipe) {
  const hasFat = (recipe.ingredients || []).some(ing => FAT_RE.test(ing.name))
  const hasMince = (recipe.ingredients || []).some(ing => MINCE_RE.test(ing.name))
  const bits = []
  if (hasMince) bits.push('каймата да е смляна от вас')
  if (hasFat) bits.push('за цялата тава/тенджера — максимум 2 с.л. мазнина')
  return bits.length ? `При приготвяне — ${bits.join(', ')}.` : ''
}

const inputSx = {
  '& .MuiInputBase-input':              { color: C.text, fontSize: '13px' },
  '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
  '& .MuiInputLabel-root':              { color: C.muted, fontSize: '13px' },
}

function Field({ label, children }) {
  return (
    <Box sx={{ flex: '1 1 140px', minWidth: 120 }}>
      <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>{label}</Typography>
      {children}
    </Box>
  )
}

export function NutritionPlanBuilderDialog({ open, onClose, client }) {
  const { adminSaveNutritionPlan, showSnackbar } = useApp()

  const [profile, setProfile] = useState(() => ({
    sex: 'female', age: '', height: '', weight: '',
    steps: 'medium', sessions: '3', goal: 'lose',
    mealsPerDay: '', avoidText: '', notes: '',
  }))
  const [generated, setGenerated] = useState(null) // { targets, menu, excludeTerms, shuffle }
  const [picked, setPicked]       = useState({})
  const [instruction, setInstruction] = useState('')
  const [instrFeedback, setInstrFeedback] = useState('')
  const [saving, setSaving] = useState(false)
  // Tasks outside the menu itself (weigh-ins, habit checks...) — each has a
  // free-text task and an "Очакван резултат" Kari fills in per client, not
  // something the calorie engine can infer.
  const [tasks, setTasks] = useState(() => [
    { task: 'Измерване на тегло и записване в приложението всеки ден, за да се наблюдава средно аритметично и водна задръжка.', result: '' },
  ])
  function addTask() {
    setTasks(t => [...t, { task: '', result: '' }])
  }
  function updateTask(i, field, value) {
    setTasks(t => t.map((row, idx) => idx === i ? { ...row, [field]: value } : row))
  }
  function removeTask(i) {
    setTasks(t => t.filter((_, idx) => idx !== i))
  }

  const canGenerate = profile.age && profile.height && profile.weight

  function set(field, value) {
    setProfile(p => ({ ...p, [field]: value }))
  }

  function generate(baseExclude = [], kcalTarget = null, shuffle = 0) {
    const targets0 = calcNutritionTargets(profile)
    if (!targets0) return
    const targets = kcalTarget
      ? applyKcalOverride(targets0, kcalTarget, Number(profile.weight))
      : targets0
    const avoidTerms = profile.avoidText
      .split(/[,;]/).map(s => s.trim()).filter(Boolean)
    const excludeTerms = [...new Set([...avoidTerms, ...baseExclude])]
    const forceMealCount = profile.mealsPerDay ? Number(profile.mealsPerDay) : null
    const menu = buildDayMenu(targets, client?.id || 'kari', shuffle, excludeTerms, forceMealCount)
    setGenerated({ targets, menu, excludeTerms, shuffle, kcalTarget })
    setPicked({})
  }

  function handleGenerate() {
    generate()
  }

  function handleReroll() {
    if (!generated) return
    generate(generated.excludeTerms.filter(t => !profile.avoidText.includes(t)), generated.kcalTarget, generated.shuffle + 1)
  }

  function handleApplyInstruction() {
    if (!instruction.trim() || !generated) return
    const parsed = parseInstruction(instruction)
    if (!parsed.kcalTarget && !parsed.excludeAdd.length) {
      setInstrFeedback('Не разпознах конкретна команда — опитай с число (напр. "1600 ккал") или "без [храна]".')
      return
    }
    generate(parsed.excludeAdd, parsed.kcalTarget || generated.kcalTarget, generated.shuffle + 1)
    setInstrFeedback(parsed.understood.join(' · '))
    setInstruction('')
  }

  const chosen = useMemo(() => {
    if (!generated) return []
    return generated.menu.map(m => {
      const idx = picked[m.key] ?? 0
      return { ...m, opt: m.options[idx] || m.options[0] }
    }).filter(m => m.opt)
  }, [generated, picked])

  const totals = chosen.reduce((a, m) => ({
    kcal: a.kcal + m.opt.kcal, protein: a.protein + m.opt.protein,
    carbs: a.carbs + m.opt.carbs, fat: a.fat + m.opt.fat,
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0 })

  const buffer = generated ? Math.max(0, generated.targets.kcal - totals.kcal) : 0

  async function handleSaveToClient() {
    if (!generated || !client?.id) return
    setSaving(true)
    const planProfile = {
      ...profile,
      age: Number(profile.age), height: Number(profile.height), weight: Number(profile.weight),
      kariGenerated: true,
      kariMenu: chosen.map(m => ({ key: m.key, labelBg: m.labelBg, opt: m.opt })),
      kariTargets: generated.targets,
      kariTasks: tasks.filter(t => t.task.trim()),
    }
    await adminSaveNutritionPlan(client.id, 'menu', planProfile)
    setSaving(false)
    showSnackbar?.('Хранителният план е записан в профила на клиента')
  }

  function handlePrint() {
    if (!generated) return
    const w = window.open('', '_blank')
    if (!w) return
    const t = generated.targets

    // Fresh veg/herb garnish ("на вкус", no grams) collapses into one
    // generic unlimited line instead of listing it like a measured product —
    // it shouldn't compete visually with the things that are actually
    // portioned. Seasoning stays as its own line (still useful to know it's
    // there), it's just not relabeled.
    const VEG_WORDS = /зеленчук|домат|краставиц|марул|чушк|лук|морков|целина|магданоз|копър|зеле|спанак|тиквич|патладжан|праз/i
    function isFreeVeg(ing) {
      return ing.grams == null && ing.unit === 'на вкус' && VEG_WORDS.test(ing.name)
    }
    function renderIngredients(ingredients) {
      const list = ingredients || []
      const veg = list.some(isFreeVeg)
      const rest = list.filter(ing => !isFreeVeg(ing))
      const lines = rest.map(ing => `<div class="ing"><span>${ing.name}</span><span>${ing.grams != null ? `${ing.grams} ${ing.unit || 'г'}` : (ing.unit || '')}</span></div>`)
      if (veg) lines.push('<div class="ing veg"><span>Зеленчуци</span><span>неограничени</span></div>')
      return lines.join('')
    }

    // Every option already lands near the slot's own kcal target (that's
    // what the scoring picked them for), so print all 2-3 as a numbered
    // choice instead of the one Kari happened to have selected — the
    // client picks a different one each day without needing a new plan.
    const rows = generated.menu.map(meal => `
      <div class="meal">
        <div class="mealHead"><span>${meal.labelBg}</span><span class="kcal">~${meal.kcalTarget} ккал</span></div>
        ${meal.options.map((opt, i) => {
          if (opt.isCombo) return `
            <div class="option">
              <div class="optHead"><span class="num">${i + 1}</span><span class="name">${opt.parts.map(p => `${p.grams}г ${p.label}`).join(' + ')}${opt.freeVeg ? ' + зеленчуци (неограничени)' : ''}</span><span class="kcal">${opt.kcal} ккал</span></div>
              ${opt.fatNote ? `<div class="tip">${opt.fatNote}</div>` : ''}
            </div>`
          return `
            <div class="option">
              <div class="optHead"><span class="num">${i + 1}</span><span class="name">${opt.recipe.name}</span><span class="kcal">${opt.kcal} ккал</span></div>
              ${opt.isBatch ? `
                <div class="portion">Порция: ~${opt.grams}г</div>
                ${batchNote(opt.recipe) ? `<div class="tip">${batchNote(opt.recipe)}</div>` : ''}
              ` : `<div class="ingredients">${renderIngredients(opt.ingredients)}</div>`}
            </div>`
        }).join('')}
      </div>`).join('')

    // Манджа comes after the whole day (Закуска, Обяд, Вечеря), not under
    // each meal — one section per meal that has stews, grouped together.
    const stewSections = generated.menu
      .filter(meal => meal.stews && meal.stews.length)
      .map(meal => `
        <div class="meal stews">
          <div class="mealHead light"><span>Манджа — за ${meal.labelBg.toLowerCase()}</span></div>
          <div class="option stews">
            ${meal.stews.map(s => `<div class="ing"><span>${s.name}</span><span>${s.grams}г, сготвено</span></div>`).join('')}
            <div class="tip">При приготвяне — за цялата тава/тенджера максимум 2 с.л. мазнина.</div>
          </div>
        </div>`).join('')

    const taskRows = tasks.filter(x => x.task.trim()).map(x => `
      <div class="task">
        <div class="taskText">${x.task}</div>
        <div class="taskResult"><b>Очакван резултат:</b> ${x.result.trim() || '—'}</div>
      </div>`).join('')

    w.document.write(`<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8">
      <title>Хранителен план · ${client?.name || ''}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1c231d; margin: 0; background: #fff; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 3px solid #c4e9bf; padding-bottom: 10px; margin-bottom: 18px; }
        .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.5px; color: #1c231d; }
        .sub { font-size: 11px; color: #8a9a8f; }
        h1 { font-size: 16px; margin: 0 0 2px; color: #1c231d; }
        .meta { font-size: 11px; color: #6b7566; margin-bottom: 18px; }
        .targets { display: flex; gap: 10px; margin-bottom: 22px; }
        .tcard { flex: 1; background: #f4f7f3; border-radius: 10px; padding: 10px 12px; text-align: center; }
        .tcard b { display: block; font-size: 16px; color: #1c231d; }
        .tcard span { font-size: 10px; color: #6b7566; text-transform: uppercase; letter-spacing: 0.3px; }
        .meal { margin-bottom: 16px; page-break-inside: avoid; background: #fbfbfa; border-radius: 12px; border: 1px solid #ebebe8; overflow: hidden; }
        .mealHead { display: flex; justify-content: space-between; align-items: center; font-weight: 700; font-size: 13px; background: #c4e9bf; color: #0f2e18; padding: 8px 14px; }
        .mealHead .kcal { font-weight: 600; opacity: 0.75; }
        .mealHead.light { background: #f0f0ee; color: #4a4f46; }
        .sectionLabel { font-size: 11px; font-weight: 800; color: #6b7566; text-transform: uppercase; letter-spacing: 0.5px; margin: 20px 0 10px; }
        .option { padding: 10px 14px; border-top: 1px solid #ebebe8; }
        .option.stews { background: #f7f7f5; }
        .option.stews .name { font-weight: 700; color: #6b7566; font-size: 11.5px; }
        .optHead { display: flex; align-items: baseline; gap: 8px; font-size: 12.5px; margin-bottom: 4px; }
        .optHead .num { width: 16px; height: 16px; border-radius: 50%; background: #1c231d; color: #fff; font-size: 10px; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .optHead .name { font-weight: 700; color: #1c231d; flex: 1; }
        .optHead .kcal { color: #6b7566; font-weight: 400; }
        .ing { display: flex; justify-content: space-between; font-size: 11.5px; padding: 2px 0 2px 24px; color: #3a423c; font-weight: 600; }
        .ing span:last-child { color: #6b7566; font-weight: 400; }
        .ing.veg { color: #4a7a52; font-style: italic; }
        .ing.veg span:last-child { color: #4a7a52; font-style: italic; }
        .portion { font-size: 11.5px; font-weight: 700; color: #1c231d; padding-left: 24px; margin-bottom: 3px; }
        .tip { font-size: 11px; color: #4a7a52; padding-left: 24px; margin-bottom: 3px; }
        .buffer { margin-top: 10px; font-size: 11px; color: #4a7a52; background: #eef7ec; border-radius: 8px; padding: 9px 12px; }
        .task { background: #fbfbfa; border: 1px solid #ebebe8; border-radius: 10px; padding: 10px 14px; margin-bottom: 8px; }
        .taskText { font-size: 12px; color: #1c231d; font-weight: 600; margin-bottom: 4px; }
        .taskResult { font-size: 11px; color: #6b7566; }
        .taskResult b { color: #4a4f46; }
        .note { margin-top: 8px; font-size: 10.5px; color: #8a9a8f; font-style: italic; }
        .footer { margin-top: 24px; font-size: 10px; color: #aab0a6; }
      </style></head><body>
      <div class="header"><div class="brand">SYNRG</div><div class="sub">Хранителен план · изготвен от д-р Желязова</div></div>
      <h1>${client?.name || ''}</h1>
      <div class="meta">Дневна цел: ${t.kcal} ккал · избери по едно хранене от всеки списък</div>
      <div class="targets">
        <div class="tcard"><b>${t.protein}г</b><span>протеин</span></div>
        <div class="tcard"><b>${t.fat}г</b><span>мазнини</span></div>
        <div class="tcard"><b>${t.carbs}г</b><span>въглехидрати</span></div>
      </div>
      ${rows}
      ${stewSections ? `<div class="sectionLabel">Манджа — ако предпочиташ готвено ястие</div>${stewSections}` : ''}
      ${taskRows ? `<div class="sectionLabel">Задачи</div>${taskRows}` : ''}
      <div class="buffer">Останалите ~${buffer} ккал от деня са твои — прецени сам/а с какво да ги допълниш.</div>
      <div class="note">Всяко хранене може да се замени с друго по твой избор, стига да е на същата калорийна стойност.</div>
      <div class="footer">SYNRG Beyond Fitness · Варна</div>
      <script>window.onload = () => window.print()</script>
      </body></html>`)
    w.document.close()
  }

  if (!client) return null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}`, maxHeight: '88vh' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: C.text, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Хранителен план · {client.name}
        <IconButton onClick={onClose} size="small" sx={{ color: C.muted }}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>

        <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1.25 }}>
            Данни за плана
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.25, mb: 1.25 }}>
            <Field label="Хранения / ден">
              <Select size="small" fullWidth value={profile.mealsPerDay}
                onChange={e => set('mealsPerDay', e.target.value)} displayEmpty
                sx={{ fontSize: '13px', color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                <MenuItem value="">Авто (по калории)</MenuItem>
                <MenuItem value={2}>2</MenuItem>
                <MenuItem value={3}>3</MenuItem>
                <MenuItem value={4}>4</MenuItem>
              </Select>
            </Field>
            <Field label="Пол">
              <Select size="small" fullWidth value={profile.sex} onChange={e => set('sex', e.target.value)}
                sx={{ fontSize: '13px', color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                {SEXES.map(s => <MenuItem key={s.value} value={s.value}>{s.labelBg}</MenuItem>)}
              </Select>
            </Field>
            <Field label="Цел">
              <Select size="small" fullWidth value={profile.goal} onChange={e => set('goal', e.target.value)}
                sx={{ fontSize: '13px', color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                {GOALS.map(g => <MenuItem key={g.value} value={g.value}>{g.labelBg}</MenuItem>)}
              </Select>
            </Field>
            <Field label="Височина (см)">
              <TextField size="small" fullWidth type="number" value={profile.height}
                onChange={e => set('height', e.target.value)} sx={inputSx} />
            </Field>
            <Field label="Тегло (кг)">
              <TextField size="small" fullWidth type="number" value={profile.weight}
                onChange={e => set('weight', e.target.value)} sx={inputSx} />
            </Field>
            <Field label="Възраст">
              <TextField size="small" fullWidth type="number" value={profile.age}
                onChange={e => set('age', e.target.value)} sx={inputSx} />
            </Field>
            <Field label="Стъпки / ден">
              <Select size="small" fullWidth value={profile.steps} onChange={e => set('steps', e.target.value)}
                sx={{ fontSize: '13px', color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                {STEP_BANDS.map(b => <MenuItem key={b.value} value={b.value}>{b.labelBg}</MenuItem>)}
              </Select>
            </Field>
            <Field label="Тренировки / седмица">
              <TextField size="small" fullWidth type="number" value={profile.sessions}
                onChange={e => set('sessions', e.target.value)} sx={inputSx} />
            </Field>
          </Box>

          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>Храни, които не яде</Typography>
          <TextField size="small" fullWidth placeholder="напр. риба, гъби" value={profile.avoidText}
            onChange={e => set('avoidText', e.target.value)} sx={{ ...inputSx, mb: 1.25 }} />

          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.5 }}>Бележки (по желание)</Typography>
          <TextField size="small" fullWidth multiline minRows={2} value={profile.notes}
            onChange={e => set('notes', e.target.value)} sx={inputSx} />

          <Button fullWidth disabled={!canGenerate} onClick={handleGenerate}
            sx={{ mt: 1.5, background: C.primary, color: '#0f1c11', fontWeight: 700, fontSize: '13px',
              py: 1, borderRadius: '100px', textTransform: 'none', '&:hover': { background: C.primaryHover },
              '&.Mui-disabled': { background: 'rgba(255,255,255,0.08)', color: C.muted } }}>
            Генерирай план
          </Button>
        </Box>

        {generated && (
          <>
            <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                  Генерирано меню
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '11px', color: C.primary }}>~{generated.targets.kcal} ккал</Typography>
                  <IconButton size="small" onClick={handleReroll} sx={{ color: C.muted }}>
                    <AutorenewIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Box>
              </Box>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1.5 }}>
                {totals.protein}г протеин · {totals.fat}г мазнини · {totals.carbs}г въглехидрати
              </Typography>

              {generated.menu.map(meal => (
                <Box key={meal.key} sx={{ mb: 1.5 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
                    <Typography sx={{ fontSize: '12px', fontWeight: 700 }}>{meal.labelBg}</Typography>
                    <Typography sx={{ fontSize: '10px', color: C.muted }}>избери вариант</Typography>
                  </Box>
                  {meal.options.length === 0 ? (
                    <Typography sx={{ fontSize: '12px', color: C.muted }}>Няма подходяща опция — пробвай "Друго меню" или свали изключените храни.</Typography>
                  ) : meal.options.map((opt, oi) => {
                    const sel = (picked[meal.key] ?? 0) === oi
                    return (
                      <Box key={opt.recipe.id} onClick={() => setPicked(p => ({ ...p, [meal.key]: oi }))}
                        sx={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          borderRadius: '8px', padding: '8px 10px', mb: 0.5, cursor: 'pointer',
                          background: sel ? 'rgba(196,233,191,0.08)' : 'transparent',
                          border: `1px solid ${sel ? 'rgba(196,233,191,0.3)' : C.border}`,
                        }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Box sx={{ width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                            background: sel ? C.primary : 'transparent', border: `1px solid ${sel ? C.primary : C.muted}` }} />
                          <Box>
                            <Typography sx={{ fontSize: '12px', color: sel ? C.text : C.muted }}>
                              {opt.isCombo
                                ? `${opt.parts.map(p => `${p.grams}г ${p.label}`).join(' + ')}${opt.freeVeg ? ' + зеленчуци' : ''}`
                                : `${opt.recipe.name}${opt.mode === 'portion' && opt.factor !== 1 ? ` (${formatFactor(opt.factor)}x)` : ''}`}
                            </Typography>
                            {opt.isCombo && opt.fatNote && (
                              <Typography sx={{ fontSize: '10px', color: C.muted }}>{opt.fatNote}</Typography>
                            )}
                            {opt.isBatch && (
                              <Typography sx={{ fontSize: '10px', color: '#FB923C' }}>
                                Порция: ~{opt.grams}г от цялата тава/тенджера. {batchNote(opt.recipe)}
                              </Typography>
                            )}
                          </Box>
                        </Box>
                        <Typography sx={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{opt.kcal} ккал</Typography>
                      </Box>
                    )
                  })}
                </Box>
              ))}

              {generated.menu.some(m => m.stews && m.stews.length > 0) && (
                <Box sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px', mb: 0.75 }}>
                    Манджа — ако предпочиташ готвено ястие
                  </Typography>
                  {generated.menu.filter(m => m.stews && m.stews.length > 0).map(meal => (
                    <Box key={meal.key} sx={{ mt: 0.75, p: '8px 10px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: `1px dashed ${C.border}` }}>
                      <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, mb: 0.5 }}>
                        За {meal.labelBg.toLowerCase()}
                      </Typography>
                      {meal.stews.map(s => (
                        <Typography key={s.name} sx={{ fontSize: '11px', color: C.muted, display: 'flex', justifyContent: 'space-between' }}>
                          <span>{s.name}</span><span>{s.grams}г, сготвено</span>
                        </Typography>
                      ))}
                      <Typography sx={{ fontSize: '10px', color: '#FB923C', mt: 0.5 }}>
                        При приготвяне — за цялата тава/тенджера максимум 2 с.л. мазнина.
                      </Typography>
                    </Box>
                  ))}
                </Box>
              )}

              <Box sx={{ mt: 1, p: '8px 10px', background: 'rgba(255,184,122,0.08)', border: '1px solid rgba(255,184,122,0.25)', borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '11px', color: '#FFB87A' }}>
                  ~{buffer} ккал свободен буфер остават в деня при избраните варианти
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '10.5px', color: C.muted, fontStyle: 'italic', mt: 0.75 }}>
                Всяко хранене може да се замени с друго по избор, стига да е на същата калорийна стойност.
              </Typography>
            </Box>

            <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1 }}>
                Поправи плана
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField size="small" fullWidth placeholder='напр. "1600 ккал" или "без риба"'
                  value={instruction} onChange={e => setInstruction(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleApplyInstruction() }}
                  sx={inputSx} />
                <Button onClick={handleApplyInstruction}
                  sx={{ color: C.purple, border: '1px solid rgba(200,197,255,0.3)', borderRadius: '8px',
                    px: 2, fontWeight: 700, fontSize: '13px', textTransform: 'none', whiteSpace: 'nowrap' }}>
                  Поправи
                </Button>
              </Box>
              {instrFeedback && (
                <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.75 }}>{instrFeedback}</Typography>
              )}
            </Box>

            <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1 }}>
                Задачи
              </Typography>
              {tasks.map((row, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.75, mb: 1, alignItems: 'flex-start' }}>
                  <Box sx={{ flex: 1 }}>
                    <TextField size="small" fullWidth multiline minRows={2} placeholder="Задача"
                      value={row.task} onChange={e => updateTask(i, 'task', e.target.value)}
                      sx={{ ...inputSx, mb: 0.5 }} />
                    <TextField size="small" fullWidth placeholder="Очакван резултат"
                      value={row.result} onChange={e => updateTask(i, 'result', e.target.value)}
                      sx={inputSx} />
                  </Box>
                  <IconButton size="small" onClick={() => removeTask(i)} sx={{ color: C.muted, mt: 0.5 }}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Box>
              ))}
              <Button onClick={addTask}
                sx={{ color: C.purple, border: '1px solid rgba(200,197,255,0.3)', borderRadius: '8px',
                  px: 2, py: 0.5, fontWeight: 700, fontSize: '12px', textTransform: 'none' }}>
                + Добави задача
              </Button>
            </Box>
          </>
        )}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        {generated && (
          <>
            <Button onClick={handlePrint} startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              sx={{ flex: 1, color: C.text, border: `1px solid ${C.border}`, borderRadius: '100px',
                py: 1, fontWeight: 700, fontSize: '13px', textTransform: 'none' }}>
              Изтегли PDF
            </Button>
            <Button onClick={handleSaveToClient} disabled={saving} startIcon={<SaveIcon sx={{ fontSize: 16 }} />}
              sx={{ flex: 1, background: C.primary, color: '#0f1c11', borderRadius: '100px',
                py: 1, fontWeight: 700, fontSize: '13px', textTransform: 'none', '&:hover': { background: C.primaryHover } }}>
              {saving ? 'Записва...' : 'Запази в профила'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
