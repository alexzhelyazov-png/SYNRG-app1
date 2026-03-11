import { useEffect, useState, useMemo } from 'react'
import {
  Box, Typography, Paper, Button, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, TextField,
  MenuItem, Select, FormControl, InputLabel, CircularProgress,
  Collapse,
} from '@mui/material'
import CalendarMonthIcon  from '@mui/icons-material/CalendarMonth'
import AddIcon            from '@mui/icons-material/Add'
import EditIcon           from '@mui/icons-material/Edit'
import DeleteOutlineIcon  from '@mui/icons-material/DeleteOutline'
import PersonAddIcon      from '@mui/icons-material/PersonAdd'
import PersonRemoveIcon   from '@mui/icons-material/PersonRemove'
import ChevronLeftIcon    from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon   from '@mui/icons-material/ChevronRight'
import BoltIcon           from '@mui/icons-material/Bolt'
import { useApp }         from '../context/AppContext'
import { useBooking }     from '../context/BookingContext'
import { C }              from '../theme'
import { isAdmin, fmtTime, occupancyStr, isoToday } from '../lib/bookingUtils'

// ── Constants ──────────────────────────────────────────────────
const HOURS       = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19]
const WEEKDAYS_BG = ['Нед', 'Пон', 'Вт', 'Ср', 'Чет', 'Пет', 'Съб']
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Fixed colors for known coaches; hash-based fallback for others
const SLOT_COLORS = [
  { bg: 'rgba(196,233,191,0.18)', bd: 'rgba(196,233,191,0.40)', txt: '#C4E9BF' }, // green
  { bg: 'rgba(200,197,255,0.18)', bd: 'rgba(200,197,255,0.40)', txt: '#C8C5FF' }, // purple
  { bg: 'rgba(255,184,122,0.18)', bd: 'rgba(255,184,122,0.40)', txt: '#FFB87A' }, // orange
  { bg: 'rgba(122,200,255,0.18)', bd: 'rgba(122,200,255,0.40)', txt: '#7AC8FF' }, // blue
  { bg: 'rgba(255,135,145,0.18)', bd: 'rgba(255,135,145,0.40)', txt: '#FF8791' }, // red/pink
  { bg: 'rgba(255,220,122,0.18)', bd: 'rgba(255,220,122,0.40)', txt: '#FFDC7A' }, // yellow
]
const FIXED_COACH_COLORS = {
  'Ицко':  { bg: 'rgba(200,197,255,0.18)', bd: 'rgba(200,197,255,0.40)', txt: '#C8C5FF' }, // purple
  'Елина': { bg: 'rgba(196,233,191,0.18)', bd: 'rgba(196,233,191,0.40)', txt: '#C4E9BF' }, // green
  'Никола':{ bg: 'rgba(255,220,122,0.18)', bd: 'rgba(255,220,122,0.40)', txt: '#FFDC7A' }, // yellow
}
function coachColor(name) {
  if (!name) return SLOT_COLORS[0]
  if (FIXED_COACH_COLORS[name]) return FIXED_COACH_COLORS[name]
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return SLOT_COLORS[h % SLOT_COLORS.length]
}

// ── Helpers ────────────────────────────────────────────────────
function addDays(isoDate, n) {
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(Date.UTC(y, m - 1, d))
  date.setUTCDate(date.getUTCDate() + n)
  return date.toISOString().slice(0, 10)
}
function p2(n) { return String(n).padStart(2, '0') }

const inputSx = {
  '& .MuiInputBase-input':                                    { color: C.text },
  '& .MuiOutlinedInput-notchedOutline':                       { borderColor: C.border },
  '& .MuiInputLabel-root':                                    { color: C.muted },
  '& .MuiInputBase-input::-webkit-calendar-picker-indicator': { filter: 'invert(0.7)' },
}

// ── Quick Shift Dialog ─────────────────────────────────────────
// Creates multiple hourly slots in one go (e.g. Ицко 09:00-14:00)
function QuickShiftDialog({ open, onClose, onSave, coaches, defaultDate, t }) {
  const today = isoToday()
  const [date,     setDate]     = useState(defaultDate || today)
  const [coach,    setCoach]    = useState(coaches[0]?.name || '')
  const [fromH,    setFromH]    = useState(9)
  const [toH,      setToH]      = useState(14)
  const [capacity, setCapacity] = useState(3)
  const [notes,    setNotes]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const [done,     setDone]     = useState(null)

  useEffect(() => {
    if (open) { setDate(defaultDate || today); setDone(null) }
  }, [open, defaultDate])

  const count    = Math.max(0, toH - fromH)
  const hourList = Array.from({ length: count }, (_, i) => `${p2(fromH + i)}:00–${p2(fromH + i + 1)}:00`)

  async function handleSave() {
    if (count === 0) return
    setSaving(true)
    const c = coaches.find(c => c.name === coach)
    const res = await onSave({
      date, coachId: c?.id || null, coachName: coach,
      fromHour: fromH, toHour: toH,
      capacity: Number(capacity), notes,
    })
    setSaving(false)
    setDone(res?.created ?? count)
  }

  function close() { onClose(); setDone(null) }

  return (
    <Dialog open={open} onClose={close} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text, display: 'flex', alignItems: 'center', gap: 1 }}>
        <BoltIcon sx={{ color: C.orange, fontSize: 20 }} /> Нова смяна
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '4px !important' }}>
        {/* Date */}
        <TextField label="Дата" type="date" size="small"
          value={date} onChange={e => setDate(e.target.value)}
          InputLabelProps={{ shrink: true }} sx={inputSx} />

        {/* Coach */}
        <FormControl fullWidth size="small">
          <InputLabel sx={{ color: C.muted }}>{t('slotCoachLbl')}</InputLabel>
          <Select value={coach} onChange={e => setCoach(e.target.value)} label={t('slotCoachLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {coaches.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>

        {/* From – To hour */}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel sx={{ color: C.muted }}>От</InputLabel>
            <Select value={fromH} onChange={e => setFromH(Number(e.target.value))} label="От"
              sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
              {HOURS.map(h => <MenuItem key={h} value={h}>{p2(h)}:00</MenuItem>)}
            </Select>
          </FormControl>
          <Typography sx={{ color: C.muted, fontWeight: 700, flexShrink: 0 }}>–</Typography>
          <FormControl size="small" sx={{ flex: 1 }}>
            <InputLabel sx={{ color: C.muted }}>До</InputLabel>
            <Select value={toH} onChange={e => setToH(Number(e.target.value))} label="До"
              sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
              {[...HOURS.slice(1), 20].map(h => <MenuItem key={h} value={h}>{p2(h)}:00</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        {/* Capacity */}
        <TextField label={t('slotCapacityLbl')} type="number" size="small"
          value={capacity} onChange={e => setCapacity(e.target.value)}
          inputProps={{ min: 1, max: 30 }} sx={inputSx} />

        {/* Notes (optional) */}
        <TextField label={t('slotNotesLbl')} size="small"
          value={notes} onChange={e => setNotes(e.target.value)} sx={inputSx} />

        {/* Preview */}
        {count > 0 && !done && (
          <Box sx={{ p: 1.5, borderRadius: '10px', background: C.primaryContainer, border: `1px solid ${C.primaryA20}` }}>
            <Typography sx={{ fontSize: '12px', color: C.primary, fontWeight: 700, mb: 0.5 }}>
              Ще се създадат {count} часа:
            </Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted, lineHeight: 1.6 }}>
              {hourList.join(' · ')}
            </Typography>
          </Box>
        )}
        {done !== null && (
          <Box sx={{ p: 1.5, borderRadius: '10px', background: 'rgba(196,233,191,0.1)', border: `1px solid ${C.primaryA20}` }}>
            <Typography sx={{ fontSize: '13px', color: C.primary, fontWeight: 700 }}>
              ✓ Добавени {done} часа
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={close} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving || count === 0}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {saving ? <CircularProgress size={16} /> : 'Създай смяна'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Cell Add Dialog ────────────────────────────────────────────
// Lightweight popup when admin clicks an empty calendar cell
function CellAddDialog({ open, onClose, onSave, coaches, date, hour, t }) {
  const [coach,    setCoach]    = useState(coaches[0]?.name || '')
  const [capacity, setCapacity] = useState(3)
  const [saving,   setSaving]   = useState(false)
  const [err,      setErr]      = useState('')

  useEffect(() => { if (open) { setCoach(coaches[0]?.name || ''); setErr('') } }, [open])

  async function handleSave() {
    setSaving(true); setErr('')
    const c = coaches.find(c => c.name === coach)
    const res = await onSave({
      slot_date:  date,
      start_time: `${p2(hour)}:00`,
      end_time:   `${p2(hour + 1)}:00`,
      coach_id:   c?.id || null,
      coach_name: coach,
      capacity:   Number(capacity),
      notes:      null,
    })
    setSaving(false)
    if (res?.error) { setErr(res.error); return }
    onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text, fontSize: '15px' }}>
        {date} · {p2(hour)}:00 – {p2(hour + 1)}:00
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        <FormControl fullWidth size="small">
          <InputLabel sx={{ color: C.muted }}>{t('slotCoachLbl')}</InputLabel>
          <Select value={coach} onChange={e => setCoach(e.target.value)} label={t('slotCoachLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {coaches.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label={t('slotCapacityLbl')} type="number" size="small"
          value={capacity} onChange={e => setCapacity(e.target.value)}
          inputProps={{ min: 1, max: 30 }} sx={inputSx} />
        {err && <Typography sx={{ fontSize: '12px', color: '#F87171' }}>{err}</Typography>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {saving ? <CircularProgress size={16} /> : t('createSlotBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Edit Slot Dialog ───────────────────────────────────────────
function EditSlotDialog({ open, onClose, onSave, slot, coaches, t }) {
  const [capacity,  setCapacity]  = useState(slot?.capacity || 3)
  const [coachName, setCoachName] = useState(slot?.coach_name || '')
  const [notes,     setNotes]     = useState(slot?.notes || '')
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    if (slot) { setCapacity(slot.capacity); setCoachName(slot.coach_name); setNotes(slot.notes || '') }
  }, [slot])

  async function handleSave() {
    setLoading(true)
    const coach = coaches.find(c => c.name === coachName)
    const res = await onSave(slot.id, {
      capacity:   Number(capacity),
      coach_name: coachName,
      coach_id:   coach?.id || null,
      notes:      notes || null,
    })
    setLoading(false)
    if (!res?.error) onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: { borderRadius: '20px', background: C.card, border: `1px solid ${C.border}` } }}>
      <DialogTitle sx={{ fontWeight: 700, color: C.text }}>{t('editSlotTitle')}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
        {slot && (
          <Typography sx={{ fontSize: '13px', color: C.muted }}>
            {slot.slot_date} · {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
          </Typography>
        )}
        <FormControl fullWidth size="small">
          <InputLabel sx={{ color: C.muted }}>{t('slotCoachLbl')}</InputLabel>
          <Select value={coachName} onChange={e => setCoachName(e.target.value)} label={t('slotCoachLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {coaches.map(c => <MenuItem key={c.name} value={c.name}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <TextField label={t('slotCapacityLbl')} type="number" size="small"
          value={capacity} onChange={e => setCapacity(e.target.value)}
          inputProps={{ min: 1, max: 30 }} sx={inputSx} />
        <TextField label={t('slotNotesLbl')} size="small" multiline rows={2}
          value={notes} onChange={e => setNotes(e.target.value)} sx={inputSx} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: C.muted }}>{t('cancelBtn')}</Button>
        <Button variant="contained" onClick={handleSave} disabled={loading}
          sx={{ background: C.primary, color: '#0f1c11', fontWeight: 700 }}>
          {loading ? <CircularProgress size={16} /> : t('saveBtn')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Add Client to Slot Dialog ──────────────────────────────────
function AddClientDialog({ open, onClose, onAdd, slot, realClients, t }) {
  const [selId,     setSelId]     = useState('')
  const [useCredit, setUseCredit] = useState(true)
  const [loading,   setLoading]   = useState(false)
  const [err,       setErr]       = useState('')

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
        {slot && (
          <Typography sx={{ fontSize: '13px', color: C.muted, mb: 2 }}>
            {slot.slot_date} · {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)}
          </Typography>
        )}
        <FormControl fullWidth size="small" sx={{ mb: 2 }}>
          <InputLabel sx={{ color: C.muted }}>{t('selectClientLbl')}</InputLabel>
          <Select value={selId} onChange={e => setSelId(e.target.value)} label={t('selectClientLbl')}
            sx={{ color: C.text, '.MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}>
            {realClients.map(c => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input type="checkbox" id="useCredit" checked={useCredit} onChange={e => setUseCredit(e.target.checked)} />
          <label htmlFor="useCredit" style={{ fontSize: '13px', color: C.muted, cursor: 'pointer' }}>
            {t('useCredit')}
          </label>
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

// ── Convert hex color to rgba ─────────────────────────────────
function hexRgba(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

// ── Slot Card inside a calendar cell — horizontal pill row ────
function SlotCell({ slot, adminMode, onEdit, onDelete, onAddClient, bookings = [] }) {
  const [hover,      setHover]      = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const { auth, clients, setSelIdx, setCoachClientMode } = useApp()
  const color    = coachColor(slot.coach_name)
  const base     = color.txt
  const capacity = Math.min(slot.capacity || 3, 6)
  // Array of capacity length: filled with booking or null
  const cells    = Array.from({ length: capacity }, (_, i) => bookings[i] || null)

  function openClient(booking) {
    if (auth.role === 'client') return
    const idx = clients.findIndex(c => c.id === booking.client_id)
    if (idx >= 0) { setSelIdx(idx); setCoachClientMode(true) }
  }

  return (
    <Box
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setConfirmDel(false) }}
      sx={{ position: 'relative', mb: '3px', userSelect: 'none' }}
    >
      {/* Pills stacked vertically — booked=full card, empty=thin line */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {cells.map((booking, i) => (
          booking ? (
            <Tooltip
              key={i}
              title={booking.client_name}
              placement="top"
              enterTouchDelay={0}
              leaveTouchDelay={2000}
              arrow
            >
              <Box onClick={() => openClient(booking)} sx={{
                borderRadius: '6px',
                px: '6px', py: '5px',
                background: hexRgba(base, 0.30),
                border: `1px solid ${hexRgba(base, 0.58)}`,
                overflow: 'hidden',
                cursor: auth.role !== 'client' ? 'pointer' : 'default',
              }}>
                <Typography sx={{
                  fontSize: '12px', fontWeight: 800,
                  color: base,
                  lineHeight: 1.3,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {booking.client_name}
                </Typography>
              </Box>
            </Tooltip>
          ) : (
            <Box key={i} sx={{
              borderRadius: '4px',
              height: '8px',
              background: hexRgba(base, 0.07),
              border: `1px solid ${hexRgba(base, 0.15)}`,
            }} />
          )
        ))}
      </Box>

      {/* Admin action buttons (shown on hover) */}
      {adminMode && hover && !confirmDel && (
        <Box sx={{
          position: 'absolute', top: 2, right: 2, zIndex: 10,
          display: 'flex', gap: '2px',
          background: 'rgba(12,10,9,0.85)', borderRadius: '6px', p: '2px',
        }}>
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); onAddClient(slot) }}
            sx={{ p: '2px', color: C.muted, '&:hover': { color: C.primary } }}>
            <PersonAddIcon sx={{ fontSize: 11 }} />
          </IconButton>
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); onEdit(slot) }}
            sx={{ p: '2px', color: C.muted, '&:hover': { color: C.primary } }}>
            <EditIcon sx={{ fontSize: 11 }} />
          </IconButton>
          <IconButton size="small"
            onClick={e => { e.stopPropagation(); setConfirmDel(true) }}
            sx={{ p: '2px', color: C.muted, '&:hover': { color: '#F87171' } }}>
            <DeleteOutlineIcon sx={{ fontSize: 11 }} />
          </IconButton>
        </Box>
      )}

      {/* Delete confirmation overlay */}
      {confirmDel && (
        <Box sx={{
          position: 'absolute', inset: 0, borderRadius: '5px',
          background: 'rgba(12,10,9,0.92)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5,
          zIndex: 10,
        }}>
          <Button size="small"
            onClick={e => { e.stopPropagation(); onDelete(slot.id); setConfirmDel(false) }}
            sx={{ fontSize: '11px', fontWeight: 700, color: '#F87171', minWidth: 0, px: 1, py: 0.25 }}>
            Трий
          </Button>
          <Button size="small"
            onClick={e => { e.stopPropagation(); setConfirmDel(false) }}
            sx={{ fontSize: '11px', color: C.muted, minWidth: 0, px: 1, py: 0.25 }}>
            Назад
          </Button>
        </Box>
      )}
    </Box>
  )
}

// ── Main Schedule Page ─────────────────────────────────────────
export default function Schedule() {
  const { auth, coaches, realClients, t, lang, showSnackbar } = useApp()
  const {
    slots, slotBookings,
    loadSlots, loadSlotBookings,
    createSlot, createShiftSlots,
    updateSlot, deleteSlot,
    adminAddToSlot, adminRemoveFromSlot,
  } = useBooking()

  const admin = isAdmin(auth)
  const today = isoToday()

  const [viewStart,    setViewStart]    = useState(today)
  const [loaded,       setLoaded]       = useState(false)
  const [editTarget,   setEditTarget]   = useState(null)
  const [addTarget,    setAddTarget]    = useState(null)
  const [showEditDlg,  setShowEditDlg]  = useState(false)
  const [showAddDlg,   setShowAddDlg]   = useState(false)
  const [showShiftDlg, setShowShiftDlg] = useState(false)
  const [cellTarget,   setCellTarget]   = useState(null) // { date, hour }
  const [showCellDlg,  setShowCellDlg]  = useState(false)

  const viewDates = [viewStart, addDays(viewStart, 1), addDays(viewStart, 2)]

  // Load slots whenever the view changes
  useEffect(() => {
    setLoaded(false)
    async function load() {
      const end     = addDays(viewStart, 2)
      const fetched = await loadSlots(viewStart, end)
      if (fetched.length > 0) await loadSlotBookings(fetched.map(s => s.id))
      setLoaded(true)
    }
    load()
  }, [viewStart])

  // Group slots by date so the grid can look them up quickly
  const slotsMap = useMemo(() => {
    const m = {}
    for (const s of slots) {
      if (!m[s.slot_date]) m[s.slot_date] = []
      m[s.slot_date].push(s)
    }
    return m
  }, [slots])

  // ── Handlers ────────────────────────────────────────────────
  function refreshView() {
    const end = addDays(viewStart, 2)
    return loadSlots(viewStart, end).then(fetched => {
      if (fetched.length > 0) loadSlotBookings(fetched.map(s => s.id))
    })
  }

  async function handleCreateSlot(data) {
    const res = await createSlot(data)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('slotSavedMsg'))
    await refreshView()
    return res
  }

  async function handleCreateShift(data) {
    const res = await createShiftSlots(data)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    if (res?.created > 0) {
      showSnackbar(`✓ ${res.created} часа добавени`)
      await refreshView()
    }
    return res
  }

  async function handleUpdateSlot(slotId, patch) {
    const res = await updateSlot(slotId, patch)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return res }
    showSnackbar(t('slotSavedMsg'))
    await refreshView()
    return res
  }

  async function handleDeleteSlot(slotId) {
    const res = await deleteSlot(slotId)
    if (res?.error) { showSnackbar('Грешка: ' + res.error); return }
    showSnackbar(t('slotDeletedMsg'))
    await refreshView()
  }

  async function handleAddClient(slotId, clientId, clientName, useCredit) {
    const res = await adminAddToSlot(slotId, clientId, clientName, useCredit)
    if (!res?.error) showSnackbar(`${clientName} добавен в часа`)
    return res
  }

  // ── Day-column header ───────────────────────────────────────
  function DayHeader({ date }) {
    const isToday_ = date === today
    const [y, m, day] = date.split('-').map(Number)
    const d = new Date(Date.UTC(y, m - 1, day))
    const wd = lang === 'bg' ? WEEKDAYS_BG[d.getUTCDay()] : WEEKDAYS_EN[d.getUTCDay()]
    return (
      <Box sx={{ borderLeft: `1px solid ${C.border}`, py: 1.25, textAlign: 'center' }}>
        <Typography sx={{
          fontSize: '10px', fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.5px', color: isToday_ ? C.primary : C.muted, lineHeight: 1,
        }}>
          {wd}
        </Typography>
        <Box sx={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 32, height: 32, borderRadius: '50%', mt: 0.5,
          background: isToday_ ? C.primary : 'transparent',
        }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 800, color: isToday_ ? '#0f1c11' : C.text, lineHeight: 1 }}>
            {d.getUTCDate()}
          </Typography>
        </Box>
      </Box>
    )
  }

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      {/* ── Page header ──────────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, color: C.text }}>
            {t('scheduleTitle')}
          </Typography>
          {admin && (
            <Button
              startIcon={<BoltIcon sx={{ fontSize: '15px !important' }} />}
              onClick={() => setShowShiftDlg(true)}
              size="small"
              sx={{
                background: 'rgba(255,184,122,0.12)', color: C.orange,
                fontWeight: 700, fontSize: '12px', borderRadius: '10px',
                border: '1px solid rgba(255,184,122,0.25)',
                px: 1.5, py: 0.5, textTransform: 'none',
                '&:hover': { background: 'rgba(255,184,122,0.2)' },
              }}
            >
              Нова смяна
            </Button>
          )}
        </Box>

        {/* Navigation */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {viewStart !== today && (
            <Button size="small" onClick={() => setViewStart(today)}
              sx={{ color: C.muted, fontSize: '11px', textTransform: 'none', px: 1, py: 0.5,
                border: `1px solid ${C.border}`, borderRadius: '8px' }}>
              Днес
            </Button>
          )}
          <IconButton onClick={() => setViewStart(addDays(viewStart, -3))} size="small"
            sx={{ color: C.muted, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
            <ChevronLeftIcon />
          </IconButton>
          <Typography sx={{ fontSize: '12px', color: C.muted, minWidth: 110, textAlign: 'center' }}>
            {viewStart} – {addDays(viewStart, 2)}
          </Typography>
          <IconButton onClick={() => setViewStart(addDays(viewStart, 3))} size="small"
            sx={{ color: C.muted, border: `1px solid ${C.border}`, borderRadius: '8px' }}>
            <ChevronRightIcon />
          </IconButton>
        </Box>
      </Box>

      {/* ── Calendar Grid ─────────────────────────────── */}
      <Paper sx={{ borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
        {/* Day header row */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: '48px repeat(3, 1fr)',
          borderBottom: `2px solid ${C.border}`,
          background: C.card, position: 'sticky', top: 0, zIndex: 2,
        }}>
          <Box /> {/* spacer for time column */}
          {viewDates.map(d => <DayHeader key={d} date={d} />)}
        </Box>

        {/* Loading spinner */}
        {!loaded ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={28} sx={{ color: C.primary }} />
          </Box>
        ) : (
          HOURS.map(hour => (
            <Box key={hour} sx={{
              display: 'grid',
              gridTemplateColumns: '48px repeat(3, 1fr)',
              borderBottom: `1px solid ${C.border}`,
              '&:last-child': { borderBottom: 'none' },
              minHeight: 72,
            }}>
              {/* Time label */}
              <Box sx={{
                display: 'flex', alignItems: 'flex-start',
                justifyContent: 'flex-end', pr: '6px', pt: '7px',
                borderRight: `1px solid ${C.border}`,
              }}>
                <Typography sx={{ fontSize: '10px', color: C.muted, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {p2(hour)}:00
                </Typography>
              </Box>

              {/* 3 day cells */}
              {viewDates.map(date => {
                const cellSlots = (slotsMap[date] || []).filter(s =>
                  s.start_time.startsWith(p2(hour))
                )
                const isEmpty = cellSlots.length === 0
                return (
                  <Box
                    key={date}
                    onClick={admin && isEmpty ? () => { setCellTarget({ date, hour }); setShowCellDlg(true) } : undefined}
                    sx={{
                      borderLeft: `1px solid ${C.border}`,
                      p: '4px 5px',
                      minHeight: 58,
                      cursor: admin && isEmpty ? 'pointer' : 'default',
                      '&:hover': admin && isEmpty ? { background: C.primaryA5 } : {},
                      display: 'flex', flexDirection: 'column', position: 'relative',
                    }}
                  >
                    {cellSlots.map(slot => (
                      <SlotCell
                        key={slot.id}
                        slot={slot}
                        adminMode={admin}
                        bookings={slotBookings[slot.id] || []}
                        onEdit={s => { setEditTarget(s); setShowEditDlg(true) }}
                        onDelete={handleDeleteSlot}
                        onAddClient={s => { setAddTarget(s); setShowAddDlg(true) }}
                      />
                    ))}
                    {/* Faint "+" hint for empty admin cells */}
                    {admin && isEmpty && (
                      <Box sx={{
                        position: 'absolute', inset: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0, transition: 'opacity 0.15s',
                        '.MuiBox-root:hover > &': { opacity: 1 },
                      }}>
                        <AddIcon sx={{ fontSize: 14, color: C.muted }} />
                      </Box>
                    )}
                  </Box>
                )
              })}
            </Box>
          ))
        )}
      </Paper>

      {/* ── Dialogs ───────────────────────────────────── */}
      <QuickShiftDialog
        open={showShiftDlg}
        onClose={() => setShowShiftDlg(false)}
        onSave={handleCreateShift}
        coaches={coaches}
        defaultDate={viewStart}
        t={t}
      />

      {showCellDlg && cellTarget && (
        <CellAddDialog
          open={showCellDlg}
          onClose={() => setShowCellDlg(false)}
          onSave={handleCreateSlot}
          coaches={coaches}
          date={cellTarget.date}
          hour={cellTarget.hour}
          t={t}
        />
      )}

      {showEditDlg && editTarget && (
        <EditSlotDialog
          open={showEditDlg}
          onClose={() => setShowEditDlg(false)}
          onSave={handleUpdateSlot}
          slot={editTarget}
          coaches={coaches}
          t={t}
        />
      )}

      {showAddDlg && addTarget && (
        <AddClientDialog
          open={showAddDlg}
          onClose={() => setShowAddDlg(false)}
          onAdd={handleAddClient}
          slot={addTarget}
          realClients={realClients}
          t={t}
        />
      )}
    </Box>
  )
}
