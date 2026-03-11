import { useEffect, useState } from 'react'
import {
  Box, Typography, Paper, Button, Chip, CircularProgress, Divider, Alert,
} from '@mui/material'
import CalendarMonthIcon    from '@mui/icons-material/CalendarMonth'
import AccessTimeIcon       from '@mui/icons-material/AccessTime'
import FitnessCenterIcon    from '@mui/icons-material/FitnessCenter'
import PeopleIcon           from '@mui/icons-material/People'
import EventAvailableIcon   from '@mui/icons-material/EventAvailable'
import CreditCardIcon       from '@mui/icons-material/CreditCard'
import CheckCircleIcon      from '@mui/icons-material/CheckCircle'
import { useApp }           from '../context/AppContext'
import { useBooking }       from '../context/BookingContext'
import { C }                from '../theme'
import {
  canClientBook, canClientCancel,
  groupByDate, dayLabel, fmtTime, fmtValidTo,
  occupancyStr, placesLeftStr, isPlanActive, creditsRemaining,
  planLabel, isoToday,
} from '../lib/bookingUtils'

// ── Plan Status Card ─────────────────────────────────────────
function PlanCard({ plan, t, lang }) {
  if (!plan || !isPlanActive(plan)) {
    return (
      <Paper sx={{ p: 2.5, mb: 2, borderRadius: '16px', border: `1px solid rgba(248,113,113,0.3)`, background: 'rgba(248,113,113,0.06)' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <CreditCardIcon sx={{ fontSize: 18, color: '#F87171' }} />
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: '#F87171' }}>
            {t('myPlanTitle')}
          </Typography>
        </Box>
        <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noPlanDesc')}</Typography>
      </Paper>
    )
  }

  const rem      = creditsRemaining(plan)
  const isUnlim  = plan.plan_type === 'unlimited'
  const validTo  = fmtValidTo(plan, lang)

  return (
    <Paper sx={{
      p: 2.5, mb: 2, borderRadius: '16px',
      border: `1px solid ${C.primaryA20}`,
      background: 'linear-gradient(135deg, rgba(196,233,191,0.08) 0%, rgba(196,233,191,0.04) 100%)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CreditCardIcon sx={{ fontSize: 18, color: C.primary }} />
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.primary }}>
            {t('myPlanTitle')}
          </Typography>
        </Box>
        <Chip
          label={planLabel(plan.plan_type)}
          size="small"
          sx={{ background: C.primaryContainer, color: C.primary, fontWeight: 700, fontSize: '11px' }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('creditsLeft')}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '22px', color: C.text, lineHeight: 1.2 }}>
            {isUnlim ? '∞' : rem}
            {!isUnlim && (
              <Box component="span" sx={{ fontSize: '13px', color: C.muted, fontWeight: 400, ml: 0.5 }}>
                {t('creditsOf')} {plan.credits_total}
              </Box>
            )}
          </Typography>
        </Box>
        <Divider orientation="vertical" flexItem sx={{ borderColor: C.border }} />
        <Box>
          <Typography sx={{ fontSize: '11px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {t('validUntil')}
          </Typography>
          <Typography sx={{ fontWeight: 600, fontSize: '14px', color: C.text }}>
            {validTo}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

// ── Next Booking Card ────────────────────────────────────────
function NextBookingCard({ slots, myBookings, t, lang }) {
  const nextBookedSlot = slots
    .filter(s => myBookings.some(b => b.slot_id === s.id && b.status === 'active'))
    .sort((a, b) => (a.slot_date + a.start_time).localeCompare(b.slot_date + b.start_time))[0]

  if (!nextBookedSlot) return null

  return (
    <Paper sx={{
      p: 2.5, mb: 2, borderRadius: '16px',
      border: `1px solid rgba(196,233,191,0.2)`,
      background: 'linear-gradient(135deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.04) 100%)',
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <EventAvailableIcon sx={{ fontSize: 18, color: C.primary }} />
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.primary }}>
          {t('nextTraining')}
        </Typography>
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '16px', color: C.text, mb: 0.5 }}>
        {dayLabel(nextBookedSlot.slot_date, lang)}
      </Typography>
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <AccessTimeIcon sx={{ fontSize: 14, color: C.muted }} />
          <Typography sx={{ fontSize: '13px', color: C.muted }}>
            {fmtTime(nextBookedSlot.start_time)} – {fmtTime(nextBookedSlot.end_time)}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FitnessCenterIcon sx={{ fontSize: 14, color: C.muted }} />
          <Typography sx={{ fontSize: '13px', color: C.muted }}>
            {nextBookedSlot.coach_name}
          </Typography>
        </Box>
      </Box>
    </Paper>
  )
}

// ── Single Slot Row ──────────────────────────────────────────
function SlotRow({ slot, plan, myBookings, onBook, onCancel, busy, t, lang }) {
  const [actionErr, setActionErr] = useState('')
  const isBooked = myBookings.some(b => b.slot_id === slot.id && b.status === 'active')
  const bookCheck   = !isBooked ? canClientBook(slot, plan, myBookings)   : { ok: false }
  const cancelCheck = isBooked  ? canClientCancel(slot)                    : { ok: false }
  const isFull      = (slot.booked_count || 0) >= slot.capacity
  const isPast      = new Date(`${slot.slot_date}T${slot.start_time}`) <= new Date()

  async function handleBook() {
    setActionErr('')
    const res = await onBook(slot.id)
    if (res?.error) setActionErr(res.error)
  }

  async function handleCancel() {
    setActionErr('')
    const res = await onCancel(slot.id)
    if (res?.error) setActionErr(res.error)
  }

  const placesText = placesLeftStr(slot.booked_count || 0, slot.capacity, lang)

  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1.5,
      py: 1.5, px: 2,
      borderBottom: `1px solid ${C.border}`,
      '&:last-child': { borderBottom: 'none' },
      opacity: isPast ? 0.5 : 1,
    }}>
      {/* Time */}
      <Box sx={{ minWidth: 72, flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, lineHeight: 1.2 }}>
          {fmtTime(slot.start_time)}
        </Typography>
        <Typography sx={{ fontSize: '11px', color: C.muted }}>
          {fmtTime(slot.end_time)}
        </Typography>
      </Box>

      {/* Coach + occupancy */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FitnessCenterIcon sx={{ fontSize: 13, color: C.muted }} />
          <Typography sx={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
            {slot.coach_name}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
          <PeopleIcon sx={{ fontSize: 12, color: isFull ? '#F87171' : C.muted }} />
          <Typography sx={{ fontSize: '11px', color: isFull ? '#F87171' : C.muted }}>
            {occupancyStr(slot.booked_count || 0, slot.capacity)}
            {!isFull && ` · ${placesText}`}
          </Typography>
        </Box>
        {actionErr && (
          <Typography sx={{ fontSize: '11px', color: '#F87171', mt: 0.25 }}>
            {actionErr}
          </Typography>
        )}
      </Box>

      {/* Button */}
      <Box sx={{ flexShrink: 0 }}>
        {isPast ? (
          <Chip label={lang === 'bg' ? 'Минал' : 'Past'} size="small"
            sx={{ fontSize: '10px', color: C.muted, borderColor: C.border, background: 'transparent' }} />
        ) : isBooked ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <CheckCircleIcon sx={{ fontSize: 14, color: C.primary }} />
              <Typography sx={{ fontSize: '11px', color: C.primary, fontWeight: 700 }}>
                {t('bookedLabel')}
              </Typography>
            </Box>
            {cancelCheck.ok ? (
              <Button size="small" variant="outlined" disabled={busy} onClick={handleCancel}
                sx={{ fontSize: '10px', py: 0.25, px: 1, borderColor: C.border, color: C.muted,
                  '&:hover': { borderColor: '#F87171', color: '#F87171' },
                  minWidth: 0, lineHeight: 1.5 }}>
                {t('cancelBookingBtn')}
              </Button>
            ) : (
              <Typography sx={{ fontSize: '10px', color: C.muted }}>
                {cancelCheck.reason}
              </Typography>
            )}
          </Box>
        ) : isFull ? (
          <Chip label={t('fullLabel')} size="small" variant="outlined"
            sx={{ fontSize: '11px', borderColor: '#F87171', color: '#F87171' }} />
        ) : bookCheck.ok ? (
          <Button size="small" variant="contained" disabled={busy} onClick={handleBook}
            sx={{
              background: C.primary, color: '#0f1c11', fontWeight: 700,
              fontSize: '12px', py: 0.75, px: 1.5, borderRadius: '10px',
              '&:hover': { background: '#a8e6a3' },
              '&.Mui-disabled': { opacity: 0.5 },
            }}>
            {busy ? <CircularProgress size={14} sx={{ color: '#0f1c11' }} /> : t('bookBtn')}
          </Button>
        ) : (
          <Chip label={bookCheck.reason || t('unavailableLabel')} size="small"
            sx={{ fontSize: '10px', maxWidth: 120, height: 'auto',
              '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5 },
              color: C.muted, background: 'rgba(255,255,255,0.05)', border: `1px solid ${C.border}` }} />
        )}
      </Box>
    </Box>
  )
}

// ── Main Booking Page ────────────────────────────────────────
export default function Booking() {
  const { auth, t, lang } = useApp()
  const {
    slots, myBookings, myPlan, bookingBusy,
    loadSlots, loadMyBookings, loadMyPlan,
    bookSlot, cancelBookingForSlot,
  } = useBooking()

  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!auth.id || loaded) return
    async function init() {
      await Promise.all([
        loadSlots(),
        loadMyBookings(auth.id),
        loadMyPlan(auth.id),
      ])
      setLoaded(true)
    }
    init()
  }, [auth.id])

  async function handleBook(slotId) {
    const res = await bookSlot(slotId)
    return res
  }

  async function handleCancel(slotId) {
    const res = await cancelBookingForSlot(slotId)
    return res
  }

  const grouped = groupByDate(slots)
  const dates   = Object.keys(grouped).sort()

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: C.text }}>
        {t('bookingTitle')}
      </Typography>

      {/* Plan card */}
      <PlanCard plan={myPlan} t={t} lang={lang} />

      {/* Next booking */}
      <NextBookingCard slots={slots} myBookings={myBookings} t={t} lang={lang} />

      {/* Loading */}
      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} sx={{ color: C.primary }} />
        </Box>
      ) : dates.length === 0 ? (
        <Paper sx={{ p: 4, borderRadius: '16px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <CalendarMonthIcon sx={{ fontSize: 40, color: C.muted, mb: 1 }} />
          <Typography sx={{ color: C.muted }}>{t('noSlots')}</Typography>
        </Paper>
      ) : (
        dates.map(date => (
          <Paper key={date} sx={{ mb: 2, borderRadius: '16px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {/* Day header */}
            <Box sx={{
              px: 2, py: 1.25,
              background: 'rgba(255,255,255,0.04)',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex', alignItems: 'center', gap: 1,
            }}>
              <CalendarMonthIcon sx={{ fontSize: 15, color: C.muted }} />
              <Typography sx={{
                fontWeight: 700, fontSize: '13px',
                color: date === isoToday() ? C.primary : C.text,
                textTransform: 'capitalize',
              }}>
                {dayLabel(date, lang)}
              </Typography>
            </Box>

            {/* Slots */}
            {grouped[date].map(slot => (
              <SlotRow
                key={slot.id}
                slot={slot}
                plan={myPlan}
                myBookings={myBookings}
                onBook={handleBook}
                onCancel={handleCancel}
                busy={bookingBusy}
                t={t}
                lang={lang}
              />
            ))}
          </Paper>
        ))
      )}
    </Box>
  )
}
