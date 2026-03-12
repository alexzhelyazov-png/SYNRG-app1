import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Chip, Paper, Switch, Collapse, Tabs, Tab } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useApp } from '../context/AppContext'
import { useBooking } from '../context/BookingContext'
import { WORKOUT_CATEGORIES } from '../lib/constants'
import { C, EASE } from '../theme'
import StatCard    from '../components/StatCard'
import ProgressRing from '../components/ProgressRing'
import Tasks       from './Tasks'
import FoodTracker from './FoodTracker'
import WeightTracker from './WeightTracker'
import { todayDate, fmt1 } from '../lib/utils'
import { computeReminders } from '../lib/reminders'
import { creditsRemaining, isoToday } from '../lib/bookingUtils'

// ─── Reminder banners (client) ───────────────────────────────────
function ReminderBanners() {
  const { client, t, setView, dismissReaction, updateReminderSettings } = useApp()
  const [localDismissed, setLocalDismissed] = useState({})
  const [settingsOpen,   setSettingsOpen]   = useState(false)

  const allReminders = computeReminders(client)
  const visible = allReminders.filter(r => !localDismissed[r.id])

  function dismiss(id, reactionId) {
    setLocalDismissed(p => ({ ...p, [id]: true }))
    if (reactionId) dismissReaction(reactionId)
  }

  const settings = client.reminderSettings || {}

  if (visible.length === 0 && !settingsOpen) {
    return (
      <Box sx={{ mb: 2.5, display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          size="small"
          onClick={() => setSettingsOpen(true)}
          sx={{ color: C.muted, fontSize: '12px', '&:hover': { color: C.primary } }}
        >
          {t('remindersTitle')}
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ mb: 2.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      {visible.map(r => {
        let icon, msg, actions = null

        if (r.type === 'protein') {
          icon = 'P'
          msg  = t('reminderProteinMsg')
            .replace('{cur}',    r.current)
            .replace('{needed}', r.needed)
            .replace('{tgt}',    r.target)
          actions = (
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              {[
                [t('addShake')],
                [t('addSkyr')],
                [t('addChicken')],
              ].map(([label]) => (
                <Button
                  key={label}
                  size="small"
                  variant="outlined"
                  onClick={() => { setView('food'); dismiss(r.id) }}
                  sx={{
                    fontSize: '12px', py: '3px', px: 1.25,
                    borderRadius: '99px', borderColor: C.primaryA20,
                    color: C.primary, '&:hover': { background: C.accentSoft },
                  }}
                >{label}</Button>
              ))}
            </Box>
          )
        } else if (r.type === 'weight') {
          icon = 'W'
          msg  = r.daysSince === null
            ? t('reminderWeightFirst')
            : t('reminderWeightMsg').replace('{days}', r.daysSince)
          actions = (
            <Button size="small" onClick={() => { setView('weight'); dismiss(r.id) }}
              sx={{ mt: 0.75, fontSize: '12px', color: C.purple, p: 0 }}>
              → {t('navWeight')}
            </Button>
          )
        } else if (r.type === 'foodLog') {
          icon = 'F'
          msg  = t('reminderFoodMsg')
          actions = (
            <Button size="small" onClick={() => { setView('food'); dismiss(r.id) }}
              sx={{ mt: 0.75, fontSize: '12px', color: C.primary, p: 0 }}>
              → {t('navFood')}
            </Button>
          )
        } else if (r.type === 'coach') {
          icon = r.reactionType === 'like' ? '+' : '»'
          msg  = r.reactionType === 'like'
            ? `${r.trainerName}: Браво!`
            : `${r.trainerName}: "${r.message}"`
        }

        return (
          <Box
            key={r.id}
            sx={{
              display:      'flex',
              alignItems:   'flex-start',
              gap:          1.25,
              p:            '12px 14px',
              mb:           1,
              background:   r.type === 'coach' ? C.accentSoft : 'rgba(255,255,255,0.04)',
              border:       `1px solid ${r.type === 'coach' ? C.primaryA20 : C.border}`,
              borderRadius: '14px',
            }}
          >
            <Box sx={{
              width: 28, height: 28, borderRadius: '8px',
              background: r.type === 'coach' ? C.primary : C.border,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 800, color: r.type === 'coach' ? '#0A2E0F' : C.muted,
              flexShrink: 0,
            }}>
              {icon}
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '13.5px', color: C.text, fontWeight: r.type === 'coach' ? 600 : 400 }}>
                {msg}
              </Typography>
              {actions}
            </Box>
            <Button
              size="small"
              onClick={() => dismiss(r.id, r.reactionId)}
              sx={{ color: C.muted, minWidth: 'auto', p: '2px 6px', fontSize: '12px',
                '&:hover': { color: C.text } }}
            >
              {t('dismissLbl')}
            </Button>
          </Box>
        )
      })}

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Button
          size="small"
          onClick={() => setSettingsOpen(p => !p)}
          sx={{ color: C.muted, fontSize: '12px', '&:hover': { color: C.primary } }}
        >
          {t('reminderSettingsTitle')}
        </Button>
      </Box>

      <Collapse in={settingsOpen}>
        <Paper sx={{ p: 2, mt: 1, border: `1px solid ${C.border}` }}>
          {[
            ['protein',  t('proteinReminderLbl')],
            ['weight',   t('weightReminderLbl')],
            ['foodLog',  t('foodLogReminderLbl')],
            ['coach',    t('coachReminderLbl')],
          ].map(([key, label]) => (
            <Box key={key} sx={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              py: 0.75,
              borderBottom: key !== 'coach' ? `1px solid ${C.border}` : 'none',
            }}>
              <Typography sx={{ fontSize: '13.5px' }}>{label}</Typography>
              <Switch
                size="small"
                checked={settings[key] !== false}
                onChange={e => updateReminderSettings({ ...settings, [key]: e.target.checked })}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': { color: C.primary },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: C.primary },
                }}
              />
            </Box>
          ))}
        </Paper>
      </Collapse>
    </Box>
  )
}

// ─── Coach react panel ───────────────────────────────────────────
function CoachReactPanel() {
  const { t, sendReaction } = useApp()
  const [msg,     setMsg]     = useState('')
  const [showMsg, setShowMsg] = useState(false)

  return (
    <Paper sx={{
      p:         2.25,
      mb:        2.5,
      border:    `1px solid var(--c-primaryA13)`,
      animation: `fadeInUp 0.3s ${EASE.decelerate} 0.12s both`,
    }}>
      <Typography variant="h3" sx={{ mb: 1.75 }}>{t('reactSectionTitle')}</Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Button
          variant="outlined"
          size="small"
          onClick={() => { sendReaction('like', ''); setShowMsg(false) }}
          sx={{
            borderRadius:'99px', borderColor: C.primaryA20,
            color: C.primary, fontWeight: 700,
            '&:hover': { background: C.accentSoft, borderColor: C.primary },
          }}
        >
          {t('reactLikeBtn')}
        </Button>
        <Button
          variant="outlined"
          size="small"
          onClick={() => setShowMsg(p => !p)}
          sx={{
            borderRadius:'99px', borderColor: C.border,
            color: C.muted, fontWeight: 600,
            '&:hover': { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
          }}
        >
          {t('reactTextBtn')}
        </Button>
      </Box>
      <Collapse in={showMsg}>
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          <TextField
            size="small"
            fullWidth
            placeholder={t('reactionPlaceholder')}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                sendReaction('text', msg)
                setMsg('')
                setShowMsg(false)
              }
            }}
            inputProps={{ style: { fontSize: '14px' } }}
          />
          <Button
            variant="contained"
            size="small"
            disabled={!msg.trim()}
            onClick={() => { sendReaction('text', msg); setMsg(''); setShowMsg(false) }}
            sx={{ px: 2, flexShrink: 0 }}
          >
            {t('reactionSendBtn')}
          </Button>
        </Box>
      </Collapse>
    </Paper>
  )
}

// ─── Client progress section (shown in coach view) ───────────────
function ClientProgressSection() {
  const { client, t, latestAvg, weeklyRate, sendReaction } = useApp()
  const [msgOpen,     setMsgOpen]     = useState(false)
  const [msg,         setMsg]         = useState('')
  const [historyOpen, setHistoryOpen] = useState(false)

  // Last 7 days in YYYY-MM-DD
  const today = new Date()
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today)
    d.setDate(d.getDate() - (6 - i))
    return d.toISOString().slice(0, 10)
  })

  // Sum calories per day
  const kcalByDate = {}
  ;(client.meals || []).forEach(m => {
    if (m.date && last7.includes(m.date)) {
      kcalByDate[m.date] = (kcalByDate[m.date] || 0) + (m.calories || 0)
    }
  })

  const target  = client.calorieTarget || 2000
  const DAY_BG  = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
  const dayData = last7.map(date => {
    const kcal   = kcalByDate[date] || 0
    const pct    = Math.min(kcal / target, 1)
    const logged = kcal > 0
    return { date, kcal, pct, logged }
  })

  return (
    <Paper sx={{
      p: 2.25, mb: 2.5,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      animation: `fadeInUp 0.26s ${EASE.decelerate} 0.04s both`,
    }}>
      {/* Header + message button */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h3">Progress</Typography>
        <Button
          size="small"
          onClick={() => setMsgOpen(p => !p)}
          sx={{
            fontSize: '12px', borderRadius: '99px', px: 1.5, py: '4px',
            color: msgOpen ? C.primary : C.muted,
            background: msgOpen ? C.accentSoft : 'transparent',
            border: `1px solid ${msgOpen ? C.primaryA20 : C.border}`,
            '&:hover': { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
          }}
        >
          💬 {t('reactTextBtn')}
        </Button>
      </Box>

      {/* Inline message form */}
      <Collapse in={msgOpen}>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <TextField
            size="small" fullWidth
            placeholder={t('reactionPlaceholder')}
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                sendReaction('text', msg); setMsg(''); setMsgOpen(false)
              }
            }}
            inputProps={{ style: { fontSize: '13px' } }}
          />
          <Button
            variant="contained" size="small"
            disabled={!msg.trim()}
            onClick={() => { sendReaction('text', msg); setMsg(''); setMsgOpen(false) }}
            sx={{ px: 2, flexShrink: 0 }}
          >
            {t('reactionSendBtn')}
          </Button>
        </Box>
      </Collapse>

      {/* Weight stats */}
      <Box sx={{ display: 'flex', gap: 2.5, mb: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            {t('sevenDayAvg')}
          </Typography>
          <Typography sx={{ fontSize: '22px', fontWeight: 800, color: C.purple, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1 }}>
            {latestAvg !== null ? `${fmt1(latestAvg)} кг` : '—'}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.3, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
            Weekly Rate
          </Typography>
          <Typography sx={{
            fontSize: '22px', fontWeight: 800, fontFamily: "'Space Grotesk', sans-serif", lineHeight: 1.1,
            color: weeklyRate === null ? C.muted : weeklyRate > 0 ? C.orange : C.primary,
          }}>
            {weeklyRate !== null ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}` : '—'}
          </Typography>
        </Box>
      </Box>

      {/* 7-day calorie bars */}
      <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
        Калории — последните 7 дни
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        {dayData.map(({ date, kcal, pct, logged }) => {
          const weekday = new Date(date + 'T12:00:00').getDay()
          const barH    = logged ? Math.max(12, Math.round(Math.min(pct, 1) * 40)) : 3
          return (
            <Box key={date} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: '100%', height: '44px', display: 'flex', alignItems: 'flex-end' }}>
                <Box sx={{
                  width: '100%', height: `${barH}px`,
                  borderRadius: '4px',
                  background: logged
                    ? (pct >= 0.85 ? C.primary : 'rgba(196,233,191,0.45)')
                    : 'rgba(255,255,255,0.06)',
                  transition: `height 0.3s ${EASE.standard}`,
                }} />
              </Box>
              <Typography sx={{ fontSize: '10px', color: C.muted, lineHeight: 1 }}>
                {DAY_BG[weekday]}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* History toggle */}
      <Button
        size="small" fullWidth
        onClick={() => setHistoryOpen(p => !p)}
        sx={{ mt: 1.5, fontSize: '12px', color: historyOpen ? C.primary : C.muted,
          borderRadius: '8px', py: '4px', justifyContent: 'center',
          background: historyOpen ? C.accentSoft : 'transparent',
          border: `1px solid ${historyOpen ? C.primaryA20 : C.border}`,
          '&:hover': { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
        }}
      >
        {historyOpen ? 'Скрий история ↑' : 'История на храна и тегло ↓'}
      </Button>

      {/* Expandable history */}
      <Collapse in={historyOpen}>
        <Box sx={{ mt: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>

          {/* Food log */}
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
              Хранителен дневник
            </Typography>
            {(client.meals || []).length === 0 ? (
              <Typography sx={{ fontSize: '12px', color: C.muted }}>Няма записи</Typography>
            ) : [...(client.meals || [])].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 10).map((m, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: '5px', borderBottom: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: '12px', color: C.muted }}>{m.date}</Typography>
                <Box sx={{ display: 'flex', gap: 1.5 }}>
                  <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.text }}>{m.calories || 0} kcal</Typography>
                  <Typography sx={{ fontSize: '12px', color: C.purple }}>{m.protein || 0}g</Typography>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Weight log */}
          <Box>
            <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
              История на тегло
            </Typography>
            {(client.weightLogs || []).length === 0 ? (
              <Typography sx={{ fontSize: '12px', color: C.muted }}>Няма записи</Typography>
            ) : [...(client.weightLogs || [])].sort((a, b) => b.date?.localeCompare(a.date)).slice(0, 10).map((w, i) => (
              <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                py: '5px', borderBottom: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: '12px', color: C.muted }}>{w.date}</Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>{w.weight} кг</Typography>
              </Box>
            ))}
          </Box>

        </Box>
      </Collapse>
    </Paper>
  )
}

// ─── Remaining sessions + upcoming bookings (coach view for a client) ─
function ClientSessionSummary() {
  const { client } = useApp()
  const { allPlans, loadAllPlans, slots, slotBookings, bookingBusy, cancelBookingForClient } = useBooking()
  const [cancelErr, setCancelErr] = useState({})

  useEffect(() => { loadAllPlans() }, []) // eslint-disable-line

  const plan    = (allPlans || []).find(p => p.client_id === client.id && p.status === 'active')
  const remCred = plan ? creditsRemaining(plan) : null
  const today   = isoToday()

  // Find upcoming bookings for this client (with booking record for cancel)
  const upcoming = (slots || [])
    .filter(s => s.slot_date >= today && s.status !== 'cancelled')
    .map(s => ({ slot: s, booking: (slotBookings[s.id] || []).find(b => b.client_id === client.id) }))
    .filter(({ booking }) => !!booking)
    .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))
    .slice(0, 5)

  async function handleCancel(slotId) {
    setCancelErr({})
    const res = await cancelBookingForClient(slotId, client.id)
    if (res?.error) setCancelErr(prev => ({ ...prev, [slotId]: res.error }))
  }

  if (!plan && upcoming.length === 0) return null

  return (
    <Paper sx={{
      p: 2, mb: 2.5,
      border: `1px solid ${C.border}`, borderRadius: '16px',
      animation: `fadeInUp 0.28s ${EASE.decelerate} 0.06s both`,
    }}>
      <Typography variant="h3" sx={{ mb: 1.5 }}>Sessions</Typography>
      <Box sx={{ display: 'flex', gap: 3, mb: upcoming.length > 0 ? 1.5 : 0, flexWrap: 'wrap' }}>
        {plan && (
          <Box>
            <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.3 }}>
              Remaining
            </Typography>
            <Typography sx={{ fontSize: '22px', fontWeight: 800, color: C.primary, lineHeight: 1.1, fontFamily: "'Space Grotesk', sans-serif" }}>
              {plan.plan_type === 'unlimited' ? '∞' : `${remCred} / ${plan.credits_total}`}
            </Typography>
          </Box>
        )}
      </Box>
      {upcoming.length > 0 && (
        <>
          <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px', mb: 0.75 }}>
            Upcoming Sessions
          </Typography>
          {upcoming.map(({ slot, booking }) => (
            <Box key={slot.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              py: '7px', borderBottom: `1px solid ${C.border}`, gap: 1 }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                  {slot.slot_date} · {slot.start_time?.slice(0, 5)}
                </Typography>
                <Typography sx={{ fontSize: '11.5px', color: C.muted }}>{slot.coach_name}</Typography>
                {cancelErr[slot.id] && (
                  <Typography sx={{ fontSize: '11px', color: '#F87171', mt: 0.25 }}>{cancelErr[slot.id]}</Typography>
                )}
              </Box>
              <Button size="small" variant="outlined" disabled={bookingBusy}
                onClick={() => handleCancel(slot.id)}
                sx={{ fontSize: '11px', py: 0.4, px: 1.25, flexShrink: 0,
                  borderColor: C.border, color: C.muted,
                  '&:hover': { borderColor: '#F87171', color: '#F87171', background: 'rgba(248,113,113,0.08)' } }}>
                Cancel
              </Button>
            </Box>
          ))}
        </>
      )}
    </Paper>
  )
}

// ─── Today's schedule (shown at top of coach dashboard) ──────────
function TodayScheduleCard() {
  const { auth } = useApp()
  const { slots, slotBookings } = useBooking()
  const todayStr = new Date().toISOString().slice(0, 10)
  const todaySlots = (slots || [])
    .filter(s => s.slot_date === todayStr && s.status !== 'cancelled' && s.coach_name === auth.name)
    .sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''))

  if (todaySlots.length === 0) return null

  return (
    <Paper sx={{
      p: 2, mb: 2.5,
      border: `1px solid ${C.border}`,
      borderRadius: '16px',
      animation: `fadeInUp 0.22s ${EASE.decelerate} both`,
    }}>
      <Typography variant="h3" sx={{ mb: 1.25 }}>Today's Schedule</Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {todaySlots.map((s, i) => {
          const bookings = slotBookings[s.id] || []
          return (
            <Box key={s.id || i} sx={{
              py: 0.75, px: 1.25,
              background: s.booked_count > 0 ? C.accentSoft : 'rgba(255,255,255,0.03)',
              border: `1px solid ${s.booked_count > 0 ? C.primaryA20 : C.border}`,
              borderRadius: '10px',
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Typography sx={{
                  fontSize: '13.5px', fontWeight: 700, color: C.primary,
                  minWidth: '50px', fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {(s.start_time || '').slice(0, 5)}
                </Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: s.booked_count > 0 ? C.primary : C.muted }}>
                  {s.booked_count}/{s.capacity}
                </Typography>
              </Box>
              {bookings.length > 0 && (
                <Box sx={{ mt: 0.4, pl: '58px' }}>
                  {bookings.map((b, j) => (
                    <Typography key={j} sx={{ fontSize: '12px', color: C.text, lineHeight: 1.5 }}>
                      {b.client_name}
                    </Typography>
                  ))}
                </Box>
              )}
            </Box>
          )
        })}
      </Box>
    </Paper>
  )
}

// ─── Coach dashboard (schedule + ranking only) ───────────────────
function DashboardCoach() {
  const { ranking } = useApp()

  return (
    <>
      <TodayScheduleCard />
      {ranking.length > 0 && (
        <Paper sx={{ p: 2, mb: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px', animation: `fadeInUp 0.24s ${EASE.decelerate} 0.04s both` }}>
          <Typography variant="h3" sx={{ mb: 1.25 }}>Rankings</Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {ranking.slice(0, 10).map((r, i) => (
              <Box key={r.name} sx={{
                display: 'flex', alignItems: 'center', gap: 1.5,
                py: '6px', px: 1, borderRadius: '8px',
                background: i === 0 ? C.accentSoft : 'transparent',
              }}>
                <Typography sx={{
                  fontSize: '12px', fontWeight: 800, color: i === 0 ? C.primary : C.muted,
                  minWidth: '22px', textAlign: 'right', fontFamily: "'Space Grotesk', sans-serif",
                }}>#{i + 1}</Typography>
                <Typography sx={{ flex: 1, fontSize: '13.5px', fontWeight: i === 0 ? 700 : 500, color: C.text }}>{r.name}</Typography>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: i === 0 ? C.primary : C.muted, fontFamily: "'Space Grotesk', sans-serif" }}>
                  {r.points} т.
                </Typography>
              </Box>
            ))}
          </Box>
        </Paper>
      )}
    </>
  )
}

// ─── Client detail view (shown when coach selects any client) ─────
export function ClientDetail() {
  const {
    client, t,
    setCoachClientMode,
    exName, setExName, exScheme, setExScheme, exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    addExercise, saveWorkout,
    updateClient, updateClientTargets,
  } = useApp()

  const isMobile = window.innerWidth < 640

  return (
    <>
      {/* ── Back button ── */}
      <Box sx={{ mb: 1.5, animation: `fadeInUp 0.18s ${EASE.decelerate} both` }}>
        <Button
          size="small"
          onClick={() => setCoachClientMode(false)}
          startIcon={<ArrowBackIcon />}
          sx={{ color: C.muted, '&:hover': { color: C.primary }, pl: 0 }}
        >
          Back
        </Button>
      </Box>

      {/* ── "Данните на:" header + target inputs ── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        mb: 2.5, gap: 2, flexWrap: 'wrap',
        animation: `fadeInUp 0.22s ${EASE.decelerate} both`,
      }}>
        <Box>
          <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 0.4 }}>
            Данните на
          </Typography>
          <Typography variant="h2" sx={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            {client.name || '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            type="number"
            placeholder={t('kcalTargetLbl')}
            value={client.calorieTarget}
            onChange={e => {
              const v = Number(e.target.value)
              if (!isNaN(v)) {
                updateClient(c => ({ ...c, calorieTarget: v }))
                updateClientTargets(client.id, v, client.proteinTarget)
              }
            }}
            sx={{ width: '100px' }}
            inputProps={{ style: { fontSize: '13px', padding: '8px 10px' } }}
          />
          <TextField
            type="number"
            placeholder={t('protTargetGLbl')}
            value={client.proteinTarget}
            onChange={e => {
              const v = Number(e.target.value)
              if (!isNaN(v)) {
                updateClient(c => ({ ...c, proteinTarget: v }))
                updateClientTargets(client.id, client.calorieTarget, v)
              }
            }}
            sx={{ width: '96px' }}
            inputProps={{ style: { fontSize: '13px', padding: '8px 10px' } }}
          />
        </Box>
      </Box>

      {/* ── Client progress & messaging ── */}
      <ClientProgressSection />

      {/* ── Workout Builder ── */}
      <Paper sx={{
        border:       `1px solid rgba(196,233,191,0.25)`,
        borderRadius: '20px',
        p:            3,
        mb:           2.5,
        background:   'linear-gradient(145deg, rgba(196,233,191,0.04) 0%, #1C1A19 100%)',
        boxShadow:    '0 0 0 1px rgba(196,233,191,0.08), 0 8px 32px rgba(0,0,0,0.3)',
        animation:    `fadeInUp 0.28s ${EASE.decelerate} 0.06s both`,
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.25 }}>
          <Box sx={{
            width: 8, height: 8, borderRadius: '99px',
            background: C.primary, boxShadow: `0 0 10px ${C.primaryGlow}`,
            flexShrink: 0, animation: `pulse 2.5s ${EASE.standard} infinite`,
          }} />
          <Typography variant="h3">{t('workout')} — {todayDate()}</Typography>
        </Box>

        {/* Category chips */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
          {WORKOUT_CATEGORIES.map(({ key }) => {
            const active = workoutCategory === key
            return (
              <Chip
                key={key}
                label={t(key)}
                onClick={() => setWorkoutCategory(key)}
                sx={{
                  background: active ? C.primary : 'rgba(255,255,255,0.04)',
                  color:      active ? '#0A2E0F' : C.text,
                  border:     `1px solid ${active ? C.primary : C.border}`,
                  fontWeight: active ? 800 : 500,
                  fontSize:   '13px',
                  cursor:     'pointer',
                  transition: `all 0.18s ${EASE.spring}`,
                  '&:hover':  { background: active ? C.primaryHover : C.accentSoft, transform: 'translateY(-1px)' },
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
            )
          })}
        </Box>

        {/* Exercise inputs */}
        <Box sx={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto',
          gap: 1.25, mb: 1.75, alignItems: 'end',
        }}>
          {[
            { labelKey: 'exerciseLbl', placeholder: t('exPlaceholder'), value: exName,   onChange: e => setExName(e.target.value) },
            { labelKey: 'setsReps',    placeholder: '4×8',              value: exScheme, onChange: e => setExScheme(e.target.value) },
            { labelKey: 'kgLbl',       placeholder: '80',               value: exWeight, onChange: e => setExWeight(e.target.value) },
          ].map(({ labelKey, placeholder, value, onChange }) => (
            <Box key={labelKey}>
              <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.6, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                {t(labelKey)}
              </Typography>
              <TextField
                fullWidth
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onKeyDown={e => e.key === 'Enter' && addExercise()}
                inputProps={{ style: { fontSize: '15px', padding: '12px 14px' } }}
              />
            </Box>
          ))}
          <Button
            variant="contained" color="primary" onClick={addExercise}
            sx={{ py: '13px', px: 2.5, fontSize: '22px', alignSelf: 'flex-end', minWidth: '48px' }}
          >+</Button>
        </Box>

        {/* Current exercises list */}
        {currentWorkout.length > 0 && (
          <Box sx={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${C.border}`, borderRadius: '14px', p: 1.75, mb: 2 }}>
            <Typography sx={{ fontSize: '11px', color: C.muted, mb: 1.25, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
              {t(workoutCategory)} · {currentWorkout.length} {t('exercisesLbl')}
            </Typography>
            {currentWorkout.map((ex, i) => (
              <Box key={i} sx={{
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr 80px auto' : '1fr 110px 80px auto',
                gap: 1, py: 1.1,
                borderBottom: i < currentWorkout.length - 1 ? `1px solid ${C.border}` : 'none',
                alignItems: 'center',
              }}>
                <Typography sx={{ fontWeight: 600, fontSize: '14.5px' }}>{ex.exercise}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.scheme}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.weight} {t('kgUnit')}</Typography>
                <Button
                  size="small"
                  onClick={() => setCurrentWorkout(prev => prev.filter((_, j) => j !== i))}
                  sx={{ minWidth: 'auto', background: C.dangerSoft, color: C.danger, border: '1px solid rgba(255,107,157,0.2)', borderRadius: '10px', px: 1.25, py: '4px', fontSize: '13px' }}
                >×</Button>
              </Box>
            ))}
          </Box>
        )}

        {/* Save button */}
        <Button
          variant="contained" fullWidth disabled={!currentWorkout.length} onClick={saveWorkout}
          sx={{
            py: 1.875, fontSize: '15px', fontWeight: 800, letterSpacing: '0.3px',
            background: currentWorkout.length ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})` : 'rgba(255,255,255,0.06)',
            color: currentWorkout.length ? C.primaryOn : 'rgba(255,255,255,0.3)',
            '&.Mui-disabled': { background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.3)' },
          }}
        >
          {t('saveWorkout')} ({currentWorkout.length} {t('exercisesLbl')})
        </Button>
      </Paper>

      {/* ── Workout history ── */}
      <Paper sx={{ p: 2.75, animation: `fadeInUp 0.3s ${EASE.decelerate} 0.1s both` }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('workoutHistory')}</Typography>
        {client.workouts.length === 0 ? (
          <Typography sx={{ color: C.muted, py: 1 }}>{t('noWorkouts')}</Typography>
        ) : (
          client.workouts.map((w, i) => (
            <Box key={i} sx={{ mb: 2, pb: 1.75, borderBottom: i < client.workouts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, color: i === 0 ? C.primary : C.text }}>{w.date}</Typography>
                  {w.category && (
                    <Chip label={t(w.category)} size="small" sx={{ background: C.purpleSoft, color: C.purple, border: '1px solid rgba(200,197,255,0.2)', fontSize: '11.5px', fontWeight: 600 }} />
                  )}
                  {i === 0 && (
                    <Chip label={t('latestTag')} size="small" sx={{ background: C.accentSoft, color: C.primary, border: '1px solid rgba(196,233,191,0.3)', fontSize: '11px', fontWeight: 700 }} />
                  )}
                </Box>
                <Typography sx={{ color: C.muted, fontSize: '13px' }}>{t('coachByLbl')}: {w.coach || '—'}</Typography>
              </Box>
              <Box sx={{ background: 'rgba(0,0,0,0.15)', borderRadius: '10px', p: '10px 14px' }}>
                {w.items.map((ex, j) => (
                  <Box key={j} sx={{ display: 'grid', gridTemplateColumns: '1fr 110px 80px', gap: 1.25, py: 0.75, borderBottom: j < w.items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Typography sx={{ color: C.text, fontWeight: 600, fontSize: '13.5px' }}>{ex.exercise}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '13px' }}>{ex.scheme}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '13px' }}>{ex.weight} {t('kgUnit')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))
        )}
      </Paper>

      {/* ── Изпрати на клиента ── */}
      <CoachReactPanel />

      {/* ── Тренировки: оставащи + следващи ── */}
      <ClientSessionSummary />
    </>
  )
}

// ─── Client / tracker view ────────────────────────────────────────
function DashboardClient({ isCoachView = false }) {
  const {
    client, auth, ranking, t,
    latestWeight, latestAvg, weeklyRate,
    kcalPct, protPct, foodTotals,
    setView, viewingCoach,
  } = useApp()
  const {
    slots, myBookings, bookingBusy,
    loadSlots, loadMyBookings, cancelBookingForSlot,
  } = useBooking()

  const [tab, setTab] = useState(0)
  const [cancelErr, setCancelErr] = useState({})

  // Load booking data for client (not in coach-viewing-own-tracker mode)
  useEffect(() => {
    if (!isCoachView && auth.id) {
      loadSlots()
      loadMyBookings(auth.id)
    }
  }, [isCoachView, auth.id]) // eslint-disable-line

  async function handleCancel(slotId) {
    setCancelErr({})
    const res = await cancelBookingForSlot(slotId)
    if (res?.error) setCancelErr(prev => ({ ...prev, [slotId]: res.error }))
  }

  const myRank = isCoachView ? -1 : ranking.findIndex(r => r.name === client.name)
  const myData = ranking[myRank]

  const title = isCoachView
    ? (viewingCoach === auth.name ? t('myTrackerTitle') : `${client.name} — ${t('trackerLabel')}`)
    : `${t('greeting')}, ${client.name}`

  // 3-tab structure: [Workouts, Tasks (clients only), Progress]
  const tabLabels = isCoachView
    ? ['Workouts', 'Progress']
    : ['Workouts', 'Tasks', 'Progress']
  const progressTabIdx = isCoachView ? 1 : 2

  // Current week bounds (Mon–Sun)
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek)
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr   = weekEnd.toISOString().slice(0, 10)

  // Recorded workouts this week
  const weekWorkouts = (client.workouts || []).filter(w => w.date >= weekStartStr && w.date <= weekEndStr)

  // Booked sessions this week (client view only)
  const weekBookings = !isCoachView
    ? (myBookings || [])
        .filter(b => b.status === 'active')
        .map(b => ({ booking: b, slot: (slots || []).find(s => s.id === b.slot_id) }))
        .filter(({ slot }) => slot && slot.slot_date >= weekStartStr && slot.slot_date <= weekEndStr && slot.status !== 'cancelled')
        .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))
    : []

  return (
    <>
      {/* ── Reminder banners (not shown in coach tracker view) ── */}
      {!isCoachView && <ReminderBanners />}

      {/* ── Own tracker banner (shown when coach views personal tracker) ── */}
      {isCoachView && (
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 2, px: 2, py: 1, borderRadius: '10px',
          background: viewingCoach === auth.name
            ? 'linear-gradient(135deg, rgba(196,233,191,0.12) 0%, rgba(196,233,191,0.06) 100%)'
            : 'rgba(200,197,255,0.08)',
          border: `1px solid ${viewingCoach === auth.name ? 'rgba(196,233,191,0.25)' : 'rgba(200,197,255,0.2)'}`,
          animation: 'fadeIn 0.2s ease',
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: viewingCoach === auth.name ? C.primary : C.purple, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: viewingCoach === auth.name ? C.primary : C.purple }}>
            {viewingCoach === auth.name ? t('viewingOwnTracker') : `${t('viewingClient')}: ${client.name}`}
          </Typography>
        </Box>
      )}

      {/* ── Greeting ──────────────────────────────────── */}
      <Box sx={{ mb: 2.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>{title}</Typography>
        {!isCoachView && (
          <Typography sx={{ color: C.muted, fontSize: '14px' }}>{t('yourProgress')}</Typography>
        )}
      </Box>

      {/* ── Tabs ──────────────────────────────────────── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2.5,
          '& .MuiTabs-indicator': { background: C.primary },
          '& .MuiTab-root': { color: C.muted, fontSize: '13.5px', fontWeight: 600, textTransform: 'none', minWidth: 0, px: 1.75, py: 1 },
          '& .Mui-selected': { color: `${C.primary} !important` },
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        {tabLabels.map((label, i) => <Tab key={i} label={label} />)}
      </Tabs>

      {/* ── Tab 0: Тренировки ─────────────────────────── */}
      {tab === 0 && (
        <>
          {/* Today's calorie & protein progress rings */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 1.5, mb: 2.5 }}>
            {[
              [t('todayCalLbl'),  kcalPct, foodTotals.kcal,    client.calorieTarget, '',          C.primary, 'primary'],
              [t('todayProtLbl'), protPct, foodTotals.protein, client.proteinTarget, t('gUnit'), C.purple,  'purple'],
            ].map(([label, pct, cur, tgt, suf, color, cn], idx) => (
              <Box key={label} sx={{
                background: `linear-gradient(145deg, var(--c-${cn}A5) 0%, var(--c-${cn}A3) 100%)`,
                border: `1px solid var(--c-${cn}A13)`, borderRadius: '16px', p: '18px 20px',
                display: 'flex', alignItems: 'center', gap: 1.75,
                animation: `fadeInUp 0.22s ${EASE.decelerate} ${0.06 + idx * 0.04}s both`,
              }}>
                <Box sx={{ position: 'relative', flexShrink: 0 }}>
                  <ProgressRing percent={pct} color={color} size={64} />
                  <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color }}>
                    {Math.round(pct)}%
                  </Box>
                </Box>
                <Box>
                  <Typography sx={{ fontSize: '10.5px', color: C.muted, mb: 0.6, textTransform: 'uppercase', letterSpacing: '0.8px', fontWeight: 700 }}>
                    {label}
                  </Typography>
                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                    <Typography sx={{ fontSize: '26px', fontWeight: 800, color, lineHeight: 1.1, letterSpacing: '-0.5px', fontFamily: "'Space Grotesk', sans-serif" }}>
                      {fmt1(cur)}{suf}
                    </Typography>
                    <Typography sx={{ color: C.muted, fontSize: '13px', fontWeight: 600 }}>/ {tgt}{suf}</Typography>
                  </Box>
                </Box>
              </Box>
            ))}
          </Box>

          {/* Workouts this week */}
          <Paper sx={{ p: 2.25, mb: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px', animation: `fadeInUp 0.26s ${EASE.decelerate} 0.1s both` }}>
            <Typography variant="h3" sx={{ mb: 1.5 }}>Workouts This Week</Typography>
            {weekWorkouts.length === 0 && weekBookings.length === 0 ? (
              <Typography sx={{ color: C.muted, fontSize: '13px' }}>No workouts this week</Typography>
            ) : (
              <>
                {/* Upcoming booked sessions */}
                {weekBookings.map(({ booking, slot }, i) => (
                  <Box key={slot.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '8px',
                    borderBottom: (i < weekBookings.length - 1 || weekWorkouts.length > 0) ? `1px solid ${C.border}` : 'none' }}>
                    <Typography sx={{ color: C.muted, fontSize: '13px', minWidth: '92px' }}>{slot.slot_date}</Typography>
                    <Chip
                      label={`${slot.start_time?.slice(0,5) || ''}${slot.end_time ? '–' + slot.end_time.slice(0,5) : ''}`}
                      size="small"
                      sx={{ background: C.accentSoft, color: C.primary, border: '1px solid rgba(196,233,191,0.25)', fontSize: '11.5px', fontWeight: 600 }}
                    />
                    <Chip label={t('upcomingTag') || 'Upcoming'} size="small" sx={{ background: 'rgba(196,233,191,0.1)', color: C.primary, fontSize: '11px', fontWeight: 700 }} />
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={bookingBusy}
                      onClick={() => handleCancel(slot.id)}
                      sx={{ ml: 'auto', fontSize: '12px', py: '2px', px: 1.5,
                        borderColor: 'rgba(248,113,113,0.4)', color: '#F87171',
                        '&:hover': { borderColor: '#F87171', background: 'rgba(248,113,113,0.08)' } }}
                    >
                      {t('cancelBtn') || 'Cancel'}
                    </Button>
                  </Box>
                ))}
                {/* Recorded workouts */}
                {weekWorkouts.map((w, i) => (
                  <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '8px',
                    borderBottom: i < weekWorkouts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                    <Typography sx={{ color: C.muted, fontSize: '13px', minWidth: '92px' }}>{w.date}</Typography>
                    {w.category && (
                      <Chip label={t(w.category)} size="small" sx={{ background: C.purpleSoft, color: C.purple, border: '1px solid rgba(200,197,255,0.2)', fontSize: '11.5px', fontWeight: 600 }} />
                    )}
                    <Typography sx={{ color: C.muted, fontSize: '12px', ml: 'auto' }}>{w.items?.length || 0} {t('exercisesLbl')}</Typography>
                  </Box>
                ))}
              </>
            )}
          </Paper>

          {/* Ranking (clients only) */}
          {!isCoachView && myData && (
            <Paper sx={{ p: 2.75, animation: `fadeInUp 0.28s ${EASE.decelerate} 0.14s both` }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h3">{t('myRanking')}</Typography>
                <Button variant="outlined" size="small" onClick={() => setView('ranking')} sx={{ fontSize: '13px' }}>{t('seeAll')}</Button>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5,
                background: 'linear-gradient(135deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.06) 100%)',
                border: '1px solid rgba(196,233,191,0.2)', borderRadius: '16px', p: '16px 20px' }}>
                <Typography sx={{ fontSize: '36px', fontWeight: 800, lineHeight: 1, minWidth: '56px', textAlign: 'center', color: C.primary, fontFamily: "'Space Grotesk', sans-serif" }}>
                  #{myRank + 1}
                </Typography>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '22px', color: C.primary, mb: 0.75, fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.4px' }}>
                    {myData.points} {t('points')}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    {[
                      [`${t('kgUnit')}`, myData.breakdown.weightPts],
                      [t('rankWorkoutLbl'), myData.breakdown.workoutPts],
                      ['kcal', myData.breakdown.calPts],
                      [t('proteinShortLbl'), myData.breakdown.protPts],
                    ].map(([ico, pts]) => (
                      <Typography key={ico} sx={{ fontSize: '13px', color: C.muted }}>
                        {ico} <span style={{ color: C.text, fontWeight: 700 }}>{pts}</span>
                      </Typography>
                    ))}
                  </Box>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('ofLbl')} {ranking.length} {t('ofClients')}</Typography>
                  {myRank > 0 && (
                    <Typography sx={{ fontSize: '13px', color: C.muted, mt: 0.5 }}>
                      {t('toFirst')} <span style={{ color: C.primary, fontWeight: 700 }}>{ranking[0].points - myData.points} {t('points')}</span>
                    </Typography>
                  )}
                </Box>
              </Box>
            </Paper>
          )}
        </>
      )}

      {/* ── Tab 1: Задачи (clients) ───────────────────── */}
      {tab === 1 && !isCoachView && <Tasks />}

      {/* ── Tab Прогрес: food + weight trackers ──────── */}
      {tab === progressTabIdx && (
        <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
          <FoodTracker />
          <Box sx={{ mt: 2.5 }}>
            <WeightTracker />
          </Box>
        </Box>
      )}
    </>
  )
}

// ─── Dashboard router ─────────────────────────────────────────────
export default function Dashboard() {
  const { auth, viewingCoach } = useApp()

  // Coach/Admin not in tracker mode → show coach dashboard
  if ((auth.role === 'coach' || auth.role === 'admin') && !viewingCoach) {
    return <DashboardCoach />
  }
  // Coach/Admin viewing own tracker, or client view
  const isCoachView = (auth.role === 'coach' || auth.role === 'admin') && viewingCoach !== null
  return <DashboardClient isCoachView={isCoachView} />
}

// ─── Client Schedule: upcoming bookings + cancel ──────────────────
export function ClientSchedule() {
  const { auth, t } = useApp()
  const {
    slots, myBookings, myPlan, bookingBusy,
    loadSlots, loadMyBookings, loadMyPlan,
    cancelBookingForSlot,
  } = useBooking()

  const [loaded, setLoaded] = useState(false)
  const [cancelErr, setCancelErr] = useState({})

  useEffect(() => {
    if (!auth.id) return
    Promise.all([loadSlots(), loadMyBookings(auth.id), loadMyPlan(auth.id)])
      .then(() => setLoaded(true))
  }, [auth.id]) // eslint-disable-line

  const today = isoToday()

  // Join active future bookings with slot details
  const upcoming = (myBookings || [])
    .filter(b => b.status === 'active')
    .map(b => ({ booking: b, slot: (slots || []).find(s => s.id === b.slot_id) }))
    .filter(({ slot }) => slot && slot.slot_date >= today && slot.status !== 'cancelled')
    .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))

  async function handleCancel(slotId) {
    setCancelErr({})
    const res = await cancelBookingForSlot(slotId)
    if (res?.error) setCancelErr(prev => ({ ...prev, [slotId]: res.error }))
  }

  // Group by date
  const grouped = {}
  upcoming.forEach(({ booking, slot }) => {
    if (!grouped[slot.slot_date]) grouped[slot.slot_date] = []
    grouped[slot.slot_date].push({ booking, slot })
  })
  const dates = Object.keys(grouped).sort()

  return (
    <Box sx={{ maxWidth: 640, mx: 'auto' }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 2, color: C.text }}>
        {t('navBookSlot')}
      </Typography>

      {/* Credits summary */}
      {myPlan && (
        <Paper sx={{ p: 2, mb: 2, borderRadius: '14px', border: `1px solid ${C.primaryA20}`,
          background: 'linear-gradient(135deg, rgba(196,233,191,0.08) 0%, rgba(196,233,191,0.04) 100%)' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: C.text }}>
              Remaining Sessions
            </Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, color: C.primary, fontFamily: "'Space Grotesk', sans-serif" }}>
              {myPlan.plan_type === 'unlimited' ? '∞' : `${creditsRemaining(myPlan)} / ${myPlan.credits_total}`}
            </Typography>
          </Box>
        </Paper>
      )}

      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </Box>
      ) : dates.length === 0 ? (
        <Paper sx={{ p: 4, borderRadius: '16px', border: `1px solid ${C.border}`, textAlign: 'center' }}>
          <Typography sx={{ color: C.muted, fontSize: '14px' }}>
            No upcoming sessions
          </Typography>
        </Paper>
      ) : (
        dates.map((date, di) => (
          <Paper key={date} sx={{ mb: 2, borderRadius: '16px', border: `1px solid ${di === 0 ? C.primaryA20 : C.border}`, overflow: 'hidden' }}>
            <Box sx={{
              px: 2, py: 1.25,
              background: di === 0
                ? 'linear-gradient(135deg, rgba(196,233,191,0.18) 0%, rgba(196,233,191,0.10) 100%)'
                : 'rgba(255,255,255,0.04)',
              borderBottom: `1px solid ${di === 0 ? C.primaryA20 : C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <Typography sx={{ fontWeight: 800, fontSize: '13px', color: di === 0 ? C.primary : C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                {di === 0 ? t('nextSessionLbl') : t('laterSessionsLbl')}
              </Typography>
              <Typography sx={{ fontWeight: 600, fontSize: '12px', color: di === 0 ? C.primary : C.muted }}>
                {date}
              </Typography>
            </Box>
            {grouped[date].map(({ booking, slot }) => (
              <Box key={slot.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.5,
                borderBottom: `1px solid ${C.border}`, '&:last-child': { borderBottom: 'none' } }}>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '15px', color: C.text }}>
                    {slot.start_time?.slice(0, 5)} – {slot.end_time?.slice(0, 5)}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: C.muted }}>
                    {slot.coach_name}
                  </Typography>
                  {cancelErr[slot.id] && (
                    <Typography sx={{ fontSize: '11px', color: '#F87171', mt: 0.25 }}>{cancelErr[slot.id]}</Typography>
                  )}
                </Box>
                <Button size="small" variant="outlined" disabled={bookingBusy}
                  onClick={() => handleCancel(slot.id)}
                  sx={{ fontSize: '11px', py: 0.5, px: 1.5,
                    borderColor: 'rgba(248,113,113,0.4)', color: '#F87171',
                    '&:hover': { borderColor: '#F87171', background: 'rgba(248,113,113,0.12)' },
                    '&:disabled': { borderColor: C.border, color: C.muted } }}>
                  Cancel
                </Button>
              </Box>
            ))}
          </Paper>
        ))
      )}
    </Box>
  )
}
