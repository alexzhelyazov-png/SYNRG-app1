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
    }
    await adminSaveNutritionPlan(client.id, 'menu', planProfile)
    setSaving(false)
    showSnackbar?.('Хранителният план е записан в профила на клиента')
  }

  function handlePrint() {
    const w = window.open('', '_blank')
    if (!w) return
    const rows = chosen.map(m => `
      <div class="meal">
        <div class="mealHead"><span>${m.labelBg}</span><span class="kcal">${m.opt.kcal} ккал</span></div>
        <div class="ingredients">
          ${(m.opt.ingredients || []).map(ing => `<div class="ing"><span>${ing.name}</span><span>${ing.grams != null ? `${ing.grams} ${ing.unit || 'г'}` : (ing.unit || '')}</span></div>`).join('')}
        </div>
      </div>`).join('')
    w.document.write(`<!DOCTYPE html><html lang="bg"><head><meta charset="UTF-8">
      <title>Хранителен план · ${client?.name || ''}</title>
      <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #141814; margin: 0; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #141814; padding-bottom: 10px; margin-bottom: 18px; }
        .brand { font-weight: 800; font-size: 20px; letter-spacing: -0.5px; }
        .sub { font-size: 11px; color: #666; }
        h1 { font-size: 16px; margin: 0 0 2px; }
        .meta { font-size: 11px; color: #555; margin-bottom: 18px; }
        .targets { display: flex; gap: 14px; margin-bottom: 20px; }
        .tcard { flex: 1; border: 1px solid #ddd; border-radius: 8px; padding: 8px 10px; text-align: center; }
        .tcard b { display: block; font-size: 15px; }
        .tcard span { font-size: 10px; color: #777; text-transform: uppercase; }
        .meal { margin-bottom: 14px; page-break-inside: avoid; }
        .mealHead { display: flex; justify-content: space-between; font-weight: 700; font-size: 13px; border-bottom: 1px solid #ccc; padding-bottom: 4px; margin-bottom: 6px; }
        .mealHead .kcal { color: #666; font-weight: 400; }
        .ing { display: flex; justify-content: space-between; font-size: 12px; padding: 2px 0; color: #333; }
        .buffer { margin-top: 10px; font-size: 11px; color: #777; border-top: 1px dashed #ccc; padding-top: 8px; }
        .footer { margin-top: 24px; font-size: 10px; color: #999; }
      </style></head><body>
      <div class="header"><div class="brand">SYNRG</div><div class="sub">Хранителен план · изготвен от д-р Желязова</div></div>
      <h1>${client?.name || ''}</h1>
      <div class="meta">Дневна цел: ${generated?.targets.kcal || ''} ккал</div>
      <div class="targets">
        <div class="tcard"><b>${totals.protein}г</b><span>протеин</span></div>
        <div class="tcard"><b>${totals.fat}г</b><span>мазнини</span></div>
        <div class="tcard"><b>${totals.carbs}г</b><span>въглехидрати</span></div>
      </div>
      ${rows}
      <div class="buffer">Останалите ~${buffer} ккал от деня са твои — прецени сам/а с какво да ги допълниш.</div>
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
                          <Typography sx={{ fontSize: '12px', color: sel ? C.text : C.muted }}>
                            {opt.recipe.name}{opt.mode === 'portion' && opt.factor !== 1 ? ` (${formatFactor(opt.factor)}x)` : ''}
                          </Typography>
                        </Box>
                        <Typography sx={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>{opt.kcal} ккал</Typography>
                      </Box>
                    )
                  })}
                </Box>
              ))}

              <Box sx={{ mt: 1, p: '8px 10px', background: 'rgba(255,184,122,0.08)', border: '1px solid rgba(255,184,122,0.25)', borderRadius: '8px' }}>
                <Typography sx={{ fontSize: '11px', color: '#FFB87A' }}>
                  ~{buffer} ккал свободен буфер остават в деня при избраните варианти
                </Typography>
              </Box>
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
