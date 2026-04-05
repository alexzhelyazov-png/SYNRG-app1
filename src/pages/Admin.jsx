import { useEffect, useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Button, Chip, Divider, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress,
  Tab, Tabs, Alert, Collapse, useMediaQuery,
  Checkbox, FormControlLabel,
  RadioGroup, Radio, FormLabel, LinearProgress,
} from '@mui/material'
import { useTheme }          from '@mui/material/styles'
import CalendarMonthIcon     from '@mui/icons-material/CalendarMonth'
import AccessTimeIcon        from '@mui/icons-material/AccessTime'
import AddIcon               from '@mui/icons-material/Add'
import EditIcon              from '@mui/icons-material/Edit'
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline'
import PersonAddIcon         from '@mui/icons-material/PersonAdd'
import PersonRemoveIcon      from '@mui/icons-material/PersonRemove'
import CreditCardIcon        from '@mui/icons-material/CreditCard'
import PeopleIcon            from '@mui/icons-material/People'
import WarningAmberIcon      from '@mui/icons-material/WarningAmber'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import FitnessCenterIcon     from '@mui/icons-material/FitnessCenter'
import ExpandMoreIcon        from '@mui/icons-material/ExpandMore'
import ExpandLessIcon        from '@mui/icons-material/ExpandLess'
import ChevronLeftIcon       from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon      from '@mui/icons-material/ChevronRight'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import EmailIcon               from '@mui/icons-material/Email'
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartment'
import Switch                from '@mui/material/Switch'
import { useApp }            from '../context/AppContext'
import SiteTab               from './AdminSiteTab'
import ProgramsTab           from './AdminProgramsTab'
import SubscriptionsTab      from './AdminSubscriptionsTab'
import { useBooking }        from '../context/BookingContext'
import { C }                 from '../theme'
import { DB }                from '../lib/db'
import { MODULE_DEFS, MODULE_PRESETS, ADMIN_MANAGEABLE_MODULES } from '../lib/modules'
import {
  isoToday, isoDatePlusDays, groupByDate, dayLabel, fmtTime,
  occupancyStr, planLabel, fmtValidTo, isPlanActive, creditsRemaining,
  daysUntilExpiry, effectiveValidTo, isFullAdmin,
} from '../lib/bookingUtils'
import { parseDate } from '../lib/utils'

const PLAN_TYPES = ['8', '12', 'unlimited']
const DEFAULT_PRICES = { '8': 154, '12': 179, 'unlimited': 202 }
const WEEKDAY_KEYS = [1, 2, 3, 4, 5, 6, 0] // Mon–Sun display order

// ── Branded email HTML builder ────────────────────────────────
function buildBroadcastHtml(text) {
  const escaped = (text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px;background:#111;color:#e0e0e0;border-radius:16px">
    <h2 style="color:#c4e9bf;margin:0 0 16px;font-size:20px;font-weight:800">SYNRG Beyond Fitness</h2>
    <div style="font-size:15px;line-height:1.7;color:#ccc">${escaped}</div>
    <p style="margin-top:32px;font-size:12px;color:#555">synrg-beyondfitness.com</p>
  </div>`
}

// ── Stat Card (dashboard) ────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, onClick }) {
  return (
    <Paper onClick={onClick} sx={{
      p: 2, borderRadius: '16px', flex: 1, minWidth: 120,
      border: `1px solid ${color}22`,
      background: `${color}08`,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s',
      '&:hover': onClick ? { transform: 'translateY(-2px)' } : {},
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Icon sx={{ fontSize: 18, color }} />
        <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {label}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '26px', color }}>
        {value}
      </Typography>
    </Paper>
  )
}

// ── Create/edit slot dialog ──────────────────────────────────
function SlotDialog({ open, onClose, onSave, coaches, t }) {
  const today = isoToday()
  const [mode,       setMode]       = useState('single') // 'single' | 'recurring'
  const [slotDate,   setSlotDate]   = useState(today)
  const [startTime,  setStartTime]  = useState('09:00')
  const [endTime,    setEndTime]    = useState('10:00')
  const [coachName,  setCoachName]  = useState(coaches[0]?.name || '')
  const [capacity,   setCapacity]   = useState(3)
  const [notes,      setNotes]      = useState('')
  const [startDate,  setStartDate]  = useState(today)
  const [endDate,    setEndDate]    = useState(isoDatePlusDays(13))
  const [weekdays,   setWeekdays]   = useState([1, 2, 3, 4, 5]) // Mon–Fri
  const [saving,     setSaving]     = useState(false)
  const [result,     setResult]     = useState(null) // { created: N }

  const WEEKDAY_LABELS_BG = { 0:'Нед',1:'Пон',2:'Вт',3:'Ср',4:'Чет',5:'Пет',6:'Съб' }

  function toggleWeekday(d) {
    setWeekdays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  async function handleSave() {
    setSaving(true); setResult(null)
    const coach = coaches.find(c => c.name === coachName)
    if (mode === 'single') {
      const res = await onSave({ mode: 'single', slot_date: slotDate, start_time: startTime, end_time: endTime,
        coach_id: coach?.id || null, coach_name: coachName, capacity: Number(capacity), notes })
      setSaving(false)
      if (!res?.error) { onClose(); resetForm() }
    } else {
      const res = await onSave({ mode: 'recurring', startDate, endDate, weekdays,
        startTime, endTime, coachId: coach?.id || null, coachName, capacity: Number(capacity), notes })
      setSaving(false)
      if (res?.created !== undefined) setResult(res)
    }
  }

  function resetForm() {
    setSlotDate(today); setStartTime('09:00'); setEndTime('10:00')
    setCapacity(3); setNotes(''); setResult(null)
  }

  const inputSx = {
    '& .MuiInputBase-input':           { color: C.text },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
    '& .MuiInputLabel-root':            { color: C.muted },
    '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' },
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text }}>{t('createSlotTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '4px !important' }}>

        {/* Mode tabs */}
        <Box sx={{ display: 'flex', gap: 1, mb: 0.5 }}>
          {['single', 'recurring'].map(m => (
            <Box key={m} onClick={() => setMode(m)} sx={{
              px: 2, py: 0.75, borderRadius: '100px', cursor: 'pointer', fontSize: '13px', fontWeight: 700,
              background: mode === m ? C.primary : 'transparent',
              color:      mode === m ? C.primaryOn : C.text,
              border:     `1px solid ${mode === m ? C.primary : C.loganBorder}`,
              transition: 'all 0.22s',
              '&:hover': mode === m ? {} : { borderColor: C.logan, background: C.loganDeep },
            }}>
              {m === 'single' ? t('createOne') : t('createMulti')}
            </Box>
          ))}
        </Box>

        {/* Coach */}
        <FormControl fullWidth size="small">
          <InputLabel sx={{ color: C.muted }}>{t('slotCoachLbl')}</InputLabel>
          <Select value={coachName} onChange={e => setCoachName(e.target.value)} label={t('slotCoachLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {coaches.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        {/* Time */}
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <TextField label={t('slotStartLbl')} type="time" size="small" fullWidth
            value={startTime} onChange={e => setStartTime(e.target.value)} sx={inputSx}
            InputLabelProps={{ shrink: true }} />
          <TextField label={t('slotEndLbl')} type="time" size="small" fullWidth
            value={endTime} onChange={e => setEndTime(e.target.value)} sx={inputSx}
            InputLabelProps={{ shrink: true }} />
        </Box>

        {/* Capacity */}
        <TextField label={t('slotCapacityLbl')} type="number" size="small"
          value={capacity} onChange={e => setCapacity(e.target.value)}
          inputProps={{ min: 1, max: 30 }} sx={inputSx} />

        {/* Single: date */}
        {mode === 'single' && (
          <TextField label={t('slotDateLbl')} type="date" size="small"
            value={slotDate} onChange={e => setSlotDate(e.target.value)}
            sx={inputSx} InputLabelProps={{ shrink: true }} />
        )}

        {/* Recurring: date range + weekdays */}
        {mode === 'recurring' && (
          <>
            <Box sx={{ display: 'flex', gap: 1.5 }}>
              <TextField label={t('dateFrom')} type="date" size="small" fullWidth
                value={startDate} onChange={e => setStartDate(e.target.value)}
                sx={inputSx} InputLabelProps={{ shrink: true }} />
              <TextField label={t('dateTo')} type="date" size="small" fullWidth
                value={endDate} onChange={e => setEndDate(e.target.value)}
                sx={inputSx} InputLabelProps={{ shrink: true }} />
            </Box>
            <Box>
              <Typography sx={{ fontSize: '12px', color: C.muted, mb: 0.75 }}>
                {t('selectWeekdays')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                {WEEKDAY_KEYS.map(d => (
                  <Box key={d} onClick={() => toggleWeekday(d)} sx={{
                    px: 1.5, py: 0.5, borderRadius: '8px', cursor: 'pointer',
                    fontSize: '12px', fontWeight: 700,
                    background: weekdays.includes(d) ? C.primaryContainer : 'rgba(255,255,255,0.06)',
                    color:      weekdays.includes(d) ? C.purple : C.muted,
                    border:     `1px solid ${weekdays.includes(d) ? C.primaryA20 : C.border}`,
                  }}>
                    {WEEKDAY_LABELS_BG[d]}
                  </Box>
                ))}
              </Box>
            </Box>
          </>
        )}

        {/* Notes */}
        <TextField label={t('slotNotesLbl')} size="small" multiline rows={2}
          value={notes} onChange={e => setNotes(e.target.value)} sx={inputSx} />

        {/* Result */}
        {result && (
          <Alert severity="success" sx={{ borderRadius: '10px' }}>
            {t('slotsCreatedMsg')}: {result.created}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={() => { onClose(); resetForm() }} sx={{ color: C.muted }}>
          {t('cancelBtn')}
        </Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {saving ? <CircularProgress size={16} /> : (mode === 'single' ? t('createSlotBtn') : t('createRecurring'))}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Activate/manage plan dialog ──────────────────────────────
function PlanDialog({ open, onClose, onActivate, onExtend, onAdjust, onTogglePaid, client, plan, t }) {
  const [mode,          setMode]         = useState('activate') // 'activate' | 'extend' | 'adjust'
  const [planType,      setPlanType]     = useState('')
  const [validFrom,     setValidFrom]    = useState(isoToday())
  const [validTo,       setValidTo]      = useState(() => isoDatePlusDays(30))
  const [extendTo,      setExtendTo]     = useState('')
  const [credUsed,      setCredUsed]     = useState(plan?.credits_used ?? 0)
  const [price,         setPrice]        = useState(plan?.price ?? DEFAULT_PRICES['8'])
  const [isPaid,        setIsPaid]       = useState(plan?.is_paid ?? true)
  const [startCredits,  setStartCredits] = useState('')
  const [saving,        setSaving]       = useState(false)

  // When planType changes, reset startCredits and update default price
  useEffect(() => {
    setStartCredits('')
    if (!plan) setPrice(DEFAULT_PRICES[planType] ?? 0)
  }, [planType])

  // When validFrom changes, update validTo to 30 days later
  useEffect(() => {
    const d = new Date(validFrom + 'T00:00:00'); d.setDate(d.getDate() + 30)
    setValidTo(d.toISOString().slice(0, 10))
  }, [validFrom])

  useEffect(() => {
    if (plan) {
      const eff = effectiveValidTo(plan)
      setExtendTo(eff || isoDatePlusDays(7))
      setCredUsed(plan.credits_used || 0)
    }
  }, [plan])

  async function handleSave() {
    setSaving(true)
    let res
    if (mode === 'activate' && planType) {
      const sc = startCredits !== '' ? Number(startCredits) : null
      res = await onActivate(client.id, planType, validFrom, price, sc, isPaid, validTo)
    } else if (mode === 'extend') {
      res = await onExtend(plan.id, extendTo)
    } else if (mode === 'adjust') {
      res = await onAdjust(plan.id, Number(credUsed))
    }
    // Update is_paid separately if plan exists and changed (or if no new plan was created)
    if (plan && plan.is_paid !== isPaid && onTogglePaid) {
      await onTogglePaid(plan.id, isPaid)
    }
    setSaving(false)
    if (!res?.error) onClose()
  }

  // Allow save when plan exists and only is_paid changed (no need to select new planType)
  const paidChanged = plan && plan.is_paid !== isPaid

  const inputSx = {
    '& .MuiInputBase-input':           { color: C.text },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
    '& .MuiInputLabel-root':            { color: C.muted },
    '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' },
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text }}>
        {t('planFor')}: {client?.name}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '4px !important' }}>
        {/* Mode buttons */}
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          {[
            { key: 'activate', label: t('activatePlanBtn') },
            ...(plan ? [{ key: 'extend', label: t('extendPlanBtn') }] : []),
            ...(plan && plan.plan_type !== 'unlimited' ? [{ key: 'adjust', label: t('adjustCreditsBtn') }] : []),
          ].map(({ key, label }) => (
            <Box key={key} onClick={() => setMode(key)} sx={{
              px: 2, py: 0.75, borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              background: mode === key ? C.primary : 'transparent',
              color:      mode === key ? C.primaryOn : C.text,
              border:     `1px solid ${mode === key ? C.primary : C.loganBorder}`,
              transition: 'all 0.22s',
              '&:hover': mode === key ? {} : { borderColor: C.logan, background: C.loganDeep },
            }}>
              {label}
            </Box>
          ))}
        </Box>

        {/* Current plan info */}
        {plan && (
          <Box sx={{
            p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${C.border}`,
          }}>
            <Typography sx={{ fontSize: '12px', color: C.muted }}>
              {t('hasActivePlan')}: {planLabel(plan.plan_type, t)}
              {plan.plan_type !== 'unlimited' && ` · ${creditsRemaining(plan)}/${plan.credits_total}`}
              {' · '}{t('validUntil')}: {fmtValidTo(plan)}
            </Typography>
            <FormControlLabel
              control={<Checkbox checked={isPaid} onChange={e => setIsPaid(e.target.checked)}
                sx={{ color: C.primary, '&.Mui-checked': { color: C.primary }, p: 0.5 }} />}
              label={isPaid ? t('markedPaid') : t('markedUnpaid')}
              sx={{ '& .MuiTypography-root': { fontSize: '12px', color: isPaid ? C.purple : '#FB923C', fontWeight: 700 }, mt: 0.5 }}
            />
          </Box>
        )}

        {/* Activate mode */}
        {mode === 'activate' && (
          <>
            <FormControl fullWidth size="small">
              <InputLabel sx={{ color: C.muted }}>{t('selectPlanType')}</InputLabel>
              <Select value={planType} onChange={e => setPlanType(e.target.value)} label={t('selectPlanType')}
                displayEmpty
                sx={{ color: planType ? C.text : C.muted, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
                <MenuItem value="" disabled><em>{t('selectPlanType')}</em></MenuItem>
                {PLAN_TYPES.map(pt => <MenuItem key={pt} value={pt}>{planLabel(pt, t)}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField label={t('validFromLbl')} type="date" size="small"
              value={validFrom} onChange={e => setValidFrom(e.target.value)}
              sx={inputSx} InputLabelProps={{ shrink: true }} />
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
              <TextField label={t('priceLbl')} type="number" size="small"
                value={price} onChange={e => setPrice(e.target.value)}
                inputProps={{ min: 0 }} sx={{ ...inputSx, flex: 1 }}
                helperText={Number(price) === 0 ? t('freeLbl') : `${price} €`}
                FormHelperTextProps={{ sx: { color: Number(price) === 0 ? C.muted : C.purple } }}
              />
              <FormControlLabel
                control={<Checkbox checked={isPaid} onChange={e => setIsPaid(e.target.checked)}
                  sx={{ color: C.primary, '&.Mui-checked': { color: C.primary }, p: 0.5 }} />}
                label={t('markedPaid')}
                sx={{ '& .MuiTypography-root': { fontSize: '12px', color: isPaid ? C.purple : C.muted, fontWeight: 700 }, mt: 0.5 }}
              />
            </Box>
            {/* Migration override: remaining sessions from old platform */}
            {planType && planType !== 'unlimited' && (() => {
              const total = planType === '8' ? 8 : 12
              const remaining = startCredits !== '' ? Number(startCredits) : total
              return (
                <Box sx={{ p: 1.5, borderRadius: '12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
                  <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1 }}>
                    {t('migrationLbl')}
                  </Typography>
                  <TextField label={t('startingCreditsLbl')} type="number" size="small" fullWidth
                    value={startCredits}
                    onChange={e => setStartCredits(e.target.value)}
                    placeholder={String(total)}
                    inputProps={{ min: 0, max: total }}
                    sx={inputSx}
                    helperText={startCredits === ''
                      ? t('startingCreditsHint')
                      : `${t('creditsLeft')}: ${remaining} / ${total}`}
                    FormHelperTextProps={{ sx: { color: startCredits !== '' ? C.purple : C.muted } }}
                  />
                </Box>
              )
            })()}

            <TextField label={t('validUntil')} type="date" size="small"
              value={validTo} onChange={e => setValidTo(e.target.value)}
              sx={inputSx} InputLabelProps={{ shrink: true }} />
          </>
        )}

        {/* Extend mode */}
        {mode === 'extend' && plan && (
          <TextField label={t('extendTo')} type="date" size="small"
            value={extendTo} onChange={e => setExtendTo(e.target.value)}
            sx={inputSx} InputLabelProps={{ shrink: true }} />
        )}

        {/* Adjust credits */}
        {mode === 'adjust' && plan && plan.plan_type !== 'unlimited' && (
          <>
            <TextField label={t('newCreditsUsed')} type="number" size="small"
              value={credUsed} onChange={e => setCredUsed(e.target.value)}
              inputProps={{ min: 0, max: plan.credits_total || 99 }}
              sx={inputSx} />
            <Typography sx={{ fontSize: '12px', color: C.muted }}>
              {t('creditsLeft')}: {Math.max(0, plan.credits_total - Number(credUsed))}
            </Typography>
          </>
        )}
        {/* Module access */}
        {client && (
          <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1 }}>
              {t('editModules')}
            </Typography>
            <ClientModuleEditor clientId={client.id} currentModules={client.modules} t={t} lang="bg" />
          </Box>
        )}

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || (mode === 'activate' && !planType && !paidChanged)}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {saving ? <CircularProgress size={16} /> : t('saveBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Client Info Dialog (popup) ─────────────────────────────────
function ClientInfoDialog({ open, onClose, client, plan, allClientPlans, workouts, t }) {
  const history = (allClientPlans || []).filter(p => p.id !== plan?.id)
  const [upcomingBookings, setUpcomingBookings] = useState([])

  useEffect(() => {
    if (open && client?.id) {
      DB.getClientUpcomingBookings(client.id).then(data => {
        // Filter out bookings where slot join returned null (past dates filtered server-side)
        setUpcomingBookings((data || []).filter(b => b.slots))
      })
    } else {
      setUpcomingBookings([])
    }
  }, [open, client?.id])

  const infoRow = (label, value, color) => (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
      <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>{label}</Typography>
      <Typography sx={{ fontSize: '12px', color: color || C.text, fontWeight: 700 }}>{value}</Typography>
    </Box>
  )

  if (!client) return null
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}`, maxHeight: '85vh' } }}>
      <DialogTitle sx={{ fontWeight: 800, color: C.text, pb: 0.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Box sx={{
          width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
          background: plan ? C.primaryContainer : 'rgba(248,113,113,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '15px', fontWeight: 800, color: plan ? C.purple : '#F87171',
        }}>
          {client.name.charAt(0).toUpperCase()}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: '16px' }}>{client.name}</Typography>
          {client.email && <Typography sx={{ fontSize: '11px', color: C.muted }}>{client.email}</Typography>}
        </Box>
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>

        {/* ── Current plan ── */}
        <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.purple, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 1 }}>
            {t('planDetailsLbl')}
          </Typography>
          {plan ? (
            <>
              {infoRow(t('planTypeLbl'), `${planLabel(plan.plan_type, t)}${plan.plan_type !== 'unlimited' ? ` · ${creditsRemaining(plan)}/${plan.credits_total}` : ''}`)}
              {infoRow(t('validFromLbl'), `${plan.valid_from || '—'} — ${plan.extended_to || plan.valid_to || '—'}`)}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.5 }}>
                <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600 }}>{t('priceLbl')}</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: '12px', color: C.text, fontWeight: 700 }}>{plan.price ? `${plan.price} EUR` : t('freeLbl')}</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25, borderRadius: '100px',
                    background: plan.is_paid ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
                    border: `1px solid ${plan.is_paid ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}` }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', background: plan.is_paid ? C.primary : '#F87171' }} />
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: plan.is_paid ? C.primary : '#F87171' }}>
                      {plan.is_paid ? t('paidLbl') : t('unpaidLbl')}
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </>
          ) : (
            <Typography sx={{ fontSize: '12px', color: '#F87171', fontWeight: 700 }}>{t('hasNoPlan')}</Typography>
          )}
        </Box>

        {/* ── Workouts & booked sessions — always shown ── */}
        {(() => {
          const toIso = d => { if (!d) return ''; if (d[4] === '-') return d; const p = d.split('.'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : d }
          const todayIso = new Date().toISOString().slice(0, 10)
          const upcoming = workouts.filter(w => toIso(w.date) > todayIso)
          const past = workouts.filter(w => toIso(w.date) <= todayIso)
          return (
            <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.primary, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
                {t('bookedSessionsLbl')} / {t('upcomingWorkoutsLbl')}
              </Typography>
              {upcomingBookings.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: (upcoming.length || past.length) ? 1 : 0 }}>
                  {upcomingBookings.map((b, i) => (
                    <Chip key={b.id || i}
                      label={`${b.slots.date} ${b.slots.start_time?.slice(0,5) || ''}${b.slots.coach_name ? ' · ' + b.slots.coach_name : ''}`}
                      size="small"
                      sx={{ fontSize: '11px', fontWeight: 600, height: 24, background: 'rgba(74,222,128,0.1)', color: C.primary, border: `1px solid rgba(74,222,128,0.2)` }} />
                  ))}
                </Box>
              ) : (
                !upcoming.length && <Typography sx={{ fontSize: '11px', color: C.muted, mb: past.length ? 1 : 0 }}>{t('noUpcomingSessions') || 'Няма предстоящи'}</Typography>
              )}
              {upcoming.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: past.length ? 1 : 0 }}>
                  {upcoming.map((w, i) => (
                    <Chip key={w.id || i} label={`${w.date}${w.category ? ' · ' + t(w.category) : ''}`} size="small"
                      sx={{ fontSize: '11px', fontWeight: 600, height: 24, background: 'rgba(170,169,205,0.1)', color: C.purple, border: `1px solid rgba(170,169,205,0.2)` }} />
                  ))}
                </Box>
              )}

              <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75, mt: 1 }}>
                {t('workoutHistory')} ({past.length})
              </Typography>
              {past.length > 0 ? (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                  {past.slice(0, 30).map((w, i) => (
                    <Chip key={w.id || i} label={w.date} size="small"
                      sx={{ fontSize: '10px', fontWeight: 600, height: 22, background: 'rgba(255,255,255,0.06)', color: C.muted }} />
                  ))}
                  {past.length > 30 && (
                    <Chip label={`+${past.length - 30}`} size="small"
                      sx={{ fontSize: '10px', fontWeight: 600, height: 22, background: 'rgba(255,255,255,0.04)', color: C.muted }} />
                  )}
                </Box>
              ) : (
                <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('noWorkoutsYet') || 'Няма записани тренировки'}</Typography>
              )}
            </Box>
          )
        })()}

        {/* ── Plan history (compact) — always shown ── */}
        <Box sx={{ p: 1.5, borderRadius: '14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: '10px', fontWeight: 800, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
            {t('planHistoryLbl')}
          </Typography>
          {history.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {history.map((h, i) => (
                <Box key={h.id || i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: h.is_paid ? 'rgba(74,222,128,0.6)' : 'rgba(248,113,113,0.6)' }} />
                  <Typography sx={{ fontSize: '12px', color: C.text, fontWeight: 600 }}>
                    {planLabel(h.plan_type, t)} {h.valid_from || '?'} — {h.extended_to || h.valid_to || '?'}
                  </Typography>
                  {h.price > 0 && <Typography sx={{ fontSize: '11px', color: C.muted, ml: 'auto' }}>{h.price} EUR</Typography>}
                </Box>
              ))}
            </Box>
          ) : (
            <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('noPlanHistory')}</Typography>
          )}
        </Box>

      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn') || 'Затвори'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Client Plan Row (compact) ─────────────────────────────────
function ClientPlanRow({ client, plan, onOpen, onManage, onDelete, t, lang }) {
  const active   = isPlanActive(plan)
  const credits  = plan ? creditsRemaining(plan) : null
  const isLow    = plan && plan.plan_type !== 'unlimited' && credits !== null && credits <= 2
  const isPaid   = plan?.is_paid

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.25, py: 1, px: 1.5,
      borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' },
      cursor: 'pointer', '&:hover': { background: 'rgba(255,255,255,0.02)' },
      transition: 'background 0.15s',
    }} onClick={onOpen}>
      {/* Avatar */}
      <Box sx={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        background: active ? C.primaryContainer : 'rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '13px', fontWeight: 800, color: active ? C.purple : C.muted,
      }}>
        {client.name.charAt(0).toUpperCase()}
      </Box>

      {/* Name */}
      <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.text, flex: 1, minWidth: 0,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {client.name}
      </Typography>

      {/* Plan info: credits remaining */}
      {plan ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexShrink: 0 }}>
          {plan.plan_type !== 'unlimited' ? (
            <Typography sx={{ fontSize: '12px', fontWeight: 800,
              color: isLow ? '#FB923C' : C.purple }}>
              {credits}
            </Typography>
          ) : (
            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.text }}>
              ∞
            </Typography>
          )}
          <Tooltip title={isPaid ? t('markedPaid') : t('markedUnpaid')} arrow>
            <Box sx={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: isPaid ? C.primary : '#F87171',
            }} />
          </Tooltip>
        </Box>
      ) : (
        <Typography sx={{ fontSize: '10px', color: '#F87171', fontWeight: 700, flexShrink: 0 }}>—</Typography>
      )}

      {/* Actions */}
      <Box sx={{ display: 'flex', gap: 0.25, flexShrink: 0 }}>
        <IconButton size="small" onClick={e => { e.stopPropagation(); onManage(client, plan) }}
          sx={{ color: C.muted, '&:hover': { color: C.purple } }}>
          <EditIcon sx={{ fontSize: 14 }} />
        </IconButton>
        {onDelete && (
          <IconButton size="small" onClick={e => { e.stopPropagation(); onDelete(client) }}
            sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 14 }} />
          </IconButton>
        )}
      </Box>
    </Box>
  )
}

// ── Admin Schedule Tab ───────────────────────────────────────
function AdminScheduleTab({ t, lang }) {
  const { coaches, showSnackbar, realClients: rc } = useApp()
  const { slots, slotBookings, loadSlots, loadSlotBookings, createSlot,
    createRecurringSlots, deleteSlot, adminAddToSlot, adminRemoveFromSlot } = useBooking()
  const [showCreate,  setShowCreate]  = useState(false)
  const [addTarget,   setAddTarget]   = useState(null)
  const [removeTarget, setRemoveTarget] = useState(null) // { slotId, clientId, name }
  const [loaded,      setLoaded]      = useState(false)
  const [rangeStart,  setRangeStart]  = useState(isoToday())
  const [rangeEnd,    setRangeEnd]    = useState(isoDatePlusDays(13))

  useEffect(() => {
    async function load() {
      const data = await loadSlots(rangeStart, rangeEnd)
      if (data.length) await loadSlotBookings(data.map(s => s.id))
      setLoaded(true)
    }
    load()
  }, [rangeStart, rangeEnd])

  async function handleSave(data) {
    if (data.mode === 'single') {
      const res = await createSlot(data)
      if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
      showSnackbar(t('slotSavedMsg'))
      return {}
    } else {
      const res = await createRecurringSlots(data)
      if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
      showSnackbar(`${t('slotsCreatedMsg')}: ${res.created}`)
      return res
    }
  }

  async function handleDelete(slotId) {
    const res = await deleteSlot(slotId)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return }
    showSnackbar(t('slotDeletedMsg'))
  }

  async function handleAddClient(slotId, clientId, clientName, useCredit) {
    const res = await adminAddToSlot(slotId, clientId, clientName, useCredit)
    if (!res?.error) {
      showSnackbar(`${clientName} записан`)
      await loadSlotBookings([slotId])
    }
    return res
  }

  async function handleRemove(slotId, clientId, returnCredit) {
    const res = await adminRemoveFromSlot(slotId, clientId, returnCredit)
    if (!res?.error) {
      showSnackbar(returnCredit ? 'Отменено — кредитът е върнат' : 'Отменено — кредитът е изгорен')
      await loadSlotBookings([slotId])
    }
    setRemoveTarget(null)
  }

  const grouped = groupByDate(slots)
  const dates   = Object.keys(grouped).sort()

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowCreate(true)}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {t('createSlotBtn')}
        </Button>
      </Box>

      {/* Date range */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <TextField label={t('dateFrom')} type="date" size="small" value={rangeStart}
          onChange={e => setRangeStart(e.target.value)}
          sx={{ '& .MuiInputBase-input': { color: C.text }, '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border }, '& .MuiInputLabel-root': { color: C.muted }, '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' } }}
          InputLabelProps={{ shrink: true }} />
        <TextField label={t('dateTo')} type="date" size="small" value={rangeEnd}
          onChange={e => setRangeEnd(e.target.value)}
          sx={{ '& .MuiInputBase-input': { color: C.text }, '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border }, '& .MuiInputLabel-root': { color: C.muted }, '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' } }}
          InputLabelProps={{ shrink: true }} />
      </Box>

      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: C.primary }} />
        </Box>
      ) : dates.length === 0 ? (
        <Typography sx={{ color: C.muted, textAlign: 'center', py: 4 }}>{t('slotsEmpty')}</Typography>
      ) : (
        dates.map(date => (
          <Box key={date} sx={{ mb: 3 }}>
            <Typography sx={{ fontWeight: 800, fontSize: '14px', color: date === isoToday() ? C.purple : C.text,
              mb: 1, pl: 1, borderLeft: `3px solid ${date === isoToday() ? C.primary : C.border}` }}>
              {dayLabel(date, lang)} · {date}
            </Typography>
            {grouped[date].map(slot => {
              const bookings = slotBookings[slot.id] || []
              const isFull   = (slot.booked_count || 0) >= slot.capacity
              return (
                <Paper key={slot.id} sx={{ mb: 1.5, borderRadius: '14px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                  {/* Slot row */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5 }}>
                    <Box sx={{ minWidth: 60 }}>
                      <Typography sx={{ fontWeight: 800, fontSize: '14px', color: C.text }}>{fmtTime(slot.start_time)}</Typography>
                      <Typography sx={{ fontSize: '11px', color: C.muted }}>{fmtTime(slot.end_time)}</Typography>
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '13px', color: C.text }}>{slot.coach_name}</Typography>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.25 }}>
                        <Chip label={`${occupancyStr(slot.booked_count || 0, slot.capacity)}`} size="small"
                          sx={{ fontSize: '10px', height: 18, background: isFull ? 'rgba(248,113,113,0.12)' : C.accentSoft,
                            color: isFull ? '#F87171' : C.purple }} />
                        {slot.notes && <Typography sx={{ fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>{slot.notes}</Typography>}
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <Tooltip title={t('addClientToSlot')} arrow>
                        <IconButton size="small" onClick={() => setAddTarget(slot)}
                          sx={{ color: C.muted, '&:hover': { color: C.purple } }}>
                          <PersonAddIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('deleteSlotBtn')} arrow>
                        <IconButton size="small" onClick={() => handleDelete(slot.id)}
                          sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
                          <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </Box>
                  {/* Clients list */}
                  {bookings.length > 0 && (
                    <Box sx={{ borderTop: `1px solid ${C.border}`, px: 2, py: 1 }}>
                      {bookings.map(b => (
                        <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.4 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box sx={{ width: 22, height: 22, borderRadius: '50%', background: C.primaryContainer,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 800, color: C.text }}>
                              {b.client_name.charAt(0).toUpperCase()}
                            </Box>
                            <Typography sx={{ fontSize: '13px', color: C.text }}>{b.client_name}</Typography>
                          </Box>
                          <Tooltip title={t('removeFromSlot')} arrow>
                            <IconButton size="small"
                              onClick={() => setRemoveTarget({ slotId: slot.id, clientId: b.client_id, name: b.client_name, time: `${slot.slot_date} ${slot.start_time?.slice(0,5)}` })}
                              sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
                              <PersonRemoveIcon sx={{ fontSize: 13 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      ))}
                    </Box>
                  )}
                </Paper>
              )
            })}
          </Box>
        ))
      )}

      {/* Dialogs */}
      {showCreate && (
        <SlotDialog open={showCreate} onClose={() => setShowCreate(false)} onSave={handleSave} coaches={coaches} t={t} />
      )}
      {addTarget && (
        <AddClientDialog open={!!addTarget} onClose={() => setAddTarget(null)} onAdd={handleAddClient}
          slot={addTarget} realClients={rc} t={t} />
      )}

      {/* Admin remove — credit choice dialog */}
      <Dialog open={!!removeTarget} onClose={() => setRemoveTarget(null)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { background: '#1e1e2e', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '20px' } }}>
        <DialogTitle sx={{ fontWeight: 800, fontSize: '15px' }}>
          Отмяна на час
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', mb: 0.5 }}>
            <strong>{removeTarget?.name}</strong> · {removeTarget?.time}
          </Typography>
          <Typography sx={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            Какво да стане с кредита?
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1, flexDirection: 'column', alignItems: 'stretch' }}>
          <Button variant="contained" fullWidth
            onClick={() => handleRemove(removeTarget.slotId, removeTarget.clientId, true)}
            sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
            Върни кредита
          </Button>
          <Button variant="outlined" fullWidth
            onClick={() => handleRemove(removeTarget.slotId, removeTarget.clientId, false)}
            sx={{ borderColor: '#F87171', color: '#F87171', fontWeight: 700,
              '&:hover': { background: 'rgba(248,113,113,0.08)', borderColor: '#F87171' } }}>
            Изгори кредита
          </Button>
          <Button fullWidth onClick={() => setRemoveTarget(null)} sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Откажи
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function AddClientDialog({ open, onClose, onAdd, slot, realClients, t }) {
  const [selId, setSelId] = useState('')
  const [useCredit, setUseCredit] = useState(true)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  async function handleAdd() {
    if (!selId) return
    setLoading(true); setErr('')
    const client = realClients.find(c => c.id === selId)
    const res = await onAdd(slot.id, selId, client.name, useCredit)
    setLoading(false)
    if (res?.error) { setErr(res.error); return }
    onClose(); setSelId(''); setUseCredit(true)
  }
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text }}>{t('addToSlotTitle')}</DialogTitle>
      <DialogContent>
        {slot && <Typography sx={{ fontSize: '12px', color: C.muted, mb: 1 }}>{slot.slot_date} · {fmtTime(slot.start_time)}</Typography>}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel sx={{ color: C.muted }}>{t('selectClientLbl')}</InputLabel>
          <Select value={selId} onChange={e => setSelId(e.target.value)} label={t('selectClientLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {realClients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input type="checkbox" id="uc2" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} />
          <label htmlFor="uc2" style={{ fontSize: '13px', color: C.muted, cursor: 'pointer' }}>{t('useCredit')}</label>
        </Box>
        {err && <Typography sx={{ fontSize: '12px', color: '#F87171', mt: 1 }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={handleAdd} disabled={!selId || loading}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {loading ? <CircularProgress size={16} /> : t('addClientToSlot')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Broadcast Email Dialog ────────────────────────────────────
function BroadcastDialog({ open, onClose, clients, allPlans, t, singleClient }) {
  const [target,   setTarget]   = useState(singleClient ? 'single' : 'free')
  const [subject,  setSubject]  = useState('')
  const [message,  setMessage]  = useState('')
  const [sending,  setSending]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [progress, setProgress] = useState(0)

  function isFreeClient(c) {
    const mods = c.modules || []
    return mods.length > 0 &&
      !['studio_access', 'program_access', 'booking_access'].some(m => mods.includes(m)) &&
      !allPlans.find(p => p.client_id === c.id && p.status === 'active')
  }

  const recipients = (() => {
    if (singleClient) return singleClient.email ? [singleClient] : []
    const base = clients.filter(c => c.email)
    if (target === 'all')  return base
    if (target === 'free') return base.filter(isFreeClient)
    if (target === 'paid') return base.filter(c => allPlans.find(p => p.client_id === c.id && p.status === 'active'))
    return []
  })()

  async function handleSend() {
    if (!subject.trim() || !message.trim() || recipients.length === 0) return
    setSending(true)
    setProgress(0)
    const html = buildBroadcastHtml(message)
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i]
      await DB.syncToMailerLite('send_email', r.email, r.name, {}, subject.trim(), html)
      setProgress(Math.round(((i + 1) / recipients.length) * 100))
    }
    setSending(false)
    setSent(true)
  }

  function handleClose() {
    setTarget(singleClient ? 'single' : 'free')
    setSubject(''); setMessage(''); setSending(false); setSent(false); setProgress(0)
    onClose()
  }

  const inputSx = {
    '& .MuiInputBase-input':               { color: '#e0e0e0' },
    '& .MuiOutlinedInput-notchedOutline':  { borderColor: 'rgba(255,255,255,0.15)' },
    '& .MuiInputLabel-root':               { color: 'rgba(255,255,255,0.4)' },
    '& .MuiInputBase-input::-webkit-scrollbar': { width: '4px' },
  }

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.1)' } }}>
      <DialogTitle sx={{ fontWeight: 700, color: '#e0e0e0', display: 'flex', alignItems: 'center', gap: 1 }}>
        <EmailIcon sx={{ fontSize: 20, color: '#c4e9bf' }} />
        {t('broadcastTitle')}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '8px !important' }}>

        {/* Target selector — only show when not single */}
        {!singleClient && (
          <FormControl component="fieldset">
            <FormLabel sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', mb: 0.5 }}>
              {t('broadcastTargetLbl')}
            </FormLabel>
            <RadioGroup row value={target} onChange={e => setTarget(e.target.value)}>
              {[
                { val: 'all',  label: t('broadcastTargetAll') },
                { val: 'free', label: t('broadcastTargetFree') },
                { val: 'paid', label: t('broadcastTargetPaid') },
              ].map(({ val, label }) => (
                <FormControlLabel key={val} value={val} control={<Radio size="small" sx={{ color: 'rgba(255,255,255,0.4)', '&.Mui-checked': { color: '#c4e9bf' } }} />}
                  label={<Typography sx={{ fontSize: '13px', color: '#ccc' }}>{label}</Typography>} />
              ))}
            </RadioGroup>
          </FormControl>
        )}

        {/* Recipient count */}
        <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', mt: -1.5 }}>
          {t('broadcastTargetLbl')}: {recipients.length} {recipients.length === 1 ? 'клиент' : 'клиента'}{recipients.length < (singleClient ? 1 : clients.filter(c => c.email).length) && ` (${clients.filter(c => c.email).length - recipients.length} нямат имейл)`}
        </Typography>

        <TextField label={t('broadcastSubject')} size="small" fullWidth
          value={subject} onChange={e => setSubject(e.target.value)} sx={inputSx} />

        <TextField label={t('broadcastMessage')} size="small" fullWidth multiline rows={6}
          value={message} onChange={e => setMessage(e.target.value)} sx={inputSx} />

        {/* Progress bar during send */}
        {sending && (
          <Box>
            <LinearProgress variant="determinate" value={progress}
              sx={{ borderRadius: '4px', height: '6px', backgroundColor: 'rgba(196,233,191,0.15)',
                '& .MuiLinearProgress-bar': { backgroundColor: '#c4e9bf' } }} />
            <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', mt: 0.5 }}>
              {t('broadcastSending')} {progress}%
            </Typography>
          </Box>
        )}

        {sent && (
          <Alert severity="success" sx={{ borderRadius: '10px', background: 'rgba(196,233,191,0.1)', color: '#c4e9bf' }}>
            {t('broadcastSent')}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
        <Button onClick={handleClose} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          {sent ? 'Затвори' : 'Откажи'}
        </Button>
        {!sent && (
          <Button variant="contained" onClick={handleSend}
            disabled={sending || !subject.trim() || !message.trim() || recipients.length === 0}
            sx={{ background: '#c4e9bf', color: '#0f1c11', fontWeight: 700,
              '&:disabled': { background: 'rgba(196,233,191,0.2)', color: 'rgba(255,255,255,0.3)' } }}>
            {sending ? <CircularProgress size={16} sx={{ color: '#0f1c11' }} /> : t('broadcastSendBtn')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// ── Plans Tab ────────────────────────────────────────────────
function PlansTab({ t }) {
  const { realClients, showSnackbar } = useApp()
  const { allPlans, loadAllPlans, activatePlan, extendPlan, adjustCredits } = useBooking()
  const [search,      setSearch]      = useState('')
  const [planDlg,     setPlanDlg]     = useState(null) // { client, plan }
  const [loaded,      setLoaded]      = useState(false)
  const [infoDlg,     setInfoDlg]     = useState(null)

  useEffect(() => {
    loadAllPlans().then(() => setLoaded(true))
  }, [])

  function getClientPlan(clientId) {
    return allPlans.find(p => p.client_id === clientId && p.status === 'active') || null
  }

  async function handleActivate(clientId, planType, from, price, startCredits, isPaid, validTo) {
    const res = await activatePlan(clientId, planType, from, price, startCredits, isPaid, validTo)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('planActivatedMsg'))
    return { ok: true }
  }
  async function handleExtend(planId, date) {
    const res = await extendPlan(planId, date)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('planExtendedMsg'))
    return { ok: true }
  }
  async function handleAdjust(planId, credits) {
    const res = await adjustCredits(planId, credits)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('creditsAdjustedMsg'))
    return { ok: true }
  }
  async function handleTogglePaid(planId, newValue) {
    await DB.update('client_plans', planId, { is_paid: newValue })
    await loadAllPlans()
  }

  const filtered = realClients.filter(c =>
    !search || c.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <Box>
      <TextField size="small" placeholder={t('searchClientPh')} value={search}
        onChange={e => setSearch(e.target.value)} fullWidth sx={{ mb: 2,
          '& .MuiInputBase-input': { color: C.text },
          '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border } }} />

      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: C.primary }} />
        </Box>
      ) : (
        <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <Typography sx={{ color: C.muted, p: 3, textAlign: 'center' }}>Няма клиенти</Typography>
          ) : (
            filtered.map(client => {
              const plan = getClientPlan(client.id)
              return (
                <ClientPlanRow key={client.id} client={client} plan={plan} t={t}
                  onOpen={() => setInfoDlg({ client, plan, allClientPlans: allPlans.filter(p => p.client_id === client.id), workouts: client.workouts || [] })}
                  onManage={(c, p) => setPlanDlg({ client: c, plan: p })}
                  />
              )
            })
          )}
        </Paper>
      )}

      {infoDlg && (
        <ClientInfoDialog open={!!infoDlg} onClose={() => setInfoDlg(null)}
          client={infoDlg.client} plan={infoDlg.plan}
          allClientPlans={infoDlg.allClientPlans} workouts={infoDlg.workouts} t={t} />
      )}

      {planDlg && (
        <PlanDialog
          open={!!planDlg}
          onClose={() => setPlanDlg(null)}
          onActivate={handleActivate}
          onExtend={handleExtend}
          onAdjust={handleAdjust}
          onTogglePaid={handleTogglePaid}
          client={planDlg.client}
          plan={planDlg.plan}
          t={t}
        />
      )}
    </Box>
  )
}

// ── Clients Tab ──────────────────────────────────────────────
// ── Client Module Editor ──────────────────────────────────────
function ClientModuleEditor({ clientId, currentModules, t, lang }) {
  const { updateClientModules, showSnackbar, clients } = useApp()
  // Always read fresh from context so stale planDlg snapshot doesn't matter
  const liveModules = clients.find(c => c.id === clientId)?.modules || currentModules || []
  const [modules, setModules] = useState(liveModules)
  const [open, setOpen] = useState(false)

  function toggleModule(key) {
    setModules(prev => prev.includes(key) ? prev.filter(m => m !== key) : [...prev, key])
  }
  function applyPreset(key) { setModules([...MODULE_PRESETS[key]]) }

  async function handleSave() {
    await updateClientModules(clientId, modules)
    showSnackbar(t('modulesSavedMsg'))
    setOpen(false)
  }

  return (
    <>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
        {liveModules.length > 0 ? liveModules.map(m => (
          <Chip key={m} label={MODULE_DEFS[m]?.[lang === 'bg' ? 'labelBg' : 'labelEn'] || m}
            size="small"
            sx={{ fontSize: '9px', height: '20px', background: C.primaryContainer, color: C.text }} />
        )) : (
          <Chip label={t('noModules')} size="small" variant="outlined"
            sx={{ fontSize: '9px', height: '20px', borderColor: C.border, color: C.muted }} />
        )}
        <IconButton size="small" onClick={() => { setModules(liveModules); setOpen(true) }}
          sx={{ width: 20, height: 20 }}>
          <EditIcon sx={{ fontSize: 12, color: C.muted }} />
        </IconButton>
      </Box>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth
        PaperProps={{ sx: { background: C.card, border: `1px solid ${C.border}`, borderRadius: '20px' } }}>
        <DialogTitle sx={{ color: C.text, fontWeight: 700 }}>{t('editModules')}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
            {Object.entries(MODULE_PRESETS).map(([key]) => (
              <Button key={key} size="small" variant="outlined" onClick={() => applyPreset(key)}
                sx={{ fontSize: '11px', textTransform: 'none', borderColor: C.border, color: C.text,
                  '&:hover': { borderColor: C.purple, color: C.purple } }}>
                {t(`preset_${key}`)}
              </Button>
            ))}
            <Button size="small" variant="outlined" onClick={() => setModules([])}
              sx={{ fontSize: '11px', textTransform: 'none', color: '#F87171', borderColor: 'rgba(248,113,113,0.4)' }}>
              {t('clearAll')}
            </Button>
          </Box>
          {ADMIN_MANAGEABLE_MODULES.map(key => {
            const def = MODULE_DEFS[key]
            if (!def) return null
            return (
              <Box key={key} sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                py: 0.75, borderBottom: `1px solid ${C.border}`,
              }}>
                <Typography sx={{ fontSize: '13px', color: C.text }}>
                  {lang === 'bg' ? def.labelBg : def.labelEn}
                </Typography>
                <Switch size="small" checked={modules.includes(key)}
                  onChange={() => toggleModule(key)}
                  sx={{ '& .MuiSwitch-switchBase.Mui-checked': { color: C.primary },
                    '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: C.primary } }} />
              </Box>
            )
          })}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
          <Button variant="contained" onClick={handleSave}
            sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
            {t('saveBtn')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

function ClientsTab({ t }) {
  const { realClients, showSnackbar, lang, setConfirmDelete } = useApp()
  const { allPlans, loadAllPlans, activatePlan, extendPlan, adjustCredits, deactivatePlan } = useBooking()
  const [planDlg, setPlanDlg]   = useState(null)
  const [loaded, setLoaded]     = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [infoDlg, setInfoDlg] = useState(null) // { client, plan, allClientPlans, workouts }

  useEffect(() => { loadAllPlans().then(() => setLoaded(true)) }, [])

  function getClientPlan(clientId) {
    return allPlans.find(p => p.client_id === clientId && p.status === 'active') || null
  }

  const searchMatch = (c) => !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase())

  const isFreeRegistered = c => {
    const mods = c.modules || []
    return mods.length > 0 &&
      !mods.includes('studio_access') && !mods.includes('program_access') && !mods.includes('booking_access') &&
      !getClientPlan(c.id)
  }
  const pending  = realClients.filter(c => {
    if (!searchMatch(c)) return false
    const p = getClientPlan(c.id)
    if (!p) return (c.modules || []).includes('studio_access') || isFreeRegistered(c)
    return !isPlanActive(p)
  })
  const active   = realClients.filter(c => {
    if (!searchMatch(c)) return false
    const p = getClientPlan(c.id)
    return p && isPlanActive(p)
  })

  async function handleActivate(clientId, planType, from, price, startCredits, isPaid, validTo) {
    const res = await activatePlan(clientId, planType, from, price, startCredits, isPaid, validTo)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('planActivatedMsg'))
    return { ok: true }
  }

  async function handleDeactivate(planId) {
    const res = await deactivatePlan(planId)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return }
    showSnackbar(t('deactivatePlanMsg'))
  }

  async function handleTogglePaid(planId, newValue) {
    await DB.update('client_plans', planId, { is_paid: newValue })
    await loadAllPlans()
    showSnackbar(newValue ? t('markedPaid') : t('markedUnpaid'))
  }

  function handleDelete(client) {
    setConfirmDelete({ id: client.id, name: client.name })
  }

  return (
    <Box>
      {realClients.length > 5 && (
        <TextField
          fullWidth size="small"
          placeholder={t('searchClientPh')}
          value={clientSearch}
          onChange={e => setClientSearch(e.target.value)}
          sx={{ mb: 2,
            '& .MuiInputBase-input': { fontSize: '13px', py: '8px' },
            '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border },
          }}
        />
      )}
      {/* Pending activation (studio clients without plan) */}
      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#F87171', mb: 1 }}>
        {t('pendingActivation')} ({pending.length})
      </Typography>
      {pending.length === 0 ? (
        <Typography sx={{ color: C.muted, fontSize: '13px', mb: 3 }}>{t('noPendingClients')}</Typography>
      ) : (
        <Paper sx={{ borderRadius: '16px', border: `1px solid rgba(248,113,113,0.3)`, overflow: 'hidden', mb: 3 }}>
          {pending.map(client => {
            const expiredPlan = getClientPlan(client.id)
            return (
              <ClientPlanRow key={client.id} client={client} plan={expiredPlan}
                onOpen={() => setInfoDlg({ client, plan: expiredPlan, allClientPlans: allPlans.filter(p => p.client_id === client.id), workouts: client.workouts || [] })}
                t={t} lang={lang}
                onManage={(c, p) => setPlanDlg({ client: c, plan: p })}
                onDelete={handleDelete} />
            )
          })}
        </Paper>
      )}

      {/* Active clients */}
      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, mb: 1 }}>
        {t('allClientsLbl')} ({realClients.length})
      </Typography>
      <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {active.map(client => {
          const plan = getClientPlan(client.id)
          return (
            <ClientPlanRow key={client.id} client={client} plan={plan}
              onOpen={() => setInfoDlg({ client, plan, allClientPlans: allPlans.filter(p => p.client_id === client.id), workouts: client.workouts || [] })}
              t={t} lang={lang}
              onManage={(c, p) => setPlanDlg({ client: c, plan: p })}
              onDelete={handleDelete} />
          )
        })}
      </Paper>

      {/* Client info popup */}
      {infoDlg && (
        <ClientInfoDialog open={!!infoDlg} onClose={() => setInfoDlg(null)}
          client={infoDlg.client} plan={infoDlg.plan}
          allClientPlans={infoDlg.allClientPlans} workouts={infoDlg.workouts} t={t} />
      )}

      {planDlg && (
        <PlanDialog open={!!planDlg} onClose={() => setPlanDlg(null)}
          onActivate={handleActivate}
          onExtend={async (planId, date) => { const r = await extendPlan(planId, date); if (r?.error) { showSnackbar('Грешка: ' + r.error); return r } showSnackbar(t('planExtendedMsg')); return { ok: true } }}
          onAdjust={async (planId, credits) => { const r = await adjustCredits(planId, credits); if (r?.error) { showSnackbar('Грешка: ' + r.error); return r } showSnackbar(t('creditsAdjustedMsg')); return { ok: true } }}
          onTogglePaid={handleTogglePaid}
          client={planDlg.client} plan={planDlg.plan} t={t} />
      )}
    </Box>
  )
}

// ── Analytics Tab (monthly) ───────────────────────────────────
function AnalyticsTab({ t }) {
  const { allPlans, loadAllPlans } = useBooking()
  const { realClients } = useApp()
  const [expenses,          setExpenses]          = useState([])
  const [programPurchases,  setProgramPurchases]  = useState([])
  const [appEvents,         setAppEvents]         = useState([])
  const [featureDays,       setFeatureDays]       = useState(30)
  const [month, setMonth] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    loadAllPlans()
    DB.selectAll('expenses').then(rows => setExpenses(rows || []))
    DB.selectAll('program_purchases').then(rows => setProgramPurchases(rows || [])).catch(() => {})
    DB.selectAll('app_events', '&select=event,client_id,created_at&order=created_at.desc&limit=100000')
      .catch(() => []).then(rows => setAppEvents(rows || []))
  }, []) // eslint-disable-line

  // Filter by selected month
  const monthStart = `${month}-01`
  const nextMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  })()

  const monthPlans = allPlans.filter(p => {
    if (!p.is_paid) return false
    const d = (p.valid_from || p.created_at || '').slice(0, 10)
    return d >= monthStart && d < nextMonth
  })
  const monthExpenses = expenses.filter(e => {
    const d = (e.created_at || '').slice(0, 10)
    return d >= monthStart && d < nextMonth
  })

  const revenue = monthPlans.reduce((sum, p) => sum + (Number(p.price) || 0), 0)
  const expTotal = monthExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
  const profit = revenue - expTotal

  // ── Extra metrics ──────────────────────────────────────────
  // Online revenue (program_purchases) for month
  const onlineOrders = programPurchases.filter(o => {
    const d = (o.created_at || '').slice(0, 10)
    return d >= monthStart && d < nextMonth &&
      (o.status === 'paid' || o.status === 'complete' || o.status === 'succeeded')
  })
  const onlineRev = onlineOrders.reduce((s, o) => s + (Number(o.amount_total || o.amount || 0) / 100), 0)

  // Conversion rate
  const activePlanIds = new Set(allPlans.filter(p => p.status === 'active').map(p => p.client_id))
  const paidCount  = activePlanIds.size
  const convRate   = realClients.length ? Math.round(paidCount / realClients.length * 100) : 0

  // Active clients last 30 days
  const thirtyAgo = new Date(Date.now() - 30 * 86400000)
  function lastActiveDate(c) {
    const dates = [
      ...(c.meals      || []).map(m => m.date),
      ...(c.weightLogs || []).map(w => w.date),
      ...(c.stepsLogs  || []).map(s => s.date),
      ...(c.workouts   || []).map(w => w.date),
    ].filter(Boolean)
    if (!dates.length) return null
    return dates.sort((a, b) => parseDate(b) - parseDate(a))[0]
  }
  const activeCount = realClients.filter(c => {
    const last = lastActiveDate(c)
    return last && parseDate(last) >= thirtyAgo
  }).length

  // Plan breakdown
  const activePlans    = allPlans.filter(p => p.status === 'active')
  const plan8Count     = activePlans.filter(p => p.plan_type === '8').length
  const plan12Count    = activePlans.filter(p => p.plan_type === '12').length
  const planUCount     = activePlans.filter(p => p.plan_type === 'unlimited').length
  const planTotal      = plan8Count + plan12Count + planUCount || 1

  // ── Feature usage analytics ────────────────────────────────
  const featureCutoff  = new Date(Date.now() - featureDays * 86400000)
  const allRealClients = realClients.filter(c => !c.is_coach)
  const totalClients   = allRealClients.length

  function uniqClients(rows, dateField) {
    return new Set(rows.filter(r => {
      const raw = r[dateField]
      if (!raw) return false
      const d = typeof raw === 'string' && raw.includes('T') ? new Date(raw) : parseDate(raw)
      return d && d >= featureCutoff
    }).map(r => r.client_id)).size
  }

  const allMealsFlat    = allRealClients.flatMap(c => (c.meals     || []).map(m => ({ client_id: c.id, date: m.date })))
  const allWeightsFlat  = allRealClients.flatMap(c => (c.weightLogs|| []).map(w => ({ client_id: c.id, date: w.date })))
  const allStepsFlat    = allRealClients.flatMap(c => (c.stepsLogs || []).map(s => ({ client_id: c.id, date: s.date })))
  const allWorkoutsFlat = allRealClients.flatMap(c => (c.workouts  || []).map(w => ({ client_id: c.id, date: w.date })))

  const featureRows = [
    { key: 'workouts', label: 'Тренировки', color: '#c4e9bf', count: uniqClients(allWorkoutsFlat, 'date') },
    { key: 'food',     label: 'Храна',      color: '#c4e9bf', count: uniqClients(allMealsFlat,    'date') },
    { key: 'weight',   label: 'Тегло',      color: '#c4e9bf', count: uniqClients(allWeightsFlat,  'date') },
    { key: 'steps',    label: 'Крачки',     color: '#c4e9bf', count: uniqClients(allStepsFlat,    'date') },
    { key: 'ranking',  label: 'Класация',   color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'ranking_viewed'),  'created_at') },
    { key: 'feed',     label: 'Стена',      color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'feed_viewed'),     'created_at') },
    { key: 'program',  label: 'Програми',   color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'program_opened'), 'created_at') },
    { key: 'lesson',   label: 'Уроци',      color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'lesson_viewed'),  'created_at') },
    { key: 'recipe',   label: 'Рецепти',    color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'recipe_opened'),  'created_at') },
    { key: 'resource', label: 'Ресурси',    color: '#aaa9cd', count: uniqClients(appEvents.filter(e => e.event === 'resource_opened'),'created_at') },
  ].sort((a, b) => b.count - a.count)

  // Month navigation
  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number)
    setMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
  }
  const nextMonthFn = () => {
    const [y, m] = month.split('-').map(Number)
    setMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const MONTH_NAMES_BG = ['', 'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES_BG[m]} ${y}`

  const bigBox = (label, value, positive) => (
    <Paper sx={{
      p: 2.5, borderRadius: '16px',
      border: `1px solid ${positive ? C.primaryA20 : 'rgba(248,113,113,0.25)'}`,
      background: positive
        ? 'linear-gradient(135deg, rgba(170,169,205,0.08) 0%, rgba(170,169,205,0.03) 100%)'
        : 'linear-gradient(135deg, rgba(248,113,113,0.08) 0%, rgba(248,113,113,0.03) 100%)',
    }}>
      <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.75 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '36px', fontWeight: 800, color: positive ? C.text : '#F87171',
        fontFamily: "'MontBlanc', sans-serif", lineHeight: 1, letterSpacing: '-1px' }}>
        {value} <Typography component="span" sx={{ fontSize: '18px', fontWeight: 600,
          color: positive ? C.text : '#F87171', fontFamily: "'MontBlanc', sans-serif" }}>€</Typography>
      </Typography>
    </Paper>
  )

  const miniStat = (label, value, unit = '') => (
    <Paper sx={{ p: 2, borderRadius: '14px', flex: 1, border: `1px solid ${C.border}`, background: 'rgba(255,255,255,0.02)' }}>
      <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 0.5 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: '22px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif", lineHeight: 1 }}>
        {value}<Typography component="span" sx={{ fontSize: '14px', fontWeight: 600, color: C.muted }}>{unit}</Typography>
      </Typography>
    </Paper>
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {/* Month selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
        <IconButton size="small" onClick={prevMonth} sx={{ color: C.muted }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800 }}>‹</Typography>
        </IconButton>
        <Typography sx={{ fontSize: '16px', fontWeight: 800, color: C.text, minWidth: '160px', textAlign: 'center' }}>
          {monthLabel}
        </Typography>
        <IconButton size="small" onClick={nextMonthFn} sx={{ color: C.muted }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800 }}>›</Typography>
        </IconButton>
      </Box>

      {bigBox(t('totalRevenueLbl'), revenue, true)}
      {bigBox(t('totalExpensesLbl'), expTotal, false)}

      {/* Profit/Loss */}
      <Paper sx={{
        p: 2.5, borderRadius: '16px', textAlign: 'center',
        border: `1px solid ${profit >= 0 ? C.primaryA20 : 'rgba(248,113,113,0.25)'}`,
      }}>
        <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.5 }}>
          {profit >= 0 ? t('profitLbl') : t('lossLbl')}
        </Typography>
        <Typography sx={{ fontSize: '28px', fontWeight: 800, color: profit >= 0 ? C.text : '#F87171',
          fontFamily: "'MontBlanc', sans-serif" }}>
          {profit >= 0 ? '+' : ''}{profit} €
        </Typography>
      </Paper>

      {/* ── Extra metrics ── */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
        {miniStat(t('conversionLbl'), `${convRate}`, '%')}
        {miniStat(t('activeClientsLbl'), activeCount)}
        {miniStat(t('onlineRevenueLbl'), onlineRev.toFixed(0), ' €')}
      </Box>

      {/* Studio vs Online revenue split */}
      {(revenue > 0 || onlineRev > 0) && (
        <Paper sx={{ p: 2, borderRadius: '14px', border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5 }}>
            {t('studioRevenueLbl')} vs {t('onlineRevenueLbl')}
          </Typography>
          {[
            { label: t('studioRevenueLbl'), val: revenue,    color: '#aaa9cd' },
            { label: t('onlineRevenueLbl'), val: onlineRev,  color: '#c4e9bf' },
          ].map(({ label, val, color }) => {
            const total = Math.max(revenue + onlineRev, 1)
            const pct = Math.round(val / total * 100)
            return (
              <Box key={label} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                  <Typography sx={{ fontSize: '12px', color: C.muted }}>{label}</Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color }}>{val.toFixed(0)} € ({pct}%)</Typography>
                </Box>
                <LinearProgress variant="determinate" value={pct}
                  sx={{ borderRadius: '4px', height: '5px', backgroundColor: 'rgba(255,255,255,0.07)',
                    '& .MuiLinearProgress-bar': { backgroundColor: color } }} />
              </Box>
            )
          })}
        </Paper>
      )}

      {/* Feature usage */}
      <Paper sx={{ p: 2, borderRadius: '14px', border: `1px solid ${C.border}`, mt: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
            Използване на функциите
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {[7, 30, 90].map(d => (
              <Box key={d} onClick={() => setFeatureDays(d)} sx={{
                px: 1.5, py: 0.3, borderRadius: '100px', cursor: 'pointer', fontSize: '11px', fontWeight: 700,
                background: featureDays === d ? C.accent : 'transparent',
                color:      featureDays === d ? '#000'   : C.muted,
                border:     `1px solid ${featureDays === d ? C.accent : C.border}`,
                transition: 'all 0.15s',
              }}>{d}д</Box>
            ))}
          </Box>
        </Box>
        {featureRows.map((row, i) => {
          const pct = totalClients ? Math.round(row.count / totalClients * 100) : 0
          return (
            <Box key={row.key} sx={{ mb: i === featureRows.length - 1 ? 0 : 1.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                <Typography sx={{ fontSize: '12px', color: C.text, fontWeight: 600 }}>{row.label}</Typography>
                <Typography sx={{ fontSize: '12px', color: C.muted }}>
                  {row.count} / {totalClients}
                  <Box component="span" sx={{ ml: 0.8, color: row.count > 0 ? row.color : C.muted, fontWeight: 700 }}>
                    {pct}%
                  </Box>
                </Typography>
              </Box>
              <LinearProgress variant="determinate" value={pct}
                sx={{ borderRadius: '4px', height: '5px', backgroundColor: 'rgba(255,255,255,0.07)',
                  '& .MuiLinearProgress-bar': { backgroundColor: row.count > 0 ? row.color : 'rgba(255,255,255,0.12)', borderRadius: '4px' } }} />
            </Box>
          )
        })}
      </Paper>

      {/* Plan breakdown */}
      {activePlans.length > 0 && (
        <Paper sx={{ p: 2, borderRadius: '14px', border: `1px solid ${C.border}` }}>
          <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5 }}>
            {t('planBreakdownLbl')} ({activePlans.length})
          </Typography>
          {[
            { label: '8 тр.', count: plan8Count,  color: '#60A5FA' },
            { label: '12 тр.', count: plan12Count, color: '#aaa9cd' },
            { label: 'Unlimited', count: planUCount, color: '#c4e9bf' },
          ].map(({ label, count, color }) => {
            const pct = Math.round(count / planTotal * 100)
            return (
              <Box key={label} sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.4 }}>
                  <Typography sx={{ fontSize: '12px', color: C.muted }}>{label}</Typography>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color }}>{count} ({pct}%)</Typography>
                </Box>
                <LinearProgress variant="determinate" value={pct}
                  sx={{ borderRadius: '4px', height: '5px', backgroundColor: 'rgba(255,255,255,0.07)',
                    '& .MuiLinearProgress-bar': { backgroundColor: color } }} />
              </Box>
            )
          })}
        </Paper>
      )}
    </Box>
  )
}

// ── Expenses Tab ──────────────────────────────────────────────
const EXPENSE_CATEGORIES = [
  'expCategoryTok', 'expCategoryOsig', 'expCategoryToalet', 'expCategoryReklama',
  'expCategoryNaem', 'expCategoryVoda', 'expCategoryIcko', 'expCategoryEli',
  'expCategoryNiki', 'expCategoryVivi', 'expCategorySche',
]

function ExpensesTab({ t }) {
  const { showSnackbar } = useApp()
  const [expenses, setExpenses]   = useState([])
  const [open, setOpen]           = useState(false)
  const [category, setCategory]   = useState('')
  const [amount, setAmount]       = useState('')
  const [saving, setSaving]       = useState(false)

  async function loadExpenses() {
    const rows = await DB.selectAll('expenses')
    setExpenses((rows || []).sort((a, b) => b.created_at?.localeCompare(a.created_at || '') || 0))
  }

  useEffect(() => { loadExpenses() }, [])

  async function handleAdd() {
    if (!category || !amount || Number(amount) <= 0) return
    setSaving(true)
    await DB.insert('expenses', {
      category,
      amount: Number(amount),
      created_at: new Date().toISOString(),
    })
    setSaving(false)
    setOpen(false)
    setCategory('')
    setAmount('')
    loadExpenses()
    showSnackbar?.(t('expenseAddedMsg'))
  }

  async function handleDelete(id) {
    await DB.deleteById('expenses', id)
    loadExpenses()
  }

  const total = expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)

  return (
    <Box>
      {/* Total + Add button */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box>
          <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.9px' }}>
            {t('totalExpensesLbl')}
          </Typography>
          <Typography sx={{ fontSize: '36px', fontWeight: 800, color: '#F87171',
            fontFamily: "'MontBlanc', sans-serif", lineHeight: 1, letterSpacing: '-1px' }}>
            {total} <Typography component="span" sx={{ fontSize: '18px', fontWeight: 600, color: '#F87171' }}>€</Typography>
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />}
          onClick={() => setOpen(true)}
          sx={{ borderRadius: '12px', background: C.primary, color: '#0a0a0a',
            fontWeight: 700, textTransform: 'none', px: 2 }}>
          {t('addExpenseBtn')}
        </Button>
      </Box>

      {/* Expenses list */}
      <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {expenses.length === 0 ? (
          <Typography sx={{ color: C.muted, p: 3, textAlign: 'center' }}>{t('noExpensesLbl')}</Typography>
        ) : expenses.map(exp => (
          <Box key={exp.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.25,
            borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>{exp.category}</Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>
                {exp.created_at ? new Date(exp.created_at).toLocaleDateString('bg-BG') : ''}
              </Typography>
            </Box>
            <Typography sx={{ fontWeight: 700, fontSize: '15px', color: '#F87171',
              fontFamily: "'MontBlanc', sans-serif", minWidth: '64px', textAlign: 'right' }}>
              {exp.amount} €
            </Typography>
            <IconButton size="small" onClick={() => handleDelete(exp.id)}
              sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Paper>

      {/* Add Dialog */}
      <Dialog open={open} onClose={() => setOpen(false)} PaperProps={{
        sx: { background: '#1a1a1a', border: `1px solid ${C.border}`, borderRadius: '20px', minWidth: 320 }
      }}>
        <DialogTitle sx={{ color: C.text, fontWeight: 700 }}>{t('addExpenseBtn')}</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          <FormControl fullWidth size="small">
            <InputLabel sx={{ color: C.muted }}>{t('expenseCategoryLbl')}</InputLabel>
            <Select value={category} onChange={e => setCategory(e.target.value)}
              label={t('expenseCategoryLbl')}
              sx={{ color: C.text, '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
              {EXPENSE_CATEGORIES.map(key => (
                <MenuItem key={key} value={t(key)}>{t(key)}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField label={t('expenseAmountLbl')} type="number" size="small"
            value={amount} onChange={e => setAmount(e.target.value)}
            inputProps={{ min: 0 }}
            sx={{ '& .MuiOutlinedInput-root': { color: C.text, '& fieldset': { borderColor: C.border } },
              '& .MuiInputLabel-root': { color: C.muted } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setOpen(false)} sx={{ color: C.muted, textTransform: 'none' }}>Откажи</Button>
          <Button onClick={handleAdd} disabled={saving || !category || Number(amount) <= 0}
            variant="contained"
            sx={{ background: C.primary, color: '#0a0a0a', fontWeight: 700, textTransform: 'none', borderRadius: '10px' }}>
            {saving ? <CircularProgress size={18} /> : t('addBtn')}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

// ── Coaches Tab ───────────────────────────────────────────────
function CoachesTab({ t }) {
  const { lang, coachProfiles, setViewingCoach, setView } = useApp()
  const now = new Date()
  const [monthOffset, setMonthOffset] = useState(0)
  const [allBookings, setAllBookings] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    DB.getAllCompletedBookings().then(data => { setAllBookings(data || []); setLoaded(true) })
  }, [])

  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1)
  const targetYear = targetDate.getFullYear()
  const targetMonth = targetDate.getMonth()
  const todayIso = now.toISOString().slice(0, 10)

  const monthNames = lang === 'en'
    ? ['January','February','March','April','May','June','July','August','September','October','November','December']
    : ['Януари','Февруари','Март','Април','Май','Юни','Юли','Август','Септември','Октомври','Ноември','Декември']

  const coachStats = useMemo(() => {
    const counts = {}
    allBookings.forEach(b => {
      if (!b.booking_slots) return
      const d = new Date(b.booking_slots.slot_date + 'T00:00:00')
      // Only count past sessions (completed, not future)
      if (b.booking_slots.slot_date > todayIso) return
      if (d.getFullYear() === targetYear && d.getMonth() === targetMonth) {
        const name = b.booking_slots.coach_name || '—'
        counts[name] = (counts[name] || 0) + 1
      }
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
  }, [allBookings, targetYear, targetMonth, todayIso])

  return (
    <Box>
      {/* Month selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2 }}>
        <IconButton size="small" onClick={() => setMonthOffset(m => m - 1)} sx={{ color: C.muted }}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography sx={{ fontWeight: 800, fontSize: '15px', color: C.text, minWidth: 140, textAlign: 'center' }}>
          {monthNames[targetMonth]} {targetYear}
        </Typography>
        <IconButton size="small" onClick={() => setMonthOffset(m => Math.min(m + 1, 0))} disabled={monthOffset >= 0} sx={{ color: C.muted }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {!loaded && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} sx={{ color: C.primary }} /></Box>}
      {loaded && <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {coachStats.length === 0 ? (
          <Typography sx={{ color: C.muted, p: 3, textAlign: 'center' }}>{t('noDataLbl')}</Typography>
        ) : coachStats.map(({ name, count }, i) => (
          <Box key={name} onClick={() => {
            const cp = coachProfiles.find(c => c.name === name)
            if (cp) { setViewingCoach(name); setView('dashboard') }
          }} sx={{ display: 'flex', alignItems: 'center', gap: 1.5,
            px: 2, py: 1.5, cursor: 'pointer',
            borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' },
            '&:hover': { background: 'rgba(170,169,205,0.08)' } }}>
            <Typography sx={{ fontSize: '18px', fontWeight: 800, color: i === 0 ? C.purple : C.muted,
              minWidth: 28, fontFamily: "'MontBlanc', sans-serif" }}>
              #{i + 1}
            </Typography>
            <Box sx={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              background: i === 0 ? C.primaryContainer : 'rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 800, color: i === 0 ? C.purple : C.muted }}>
              {name.charAt(0).toUpperCase()}
            </Box>
            <Typography sx={{ flex: 1, fontWeight: 700, fontSize: '15px', color: C.text }}>{name}</Typography>
            <Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontSize: '22px', fontWeight: 800,
                color: i === 0 ? C.purple : C.text,
                fontFamily: "'MontBlanc', sans-serif", lineHeight: 1 }}>
                {count}
              </Typography>
              <Typography sx={{ fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {t('sessionsLbl') || 'часове'}
              </Typography>
            </Box>
          </Box>
        ))}
      </Paper>}
    </Box>
  )
}

// ── Dashboard Tab ────────────────────────────────────────────
function DashboardTab({ t, lang, goTo }) {
  const { realClients, showSnackbar, setConfirmDelete, updateClientModules } = useApp()
  const { allPlans, loadAllPlans, activatePlan, extendPlan, adjustCredits } = useBooking()
  const [loaded,       setLoaded]       = useState(false)
  const [planDlg,      setPlanDlg]      = useState(null)
  const [broadcastDlg, setBroadcastDlg] = useState(null) // null | 'free' | { singleClient }

  useEffect(() => {
    loadAllPlans().then(() => setLoaded(true))
  }, [])

  function getActivePlan(clientId) {
    return allPlans.find(p => p.client_id === clientId && p.status === 'active') || null
  }

  // ── Lead helpers ──────────────────────────────────────────
  function computeLastActive(c) {
    const dates = [
      ...(c.meals      || []).map(m => m.date),
      ...(c.weightLogs || []).map(w => w.date),
      ...(c.stepsLogs  || []).map(s => s.date),
      ...(c.workouts   || []).map(w => w.date),
    ].filter(Boolean)
    if (!dates.length) return null
    return dates.sort((a, b) => parseDate(b) - parseDate(a))[0]
  }

  const todayMs = Date.now()
  function scoreLead(c) {
    const last = computeLastActive(c)
    if (!last) return 'cold'
    const days = Math.round((todayMs - parseDate(last)) / 86400000)
    if (days <= 7)  return 'hot'
    if (days <= 30) return 'warm'
    return 'cold'
  }

  function daysSinceReg(c) {
    if (!c.created_at) return null
    return Math.round((todayMs - new Date(c.created_at).getTime()) / 86400000)
  }

  async function handleAddPlan(client) {
    // Assign studio modules first, then open plan dialog
    const studioModules = ['studio_access', 'booking_access', 'weight_tracking', 'nutrition_tracking', 'training_plan_access', 'program_access']
    await updateClientModules(client.id, studioModules)
    setPlanDlg({ client: { ...client, modules: studioModules }, plan: null })
  }
  async function handleActivate(clientId, planType, from, price, startCredits, isPaid) {
    const res = await activatePlan(clientId, planType, from, price, startCredits)
    if (res?.error) { showSnackbar(t('errGeneric') + ': ' + res.error); return res }
    if (isPaid && res?.id) await DB.update('client_plans', res.id, { is_paid: true })
    showSnackbar(t('planActivatedMsg'))
    return { ok: true }
  }
  async function handleExtend(planId, date) {
    const res = await extendPlan(planId, date)
    if (res?.error) { showSnackbar(t('errGeneric') + ': ' + res.error); return res }
    showSnackbar(t('planExtendedMsg'))
    return { ok: true }
  }
  async function handleAdjust(planId, credits) {
    const res = await adjustCredits(planId, credits)
    if (res?.error) { showSnackbar(t('errGeneric') + ': ' + res.error); return res }
    showSnackbar(t('creditsAdjustedMsg'))
    return { ok: true }
  }
  async function handleTogglePaid(planId, newValue) {
    await DB.update('client_plans', planId, { is_paid: newValue })
    await loadAllPlans()
  }

  const isFreeReg  = c => {
    const mods = c.modules || []
    return mods.length > 0 &&
      !mods.includes('studio_access') && !mods.includes('program_access') && !mods.includes('booking_access') &&
      !getActivePlan(c.id)
  }
  const newRegs    = realClients.filter(c => !(c.modules || []).length || isFreeReg(c))
  const leads      = newRegs.filter(isFreeReg) // free registered users only (not empty-module ghosts)
  const pending    = realClients.filter(c => !getActivePlan(c.id) && (c.modules || []).includes('studio_access'))
  const expiring   = realClients.filter(c => {
    const p = getActivePlan(c.id)
    if (!p) return false
    const d = daysUntilExpiry(p)
    return d !== null && d >= 0 && d <= 7
  })
  const lowCred    = realClients.filter(c => {
    const p = getActivePlan(c.id)
    if (!p || p.plan_type === 'unlimited') return false
    return creditsRemaining(p) <= 2
  })

  return (
    <Box>
      {/* Summary cards */}
      <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mb: 3 }}>
        {newRegs.length > 0 && <StatCard icon={PersonAddIcon} label={t('newRegistrations')} value={newRegs.length} color="#60A5FA" onClick={() => goTo('clients', 'clients')} />}
        <StatCard icon={PeopleIcon}       label={t('pendingCard')}  value={pending.length}   color="#F87171" onClick={() => goTo('clients', 'clients')} />
        <StatCard icon={WarningAmberIcon} label={t('expiringCard')} value={expiring.length}  color="#FB923C" onClick={() => goTo('clients', 'clients')} />
        <StatCard icon={CreditCardIcon}   label={t('lowCredCard')}  value={lowCred.length}   color="#FBBF24" onClick={() => goTo('clients', 'clients')} />
      </Box>

      {/* New registrations */}
      {newRegs.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#60A5FA', mb: 1 }}>
            {t('newRegistrations')} ({newRegs.length})
          </Typography>
          <Paper sx={{ borderRadius: '14px', border: '1px solid rgba(96,165,250,0.25)', mb: 2, overflow: 'hidden' }}>
            {newRegs.map(c => (
              <Box key={c.id} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5,
                borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text, flex: 1 }}>{c.name}</Typography>
                <Button size="small" variant="contained" onClick={() => handleAddPlan(c)}
                  sx={{ fontSize: '11px', minHeight: 0, py: 0.5, px: 1.5 }}>
                  {lang === 'en' ? '+ Add plan' : '+ Добави план'}
                </Button>
                <Tooltip title={t('deleteClientBtn')} arrow>
                  <IconButton size="small" onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                    sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Paper>
        </>
      )}

      {/* Pending list */}
      {pending.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#F87171', mb: 1 }}>
            {t('pendingActivation')} ({pending.length})
          </Typography>
          <Paper sx={{ borderRadius: '14px', border: `1px solid rgba(248,113,113,0.25)`, mb: 2, overflow: 'hidden' }}>
            {pending.slice(0, 5).map(c => (
              <Box key={c.id} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5,
                borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text, flex: 1 }}>{c.name}</Typography>
                <Typography sx={{ fontSize: '11px', color: '#F87171' }}>{t('noPlanShort')}</Typography>
                <Tooltip title={t('deleteClientBtn')} arrow>
                  <IconButton size="small" onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                    sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
                    <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            ))}
          </Paper>
        </>
      )}

      {/* Expiring plans */}
      {expiring.length > 0 && (
        <>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#FB923C', mb: 1 }}>
            {t('expiringPlans')}
          </Typography>
          <Paper sx={{ borderRadius: '14px', border: `1px solid rgba(251,146,60,0.25)`, mb: 2, overflow: 'hidden' }}>
            {expiring.map(c => {
              const p = getActivePlan(c.id)
              const d = daysUntilExpiry(p)
              return (
                <Box key={c.id} sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5,
                  borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text, flex: 1 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: '11px', color: '#FB923C' }}>{d}д</Typography>
                  <Tooltip title={t('deleteClientBtn')} arrow>
                    <IconButton size="small" onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                      sx={{ color: C.muted, '&:hover': { color: '#F87171' } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
          </Paper>
        </>
      )}

      {/* Leads section */}
      {leads.length > 0 && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LocalFireDepartmentIcon sx={{ fontSize: 16, color: '#FBBF24' }} />
            <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#FBBF24', flex: 1 }}>
              {t('leadsTitle')} ({leads.length})
            </Typography>
            <Tooltip title={t('broadcastBtn')} arrow>
              <IconButton size="small" onClick={() => setBroadcastDlg('free')}
                sx={{ color: '#60A5FA', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '8px',
                  '&:hover': { background: 'rgba(96,165,250,0.1)' } }}>
                <EmailIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Paper sx={{ borderRadius: '14px', border: '1px solid rgba(251,191,36,0.2)', mb: 2, overflow: 'hidden' }}>
            {leads.map(c => {
              const score   = scoreLead(c)
              const lastAct = computeLastActive(c)
              const dReg    = daysSinceReg(c)
              const scoreColor = score === 'hot' ? '#c4e9bf' : score === 'warm' ? '#FBBF24' : 'rgba(255,255,255,0.3)'
              const scoreLabel = score === 'hot' ? t('leadsHot') : score === 'warm' ? t('leadsWarm') : t('leadsCold')
              return (
                <Box key={c.id} sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                  borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '13px', color: C.text, flex: 1, minWidth: 80 }}>{c.name}</Typography>
                  <Chip label={scoreLabel} size="small" sx={{
                    height: '18px', fontSize: '10px', fontWeight: 700,
                    background: `${scoreColor}22`, color: scoreColor, border: `1px solid ${scoreColor}44`,
                  }} />
                  {lastAct && (
                    <Typography sx={{ fontSize: '11px', color: C.muted, display: { xs: 'none', sm: 'block' } }}>
                      {lastAct}
                    </Typography>
                  )}
                  {dReg !== null && (
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>
                      {dReg}{'\u00A0'}{t('leadsDaySince')}
                    </Typography>
                  )}
                  <Tooltip title={t('sendOfferBtn')} arrow>
                    <IconButton size="small" onClick={() => setBroadcastDlg({ singleClient: c })}
                      sx={{ color: '#60A5FA', '&:hover': { color: '#93C5FD' } }}>
                      <EmailIcon sx={{ fontSize: 15 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              )
            })}
          </Paper>
        </>
      )}

      {planDlg && (
        <PlanDialog open={!!planDlg} onClose={() => setPlanDlg(null)}
          onActivate={handleActivate} onExtend={handleExtend}
          onAdjust={handleAdjust} onTogglePaid={handleTogglePaid}
          client={planDlg.client} plan={planDlg.plan} t={t} />
      )}

      {broadcastDlg && (
        <BroadcastDialog
          open
          onClose={() => setBroadcastDlg(null)}
          clients={realClients}
          allPlans={allPlans}
          t={t}
          singleClient={broadcastDlg?.singleClient || null}
        />
      )}
    </Box>
  )
}

// ── Orders Tab (Online purchases) ────────────────────────────
function OrdersTab({ t }) {
  const { realClients } = useApp()
  const [orders,  setOrders]  = useState([])
  const [loaded,  setLoaded]  = useState(false)
  const [month,   setMonth]   = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })

  useEffect(() => {
    DB.selectAll('program_purchases').then(rows => {
      setOrders(rows || [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const monthStart = `${month}-01`
  const nextMonth = (() => {
    const [y, m] = month.split('-').map(Number)
    return m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`
  })()

  const filtered = orders.filter(o => {
    const d = (o.created_at || '').slice(0, 10)
    return d >= monthStart && d < nextMonth
  })

  const totalRev = filtered.filter(o => o.status === 'paid' || o.status === 'complete' || o.status === 'succeeded')
    .reduce((s, o) => s + (Number(o.amount_total || o.amount || 0) / 100), 0)

  const prevMonthFn = () => {
    const [y, m] = month.split('-').map(Number)
    setMonth(m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`)
  }
  const nextMonthFn = () => {
    const [y, m] = month.split('-').map(Number)
    setMonth(m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`)
  }

  const MONTH_NAMES_BG = ['', 'Януари', 'Февруари', 'Март', 'Април', 'Май', 'Юни', 'Юли', 'Август', 'Септември', 'Октомври', 'Ноември', 'Декември']
  const [y, m] = month.split('-').map(Number)
  const monthLabel = `${MONTH_NAMES_BG[m]} ${y}`

  function statusChip(status) {
    const isPaid = status === 'paid' || status === 'complete' || status === 'succeeded'
    const color = isPaid ? '#c4e9bf' : status === 'pending' ? '#FBBF24' : '#F87171'
    const label = isPaid ? t('orderStatusPaid') : status === 'pending' ? t('orderStatusPending') : t('orderStatusFailed')
    return (
      <Chip label={label} size="small" sx={{
        height: '20px', fontSize: '10px', fontWeight: 700,
        background: `${color}22`, color,
        border: `1px solid ${color}44`,
      }} />
    )
  }

  return (
    <Box>
      {/* Month nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 2.5 }}>
        <IconButton size="small" onClick={prevMonthFn} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800 }}>‹</Typography>
        </IconButton>
        <Typography sx={{ fontSize: '16px', fontWeight: 800, color: '#e0e0e0', minWidth: '160px', textAlign: 'center' }}>
          {monthLabel}
        </Typography>
        <IconButton size="small" onClick={nextMonthFn} sx={{ color: 'rgba(255,255,255,0.4)' }}>
          <Typography sx={{ fontSize: '18px', fontWeight: 800 }}>›</Typography>
        </IconButton>
      </Box>

      {/* Summary */}
      <Paper sx={{ p: 2, borderRadius: '14px', border: '1px solid rgba(196,233,191,0.2)',
        background: 'rgba(196,233,191,0.04)', mb: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', flex: 1 }}>
          {t('onlineRevenueLbl')} · {filtered.length} поръчки
        </Typography>
        <Typography sx={{ fontSize: '24px', fontWeight: 800, color: '#c4e9bf', fontFamily: "'MontBlanc', sans-serif" }}>
          {totalRev.toFixed(0)} <Typography component="span" sx={{ fontSize: '14px', fontWeight: 600, color: '#c4e9bf' }}>€</Typography>
        </Typography>
      </Paper>

      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} sx={{ color: '#c4e9bf' }} />
        </Box>
      ) : filtered.length === 0 ? (
        <Typography sx={{ color: 'rgba(255,255,255,0.4)', textAlign: 'center', py: 3 }}>{t('noOrders')}</Typography>
      ) : (
        <Paper sx={{ borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          {filtered
            .slice()
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
            .map((o, idx) => {
              const client = realClients.find(c => c.id === o.client_id)
              const amount = (Number(o.amount_total || o.amount || 0) / 100).toFixed(0)
              const date   = (o.created_at || '').slice(0, 10)
              return (
                <Box key={o.id || idx} sx={{
                  px: 2, py: 1.25, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap',
                  borderBottom: '1px solid rgba(255,255,255,0.06)', '&:last-child': { borderBottom: 'none' },
                }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '13px', color: '#e0e0e0', flex: 1, minWidth: 100 }}>
                    {client?.name || o.client_name || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', flex: 2, minWidth: 120 }}>
                    {o.program_title || o.product_name || '-'}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#c4e9bf', minWidth: 60, textAlign: 'right' }}>
                    {amount} €
                  </Typography>
                  <Typography sx={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', minWidth: 80 }}>
                    {date}
                  </Typography>
                  {statusChip(o.status)}
                </Box>
              )
            })}
        </Paper>
      )}
    </Box>
  )
}

// ── Admin SYNRG Method Tab ───────────────────────────────────
const SHOW_CONDITIONS = [
  { value: 'always',   labelBg: 'Винаги',                  labelEn: 'Always' },
  { value: 'steps',    labelBg: 'Малко крачки (low/medium)',labelEn: 'Low/medium steps' },
  { value: 'soda',     labelBg: 'Пие газирано',             labelEn: 'Drinks soda' },
  { value: 'packaged', labelBg: 'Яде пакетирано',           labelEn: 'Eats packaged food' },
  { value: 'fried',    labelBg: 'Яде пържено',              labelEn: 'Eats fried food' },
  { value: 'nuts',     labelBg: 'Яде ядки',                 labelEn: 'Eats nuts' },
  { value: 'alcohol',  labelBg: 'Пие алкохол',              labelEn: 'Drinks alcohol' },
]

function HabitDialog({ habit, onClose, onSave, lang }) {
  const isBg = lang !== 'en'
  const isNew = !habit?.id
  const [form, setForm] = useState({
    label_bg:      habit?.label_bg      || '',
    label_en:      habit?.label_en      || '',
    why_bg:        habit?.why_bg        || '',
    why_en:        habit?.why_en        || '',
    practical_bg:  (habit?.practical_bg || []).join('\n'),
    practical_en:  (habit?.practical_en || []).join('\n'),
    week:          habit?.week          || 1,
    show_condition:habit?.show_condition|| 'always',
    no_kcal:       habit?.no_kcal       || false,
    enabled:       habit?.enabled       !== false,
    habit_key:     habit?.habit_key     || '',
    sort_order:    habit?.sort_order    || 0,
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  function handleSave() {
    onSave({
      ...form,
      week:         Number(form.week),
      sort_order:   Number(form.sort_order),
      practical_bg: form.practical_bg.split('\n').map(s => s.trim()).filter(Boolean),
      practical_en: form.practical_en.split('\n').map(s => s.trim()).filter(Boolean),
    })
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { background: '#1e1e2e' } }}>
      <DialogTitle sx={{ fontWeight: 800, fontSize: '16px' }}>
        {isNew ? 'Нов навик' : 'Редактирай навик'}
      </DialogTitle>
      <DialogContent sx={{ display: 'grid', gap: 2, pt: '12px !important' }}>
        {isNew && (
          <TextField label="habit_key (уникален ID)" size="small" value={form.habit_key}
            onChange={e => set('habit_key', e.target.value)} />
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          <FormControl size="small">
            <InputLabel>Седмица</InputLabel>
            <Select value={form.week} label="Седмица" onChange={e => set('week', e.target.value)}>
              {[1,2,3,4,5].map(w => <MenuItem key={w} value={w}>{w}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small">
            <InputLabel>Показва се при</InputLabel>
            <Select value={form.show_condition} label="Показва се при" onChange={e => set('show_condition', e.target.value)}>
              {SHOW_CONDITIONS.map(c => <MenuItem key={c.value} value={c.value}>{isBg ? c.labelBg : c.labelEn}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>
        <TextField label="Лейбъл BG" size="small" value={form.label_bg} onChange={e => set('label_bg', e.target.value)} />
        <TextField label="Лейбъл EN" size="small" value={form.label_en} onChange={e => set('label_en', e.target.value)} />
        <TextField label="Обяснение BG" size="small" multiline rows={4} value={form.why_bg} onChange={e => set('why_bg', e.target.value)}
          helperText="Използвай {weight} за тегло, {kcal_steps} за калории крачки" />
        <TextField label="Обяснение EN" size="small" multiline rows={4} value={form.why_en} onChange={e => set('why_en', e.target.value)} />
        <TextField label="Съвети BG (по един на ред)" size="small" multiline rows={3} value={form.practical_bg} onChange={e => set('practical_bg', e.target.value)} />
        <TextField label="Съвети EN (по един на ред)" size="small" multiline rows={3} value={form.practical_en} onChange={e => set('practical_en', e.target.value)} />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField label="Ред (sort_order)" size="small" type="number" value={form.sort_order}
            onChange={e => set('sort_order', e.target.value)} sx={{ width: 120 }} />
          <FormControlLabel control={<Checkbox checked={form.no_kcal} onChange={e => set('no_kcal', e.target.checked)} />} label="Без калориен блок" />
          <FormControlLabel control={<Checkbox checked={form.enabled} onChange={e => set('enabled', e.target.checked)} />} label="Активен" />
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Откажи</Button>
        <Button variant="contained" onClick={handleSave} disabled={!form.label_bg || (!isNew || form.habit_key)}>Запази</Button>
      </DialogActions>
    </Dialog>
  )
}

const GOAL_LABEL = { lose: 'Сваляне', maintain: 'Поддръжка', gain: 'Покачване' }
const STEPS_LABEL = { low: 'под 5 000', medium: '5–8 000', high: '8–12 000', very_high: 'над 12 000' }

function synrgWeek(startedAt) {
  if (!startedAt) return null
  const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / 86400000)
  return Math.min(5, Math.floor(days / 7) + 1)
}

function AdminSynrgTab() {
  const { synrgHabits, setSynrgHabits, showSnackbar, lang, clients } = useApp()
  const [dlg,     setDlg]     = useState(null)
  const [delId,   setDelId]   = useState(null)
  const [section, setSection] = useState('clients') // 'clients' | 'habits'
  const isBg = lang !== 'en'

  const synrgClients = clients.filter(c => (c.modules || []).includes('synrg_method') && !c.is_coach)
  const active  = synrgClients.filter(c => c.synrgStartedAt)
  const pending = synrgClients.filter(c => !c.synrgStartedAt)

  async function handleSave(form) {
    try {
      if (dlg?.id) {
        await DB.update('synrg_habits', dlg.id, form)
        setSynrgHabits(prev => prev.map(h => h.id === dlg.id ? { ...h, ...form } : h).sort((a,b) => a.sort_order - b.sort_order))
      } else {
        const saved = await DB.insert('synrg_habits', form)
        setSynrgHabits(prev => [...prev, saved].sort((a,b) => a.sort_order - b.sort_order))
      }
      showSnackbar('Запазено')
      setDlg(null)
    } catch(e) { showSnackbar('Грешка: ' + e.message, 'error') }
  }

  async function handleDelete(id) {
    try {
      await DB.deleteById('synrg_habits', id)
      setSynrgHabits(prev => prev.filter(h => h.id !== id))
      showSnackbar('Изтрито')
      setDelId(null)
    } catch(e) { showSnackbar('Грешка: ' + e.message, 'error') }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h2">SYNRG Метод</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button size="small" variant={section === 'clients' ? 'contained' : 'outlined'}
            onClick={() => setSection('clients')}
            sx={{ fontSize: '12px', ...(section === 'clients' ? { background: C.primary, color: '#0f1c11' } : { borderColor: C.border, color: C.muted }) }}>
            Клиенти ({active.length})
          </Button>
          <Button size="small" variant={section === 'habits' ? 'contained' : 'outlined'}
            onClick={() => setSection('habits')}
            sx={{ fontSize: '12px', ...(section === 'habits' ? { background: C.primary, color: '#0f1c11' } : { borderColor: C.border, color: C.muted }) }}>
            Навици
          </Button>
        </Box>
      </Box>

      {/* ── Clients overview ── */}
      {section === 'clients' && (
        <Box>
          {/* Active — filled quiz */}
          <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.primary, mb: 1 }}>
            Попълнили анкетата — {active.length}
          </Typography>
          <Paper sx={{ overflow: 'hidden', mb: 3 }}>
            {active.length === 0 && (
              <Typography sx={{ p: 2, color: C.muted, fontSize: '13px' }}>Няма попълнили</Typography>
            )}
            {active.map((c, i) => {
              const week  = synrgWeek(c.synrgStartedAt)
              const quiz  = c.synrgQuiz || {}
              return (
                <Box key={c.id}>
                  <Box sx={{ px: 2, py: '12px', display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                    {/* Avatar */}
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', background: C.primaryContainer,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '13px', fontWeight: 800, color: C.text, flexShrink: 0 }}>
                      {c.name.charAt(0).toUpperCase()}
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '14px' }}>{c.name}</Typography>
                        <Chip label={`Седмица ${week}`} size="small"
                          sx={{ fontSize: '10px', height: '18px', background: C.primaryContainer, color: C.text }} />
                        {quiz.goal && (
                          <Chip label={GOAL_LABEL[quiz.goal] || quiz.goal} size="small"
                            sx={{ fontSize: '10px', height: '18px', background: 'rgba(255,255,255,0.06)', color: C.muted }} />
                        )}
                      </Box>
                      <Box sx={{ display: 'flex', gap: 2, mt: 0.5, flexWrap: 'wrap' }}>
                        {quiz.weight && <Typography sx={{ fontSize: '12px', color: C.muted }}>{quiz.weight} кг</Typography>}
                        {quiz.height && <Typography sx={{ fontSize: '12px', color: C.muted }}>{quiz.height} см</Typography>}
                        {c.proteinTarget > 0 && <Typography sx={{ fontSize: '12px', color: C.muted }}>{c.proteinTarget}г протеин</Typography>}
                        {c.calorieTarget > 0 && <Typography sx={{ fontSize: '12px', color: C.muted }}>{c.calorieTarget} ккал</Typography>}
                        {quiz.steps && <Typography sx={{ fontSize: '12px', color: C.muted }}>Крачки: {STEPS_LABEL[quiz.steps] || quiz.steps}</Typography>}
                      </Box>
                      <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.25 }}>
                        Започнал: {c.synrgStartedAt}
                      </Typography>
                    </Box>
                  </Box>
                  {i < active.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
                </Box>
              )
            })}
          </Paper>

          {/* Pending — have module but not filled */}
          {pending.length > 0 && (
            <>
              <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.muted, mb: 1 }}>
                Не са попълнили анкетата — {pending.length}
              </Typography>
              <Paper sx={{ overflow: 'hidden' }}>
                {pending.map((c, i) => (
                  <Box key={c.id}>
                    <Box sx={{ px: 2, py: '10px', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box sx={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.06)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 800, color: C.muted }}>
                        {c.name.charAt(0).toUpperCase()}
                      </Box>
                      <Typography sx={{ fontSize: '13px', color: C.muted }}>{c.name}</Typography>
                    </Box>
                    {i < pending.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
                  </Box>
                ))}
              </Paper>
            </>
          )}
        </Box>
      )}

      {/* ── Habits editor ── */}
      {section === 'habits' && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDlg({})}>
              Нов навик
            </Button>
          </Box>
      {[1, 2, 3, 4, 5].map(week => {
        const habits = synrgHabits.filter(h => h.week === week)
        return (
          <Box key={week} sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase', color: C.primary, mb: 1 }}>
              Седмица {week}
            </Typography>
            <Paper sx={{ overflow: 'hidden' }}>
              {habits.length === 0 && (
                <Typography sx={{ p: 2, color: C.muted, fontSize: '13px' }}>Няма навици</Typography>
              )}
              {habits.map((h, i) => (
                <Box key={h.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: '12px' }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: h.enabled ? C.text : C.muted }}>
                        {isBg ? h.label_bg : h.label_en}
                      </Typography>
                      <Typography sx={{ fontSize: '11px', color: C.muted }}>
                        {SHOW_CONDITIONS.find(c => c.value === h.show_condition)?.[isBg ? 'labelBg' : 'labelEn']} · #sort {h.sort_order}
                        {!h.enabled && ' · '}
                        {!h.enabled && <span style={{ color: '#ff6b6b' }}>неактивен</span>}
                      </Typography>
                    </Box>
                    <IconButton size="small" onClick={() => setDlg(h)} sx={{ color: C.muted }}>
                      <EditIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                    <IconButton size="small" onClick={() => setDelId(h.id)} sx={{ color: C.danger }}>
                      <DeleteOutlineIcon sx={{ fontSize: '16px' }} />
                    </IconButton>
                  </Box>
                  {i < habits.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
                </Box>
              ))}
            </Paper>
          </Box>
        )
      })}

      {dlg !== null && <HabitDialog habit={Object.keys(dlg).length ? dlg : null} lang={lang} onClose={() => setDlg(null)} onSave={handleSave} />}

      {delId && (
        <Dialog open onClose={() => setDelId(null)} PaperProps={{ sx: { background: '#1e1e2e' } }}>
          <DialogTitle>Изтрий навика?</DialogTitle>
          <DialogContent><Typography>Това действие е необратимо.</Typography></DialogContent>
          <DialogActions>
            <Button onClick={() => setDelId(null)}>Откажи</Button>
            <Button color="error" variant="contained" onClick={() => handleDelete(delId)}>Изтрий</Button>
          </DialogActions>
        </Dialog>
      )}
        </Box>
      )}
    </Box>
  )
}

// ── Main Admin Page ──────────────────────────────────────────
export default function Admin() {
  const { t, lang, auth } = useApp()
  const fullAdmin = isFullAdmin(auth)

  // ── 2-level navigation state ──────────────────────────────
  const [section,    setSection]    = useState('dashboard')
  const [clientSub,  setClientSub]  = useState('clients')
  const [financeSub, setFinanceSub] = useState('analytics')
  const [contentSub, setContentSub] = useState('programs')

  // Navigate from DashboardTab stat cards
  function goTo(sec, sub) {
    setSection(sec)
    if (sec === 'clients' && sub) setClientSub(sub)
    if (sec === 'finance' && sub) setFinanceSub(sub)
    if (sec === 'content' && sub) setContentSub(sub)
  }

  // ── Section definitions ───────────────────────────────────
  const SECTIONS = [
    { key: 'dashboard', label: 'Табло' },
    { key: 'clients',   label: 'Клиенти' },
    ...(fullAdmin ? [{ key: 'finance', label: 'Финанси' }] : []),
    { key: 'content',   label: 'Съдържание' },
  ]

  const SUB_TABS = {
    clients: [
      { key: 'clients',       label: t('clientsMgmt')     || 'Клиенти' },
      { key: 'coaches',       label: t('coachesTab')      || 'Треньори' },
      { key: 'subscriptions', label: t('subscriptionsTab')|| 'Абонаменти' },
    ],
    finance: [
      { key: 'analytics', label: t('analyticsTab') || 'Аналитика' },
      { key: 'expenses',  label: t('expensesTab')  || 'Разходи' },
      { key: 'orders',    label: t('ordersTab')    || 'Поръчки' },
    ],
    content: [
      { key: 'programs', label: t('adminPrograms') || 'Програми' },
      { key: 'synrg',    label: 'SYNRG' },
      { key: 'site',     label: t('siteTab')       || 'Сайт' },
    ],
  }

  const activeSub    = section === 'clients' ? clientSub  : section === 'finance' ? financeSub  : contentSub
  const setActiveSub = section === 'clients' ? setClientSub : section === 'finance' ? setFinanceSub : setContentSub

  return (
    <Box sx={{ maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
        <AdminPanelSettingsIcon sx={{ fontSize: 24, color: C.purple }} />
        <Typography variant="h5" sx={{ fontWeight: 800, color: C.text }}>
          {t('adminTitle')}
        </Typography>
      </Box>

      {/* Main section nav */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: section === 'dashboard' ? 2.5 : 1.5, flexWrap: 'wrap' }}>
        {SECTIONS.map(s => (
          <Box key={s.key} onClick={() => setSection(s.key)} sx={{
            px: 2, py: 0.75, borderRadius: '100px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 700,
            background: section === s.key ? C.primary : 'transparent',
            color:      section === s.key ? C.primaryOn : C.text,
            border:     `1px solid ${section === s.key ? C.primary : C.loganBorder}`,
            transition: 'all 0.22s',
            '&:hover':  section === s.key ? {} : { borderColor: C.logan, background: C.loganDeep },
          }}>{s.label}</Box>
        ))}
      </Box>

      {/* Sub-tab nav (hidden on Табло) */}
      {SUB_TABS[section] && (
        <Box sx={{ display: 'flex', gap: 0.5, mb: 2.5, flexWrap: 'wrap',
                   pb: 1.5, borderBottom: `1px solid ${C.border}` }}>
          {SUB_TABS[section].map(sub => {
            const isActive = activeSub === sub.key
            return (
              <Box key={sub.key} onClick={() => setActiveSub(sub.key)} sx={{
                px: 1.5, py: 0.5, borderRadius: '100px', cursor: 'pointer',
                fontSize: '12px', fontWeight: 700,
                background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
                color:      isActive ? C.text : C.muted,
                border:     `1px solid ${isActive ? C.border : 'transparent'}`,
                transition: 'all 0.18s',
                '&:hover':  { color: C.text, background: 'rgba(255,255,255,0.06)' },
              }}>{sub.label}</Box>
            )
          })}
        </Box>
      )}

      {/* Section content */}
      {section === 'dashboard' && <DashboardTab t={t} lang={lang} goTo={goTo} />}

      {section === 'clients' && <>
        {clientSub === 'clients'       && <ClientsTab t={t} />}
        {clientSub === 'coaches'       && <CoachesTab t={t} />}
        {clientSub === 'subscriptions' && <SubscriptionsTab t={t} lang={lang} />}
      </>}

      {section === 'finance' && fullAdmin && <>
        {financeSub === 'analytics' && <AnalyticsTab t={t} />}
        {financeSub === 'expenses'  && <ExpensesTab t={t} />}
        {financeSub === 'orders'    && <OrdersTab t={t} />}
      </>}

      {section === 'content' && <>
        {contentSub === 'programs' && <ProgramsTab />}
        {contentSub === 'synrg'    && <AdminSynrgTab />}
        {contentSub === 'site'     && <SiteTab />}
      </>}
    </Box>
  )
}
