import { useState, useEffect } from 'react'
import { Box, Typography, TextField, Button, Chip, Paper, Switch, Collapse, Tabs, Tab, IconButton, Tooltip } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import EditIcon from '@mui/icons-material/Edit'
import RestaurantIcon from '@mui/icons-material/Restaurant'
import MonitorWeightIcon from '@mui/icons-material/MonitorWeight'
import DirectionsWalkIcon from '@mui/icons-material/DirectionsWalk'
import AssignmentIcon from '@mui/icons-material/Assignment'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import { useApp } from '../context/AppContext'
import { useBooking } from '../context/BookingContext'
import { WORKOUT_CATEGORIES } from '../lib/constants'
import { C, EASE } from '../theme'
import FoodTracker from './FoodTracker'
import WeightTracker from './WeightTracker'
import { todayDate, fmt1, parseDate } from '../lib/utils'
import { computeReminders } from '../lib/reminders'
import {
  creditsRemaining, isoToday, isoDatePlusDays, daysUntilExpiry, fmtValidTo,
  groupByDate, dayLabel, fmtTime, canClientBook, canClientCancel, isPlanActive,
} from '../lib/bookingUtils'
import { hasModule, hasAnyModule } from '../lib/modules'

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
          sx={{ color: C.muted, fontSize: '12px', '&:hover': { color: C.purple } }}
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
                  onClick={() => { setView(auth.role === 'client' ? 'progress' : 'food'); dismiss(r.id) }}
                  sx={{
                    fontSize: '12px', py: '3px', px: 1.25,
                    borderRadius: '99px', borderColor: C.primaryA20,
                    color: C.purple, '&:hover': { background: C.accentSoft },
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
            <Button size="small" onClick={() => { setView(auth.role === 'client' ? 'progress' : 'weight'); dismiss(r.id) }}
              sx={{ mt: 0.75, fontSize: '12px', color: C.purple, p: 0 }}>
              → {t('navProgress')}
            </Button>
          )
        } else if (r.type === 'foodLog') {
          icon = 'F'
          msg  = t('reminderFoodMsg')
          actions = (
            <Button size="small" onClick={() => { setView(auth.role === 'client' ? 'progress' : 'food'); dismiss(r.id) }}
              sx={{ mt: 0.75, fontSize: '12px', color: C.purple, p: 0 }}>
              → {t('navProgress')}
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
          sx={{ color: C.muted, fontSize: '12px', '&:hover': { color: C.purple } }}
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
                  fontSize: '13.5px', fontWeight: 700, color: C.text,
                  minWidth: '50px', fontFamily: "'MontBlanc', sans-serif",
                }}>
                  {(s.start_time || '').slice(0, 5)}
                </Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: s.booked_count > 0 ? C.text : C.muted }}>
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

// ─── Persisted recent client IDs (survives remounts) ─────────────
let _recentClientIds = []

// ─── Coach dashboard (schedule + client list) ───────────────────
function DashboardCoach() {
  const {
    t, visibleClients, realClients, actualIdx, setSelIdx,
    setCurrentWorkout, setCoachClientMode, setShowClientMenu, setViewingCoach,
    setConfirmDelete,
  } = useApp()

  const [recentIds, setRecentIds] = useState(_recentClientIds)

  const selectClient = (ri, clientId) => {
    const updated = [clientId, ..._recentClientIds.filter(id => id !== clientId)]
    _recentClientIds = updated
    setRecentIds(updated)
    setSelIdx(ri)
    setCurrentWorkout([])
    setViewingCoach(null)
    setCoachClientMode(true)
    setShowClientMenu(false)
  }

  // Only show studio clients (those with studio_access module)
  const studioClients = visibleClients.filter(c => hasModule(c.modules, 'studio_access'))

  // Sort: recently clicked clients float to top in click order
  const sortedClients = [...studioClients].sort((a, b) => {
    const ai = recentIds.indexOf(a.id), bi = recentIds.indexOf(b.id)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <>
      <TodayScheduleCard />
      <Paper sx={{ p: 2, mb: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px', animation: `fadeInUp 0.24s ${EASE.decelerate} 0.04s both` }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.25 }}>
          <Typography variant="h3">{t('clientsHeader')}</Typography>
          <Typography sx={{ fontSize: '12px', color: C.muted }}>{studioClients.length} {t('ofClients')}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {sortedClients.map((c, i) => {
            const ri = realClients.findIndex(x => x.name === c.name)
            const isSel = actualIdx === ri
            return (
              <Box key={c.name} onClick={() => selectClient(ri, c.id)} sx={{
                display: 'flex', alignItems: 'center', gap: '12px',
                py: 1.2, px: 1.5, borderRadius: '12px', cursor: 'pointer',
                background: isSel
                  ? 'linear-gradient(135deg, rgba(170,169,205,0.14) 0%, rgba(170,169,205,0.08) 100%)'
                  : 'rgba(255,255,255,0.04)',
                border: `1px solid ${isSel ? 'rgba(170,169,205,0.3)' : 'rgba(255,255,255,0.06)'}`,
                transition: `all 0.18s ${EASE.standard}`,
                animation: `fadeInUp 0.2s ${EASE.standard} both`,
                animationDelay: `${i * 0.04}s`,
                '&:hover': { background: isSel ? 'rgba(170,169,205,0.16)' : 'rgba(255,255,255,0.07)' },
              }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isSel ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 800, color: isSel ? C.purple : C.muted, flexShrink: 0,
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '14px', color: isSel ? C.purple : C.text, lineHeight: 1.3 }}>
                    {c.name}
                  </Typography>
                  <Typography sx={{ fontSize: '12px', color: C.muted, mt: 0.2 }}>
                    {c.calorieTarget} kcal · {c.proteinTarget}{t('gUnit')} {t('proteinShortLbl')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                  {isSel && <Box sx={{ fontSize: '16px', color: C.purple }}>✓</Box>}
                  <Tooltip title={t('deleteClientBtn')} arrow>
                    <IconButton size="small"
                      onClick={e => { e.stopPropagation(); setConfirmDelete({ id: c.id, name: c.name }) }}
                      sx={{ color: C.muted, opacity: 0.5, '&:hover': { color: '#F87171', opacity: 1 } }}>
                      <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )
          })}
          {studioClients.length === 0 && (
            <Typography sx={{ fontSize: '13px', color: C.muted, textAlign: 'center', py: 2 }}>
              {t('noClients')}
            </Typography>
          )}
        </Box>
      </Paper>
    </>
  )
}

// ─── Client detail view (shown when coach selects any client) ─────
// ─── Mini SVG Sparkline (weight chart) ───────────────────────────
function Sparkline({ data, width = 120, height = 36, color = C.purple }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data), max = Math.max(...data)
  const range = max - min || 1
  const pad = 2
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2)
    const y = height - pad - ((v - min) / range) * (height - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dot on last point */}
      {(() => {
        const last = data[data.length - 1]
        const x = width - pad
        const y = height - pad - ((last - min) / range) * (height - pad * 2)
        return <circle cx={x} cy={y} r="3" fill={color} />
      })()}
    </svg>
  )
}

// ─── Mini SVG Bar chart (steps) ──────────────────────────────────
function MiniBarChart({ data, width = 200, height = 48, color = C.purple }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value)) || 1
  const barW = Math.min(22, (width - (data.length - 1) * 3) / data.length)
  const gap = 3
  const labelH = 14
  const chartH = height - labelH
  return (
    <svg width={data.length * (barW + gap) - gap} height={height} style={{ display: 'block' }}>
      {data.map((d, i) => {
        const x = i * (barW + gap)
        const barH = Math.max(2, (d.value / max) * (chartH - 2))
        const y = chartH - barH
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={d.value > 0 ? color : 'rgba(255,255,255,0.06)'} opacity={d.value > 0 ? 0.85 : 1} />
            <text x={x + barW / 2} y={height - 1} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="sans-serif">{d.label}</text>
          </g>
        )
      })}
    </svg>
  )
}

export function ClientDetail() {
  const {
    client, auth, t, lang, weeklyRate,
    setCoachClientMode, updateClientTargets,
    exName, setExName, exScheme, setExScheme, exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    addExercise, saveWorkout,
  } = useApp()
  const { allPlans, loadAllPlans, slots, slotBookings } = useBooking()

  const [tab, setTab] = useState(0)
  const [editingTargets, setEditingTargets] = useState(null) // { cal, prot }
  const isMobile = window.innerWidth < 640
  const isCoach = auth.role === 'coach' || auth.role === 'admin'

  useEffect(() => { loadAllPlans() }, []) // eslint-disable-line

  // ── Profile tab data ──
  const plan    = (allPlans || []).find(p => p.client_id === client.id && p.status === 'active')
  const remCred = plan ? creditsRemaining(plan) : null
  const today   = isoToday()

  const nextSlot = (slots || [])
    .filter(s => s.slot_date >= today && s.status !== 'cancelled')
    .map(s => ({ slot: s, booking: (slotBookings[s.id] || []).find(b => b.client_id === client.id) }))
    .filter(({ booking }) => !!booking)
    .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))[0] || null

  // Aggregate meals by date (last 7 days) — DD.MM.YYYY to match stored format
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
  })
  const mealsByDate = {}
  ;(client.meals || []).forEach(m => {
    if (m.date && last7.includes(m.date)) {
      if (!mealsByDate[m.date]) mealsByDate[m.date] = { kcal: 0, protein: 0 }
      mealsByDate[m.date].kcal    += (m.kcal || m.calories || 0)
      mealsByDate[m.date].protein += (m.protein || 0)
    }
  })

  return (
    <>
      {/* ── Header: Back + Name + Weekly Rate ── */}
      <Box sx={{ mb: 2, animation: `fadeInUp 0.18s ${EASE.decelerate} both` }}>
        <Button
          size="small"
          onClick={() => setCoachClientMode(false)}
          startIcon={<ArrowBackIcon />}
          sx={{ color: C.muted, '&:hover': { color: C.purple }, pl: 0, mb: 1 }}
        >
          Back
        </Button>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Typography variant="h2">{client.name || '—'}</Typography>
          <Typography sx={{
            fontSize: '15px', fontWeight: 800, fontFamily: "'MontBlanc', sans-serif",
            color: weeklyRate === null ? C.muted : weeklyRate > 0 ? C.orange : C.purple,
          }}>
            {weeklyRate !== null ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}` : '—'}
          </Typography>
        </Box>
      </Box>

      {/* ── 2 Tabs ── */}
      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: 2.5,
          '& .MuiTabs-indicator': { background: C.primary },
          '& .MuiTab-root': { color: C.muted, fontSize: '13.5px', fontWeight: 600, textTransform: 'none', minWidth: 0, px: 1.75, py: 1 },
          '& .Mui-selected': { color: `${C.purple} !important` },
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <Tab label={t('todayWorkoutTab')} />
        <Tab label={t('profileTab')} />
      </Tabs>

      {/* ══════ Tab 0: Тренировка днес + История ══════ */}
      {tab === 0 && (
        <Box sx={{ animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
          {/* ── Workout builder ── */}
          <Paper sx={{
            border:       `1px solid rgba(170,169,205,0.25)`,
            borderRadius: '20px',
            p:            3,
            background:   'linear-gradient(145deg, rgba(170,169,205,0.04) 0%, #1C1A19 100%)',
            boxShadow:    '0 0 0 1px rgba(170,169,205,0.08), 0 8px 32px rgba(0,0,0,0.3)',
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

          {/* ── Workout history (inline below) ── */}
          {(client.workouts || []).length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h3" sx={{ mb: 1.5, px: 0.5 }}>{t('workoutHistory')}</Typography>
              {client.workouts.map((w, i) => (
                <Paper key={i} sx={{ mb: 1.5, p: 2, border: `1px solid ${C.border}`, borderRadius: '14px' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1, alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '14px', color: i === 0 ? C.purple : C.text }}>{w.date}</Typography>
                      {w.category && (
                        <Chip label={t(w.category)} size="small" sx={{ background: C.purpleSoft, color: C.purple, border: '1px solid rgba(200,197,255,0.2)', fontSize: '11px', fontWeight: 600 }} />
                      )}
                    </Box>
                    <Typography sx={{ color: C.muted, fontSize: '12px' }}>{w.coach || '—'}</Typography>
                  </Box>
                  {w.items.map((ex, j) => (
                    <Box key={j} sx={{ display: 'grid', gridTemplateColumns: '1fr 90px 60px', gap: 1, py: 0.6, borderBottom: j < w.items.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                      <Typography sx={{ color: C.text, fontWeight: 600, fontSize: '13px' }}>{ex.exercise}</Typography>
                      <Typography sx={{ color: C.muted, fontSize: '12.5px' }}>{ex.scheme}</Typography>
                      <Typography sx={{ color: C.muted, fontSize: '12.5px', textAlign: 'right' }}>{ex.weight} {t('kgUnit')}</Typography>
                    </Box>
                  ))}
                </Paper>
              ))}
            </Box>
          )}
        </Box>
      )}

      {/* ══════ Tab 1: Профил ══════ */}
      {tab === 1 && (() => {
        // Weight data
        const wLogs = [...(client.weightLogs || [])].sort((a, b) => a.date?.localeCompare(b.date))
        const lastWeight = wLogs.length > 0 ? wLogs[wLogs.length - 1] : null
        const sparkData = wLogs.slice(-10).map(w => Number(w.weight))

        // Steps data (last 7 days)
        const stepsMap = {}
        ;(client.stepsLogs || []).forEach(s => { stepsMap[s.date] = Number(s.steps) || 0 })
        const stepsLast7 = last7.map(d => ({ date: d, value: stepsMap[d] || 0 }))
        const stepsWithData = stepsLast7.filter(s => s.value > 0)
        const avgSteps = stepsWithData.length > 0 ? Math.round(stepsWithData.reduce((s, x) => s + x.value, 0) / stepsWithData.length) : 0
        const dayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Нд']
        const barData = stepsLast7.map(s => {
          const dt = parseDate(s.date)
          const dow = dt.getDay() === 0 ? 6 : dt.getDay() - 1
          return { value: s.value, label: dayNames[dow] }
        })

        // Plan type label
        const planLabel = !plan ? null
          : plan.plan_type === 'unlimited' ? 'Unlimited'
          : `${plan.credits_total} ${t('sessionsLbl') || 'sessions'}`

        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>

            {/* ── 1. Оставащи сесии ── */}
            <Paper sx={{ p: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('remainingSessionsLbl')}
                </Typography>
                {planLabel && (
                  <Box sx={{ px: 1, py: '2px', borderRadius: '6px', background: C.accentSoft, border: `1px solid ${C.primaryA20}` }}>
                    <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.text }}>{planLabel}</Typography>
                  </Box>
                )}
              </Box>
              <Typography sx={{ fontSize: '36px', fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: "'MontBlanc', sans-serif", mb: 2 }}>
                {!plan ? '—' : plan.plan_type === 'unlimited' ? '∞' : `${remCred} / ${plan.credits_total}`}
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('nextSessionLbl')}</Typography>
                  <Typography sx={{ fontSize: '14px', fontWeight: 700, color: nextSlot ? C.text : C.muted }}>
                    {nextSlot ? `${nextSlot.slot.slot_date} · ${nextSlot.slot.start_time?.slice(0, 5)}` : '—'}
                  </Typography>
                </Box>
                {plan && (
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('validToLbl') || 'Валиден до'}</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                      {fmtValidTo(plan, lang)}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Paper>

            {/* ── 2. Тегло ── */}
            <Paper sx={{ p: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5 }}>
                {t('weightHistoryLbl')}
              </Typography>
              {!lastWeight ? (
                <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noWeightLbl')}</Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 1.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
                      <Typography sx={{ fontSize: '36px', fontWeight: 800, color: C.purple, lineHeight: 1, fontFamily: "'MontBlanc', sans-serif" }}>
                        {fmt1(lastWeight.weight)}
                      </Typography>
                      <Typography sx={{ fontSize: '15px', fontWeight: 600, color: C.muted, mb: '3px' }}>
                        {t('kgUnit')}
                      </Typography>
                    </Box>
                    {sparkData.length >= 2 && (
                      <Sparkline data={sparkData} width={160} height={40} color={C.purple} />
                    )}
                  </Box>
                  <Typography sx={{
                    fontSize: '14px', fontWeight: 700,
                    color: weeklyRate === null ? C.muted : weeklyRate < 0 ? C.purple : weeklyRate > 0 ? C.orange : C.muted,
                  }}>
                    {weeklyRate !== null ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}` : '—'}
                  </Typography>
                </>
              )}
            </Paper>

            {/* ── 3. Хранителен дневник (последни 7 дни) ── */}
            <Paper sx={{ p: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {t('foodDiaryLbl')}
                </Typography>
                {editingTargets ? (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <TextField size="small" type="number"
                      value={editingTargets.cal}
                      onChange={e => setEditingTargets(p => ({ ...p, cal: e.target.value }))}
                      inputProps={{ min: 500, max: 10000, style: { padding: '3px 6px', fontSize: '12px', width: '50px', color: C.text } }}
                      sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}
                    />
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>kcal</Typography>
                    <TextField size="small" type="number"
                      value={editingTargets.prot}
                      onChange={e => setEditingTargets(p => ({ ...p, prot: e.target.value }))}
                      inputProps={{ min: 10, max: 500, style: { padding: '3px 6px', fontSize: '12px', width: '40px', color: C.text } }}
                      sx={{ '& .MuiOutlinedInput-notchedOutline': { borderColor: C.border } }}
                    />
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('gUnit')}</Typography>
                    <IconButton size="small" onClick={async () => {
                      await updateClientTargets(client.id, Number(editingTargets.cal), Number(editingTargets.prot))
                      setEditingTargets(null)
                    }} sx={{ color: C.primary, p: 0.25 }}>
                      <RestaurantIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Box>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography sx={{ fontSize: '12px', color: C.muted }}>
                      {client.calorieTarget} kcal · {client.proteinTarget}{t('gUnit')}
                    </Typography>
                    {isCoach && (
                      <IconButton size="small"
                        onClick={() => setEditingTargets({ cal: client.calorieTarget, prot: client.proteinTarget })}
                        sx={{ color: C.muted, opacity: 0.5, p: 0.25, '&:hover': { opacity: 1, color: C.purple } }}>
                        <EditIcon sx={{ fontSize: 13 }} />
                      </IconButton>
                    )}
                  </Box>
                )}
              </Box>
              {[...last7].reverse().map((date, i) => {
                const hasMeals = !!mealsByDate[date]
                const dayStr = parseDate(date).toLocaleDateString('bg-BG', { day: 'numeric', month: 'short', weekday: 'short' })
                return (
                  <Box key={date} sx={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    py: '8px',
                    borderBottom: i < 6 ? `1px solid ${C.border}` : 'none',
                    opacity: hasMeals ? 1 : 0.45,
                  }}>
                    <Typography sx={{ fontSize: '13px', color: hasMeals ? C.text : C.muted, fontWeight: hasMeals ? 600 : 400 }}>
                      {dayStr}
                    </Typography>
                    {hasMeals ? (
                      <Box sx={{ display: 'flex', gap: 2.5 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                          {Math.round(mealsByDate[date].kcal)} kcal
                        </Typography>
                        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.purple }}>
                          {Math.round(mealsByDate[date].protein)}g P
                        </Typography>
                      </Box>
                    ) : (
                      <Typography sx={{ fontSize: '13px', color: C.muted }}>—</Typography>
                    )}
                  </Box>
                )
              })}
            </Paper>

            {/* ── 4. Средни стъпки на ден ── */}
            <Paper sx={{ p: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.6px', mb: 1.5 }}>
                {t('stepsHistoryLbl')}
              </Typography>
              {stepsWithData.length === 0 ? (
                <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noStepsLogs')}</Typography>
              ) : (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, mb: 2 }}>
                    <Typography sx={{ fontSize: '32px', fontWeight: 800, color: C.text, lineHeight: 1, fontFamily: "'MontBlanc', sans-serif" }}>
                      {avgSteps.toLocaleString('bg-BG')}
                    </Typography>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: C.muted, mb: '3px' }}>
                      {t('stepsUnit')} / {t('dayLbl') || 'ден'}
                    </Typography>
                  </Box>
                  <MiniBarChart data={barData} width={240} height={56} color={C.purple} />
                </>
              )}
            </Paper>
          </Box>
        )
      })()}
    </>
  )
}

// ─── Client / tracker view ────────────────────────────────────────
function DashboardClient({ isCoachView = false }) {
  const { client, auth, t, setView, viewingCoach } = useApp()
  const { slots, myBookings, myPlan, bookingBusy, loadSlots, loadMyBookings, loadMyPlan, cancelBookingForSlot } = useBooking()

  const [tab, setTab] = useState(0)

  // Load booking data for client (not in coach-viewing-own-tracker mode)
  useEffect(() => {
    if (!isCoachView && auth.id) {
      loadSlots()
      loadMyBookings(auth.id)
      loadMyPlan(auth.id)
    }
  }, [isCoachView, auth.id]) // eslint-disable-line

  const title = isCoachView
    ? (viewingCoach === auth.name ? t('myTrackerTitle') : `${client.name} — ${t('trackerLabel')}`)
    : `${t('greeting')}, ${client.name}`

  // Current week bounds (Mon–Sun)
  const now = new Date()
  const dayOfWeek = now.getDay() === 0 ? 6 : now.getDay() - 1
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek)
  const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().slice(0, 10)
  const weekEndStr   = weekEnd.toISOString().slice(0, 10)

  // Recorded workouts this week
  const weekWorkouts = (client.workouts || []).filter(w => w.date >= weekStartStr && w.date <= weekEndStr)

  // ─── Coach tracker view (with tabs) ───
  if (isCoachView) {
    return (
      <>
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1,
          mb: 2, px: 2, py: 1, borderRadius: '10px',
          background: viewingCoach === auth.name
            ? 'linear-gradient(135deg, rgba(170,169,205,0.12) 0%, rgba(170,169,205,0.06) 100%)'
            : 'rgba(200,197,255,0.08)',
          border: `1px solid ${viewingCoach === auth.name ? 'rgba(170,169,205,0.25)' : 'rgba(200,197,255,0.2)'}`,
          animation: 'fadeIn 0.2s ease',
        }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', background: viewingCoach === auth.name ? C.primary : C.purple, flexShrink: 0 }} />
          <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.purple }}>
            {viewingCoach === auth.name ? t('viewingOwnTracker') : `${t('viewingClient')}: ${client.name}`}
          </Typography>
        </Box>

        <Box sx={{ mb: 2.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>{title}</Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            mb: 2.5,
            '& .MuiTabs-indicator': { background: C.primary },
            '& .MuiTab-root': { color: C.muted, fontSize: '13.5px', fontWeight: 600, textTransform: 'none', minWidth: 0, px: 1.75, py: 1 },
            '& .Mui-selected': { color: `${C.purple} !important` },
            borderBottom: `1px solid ${C.border}`,
          }}
        >
          <Tab label={t('tabWorkouts')} />
          <Tab label={t('tabProgress')} />
        </Tabs>

        {tab === 0 && (
          <Paper sx={{ p: 2.25, mb: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>
            <Typography variant="h3" sx={{ mb: 1.5 }}>{t('workoutsThisWeekLbl')}</Typography>
            {weekWorkouts.length === 0 ? (
              <Typography sx={{ color: C.muted, fontSize: '13px' }}>{t('noWorkoutsWeekLbl')}</Typography>
            ) : weekWorkouts.map((w, i) => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: '8px',
                borderBottom: i < weekWorkouts.length - 1 ? `1px solid ${C.border}` : 'none' }}>
                <Typography sx={{ color: C.muted, fontSize: '13px', minWidth: '92px' }}>{w.date}</Typography>
                {w.category && (
                  <Chip label={t(w.category)} size="small" sx={{ background: C.purpleSoft, color: C.purple, fontSize: '11.5px', fontWeight: 600 }} />
                )}
                <Typography sx={{ color: C.muted, fontSize: '12px', ml: 'auto' }}>{w.items?.length || 0} {t('exercisesLbl')}</Typography>
              </Box>
            ))}
          </Paper>
        )}

        {tab === 1 && (
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

  // ─── Client dashboard (no tabs) ───
  const isMobile = window.innerWidth < 640
  const today = isoToday()
  const showBooking = hasModule(auth.modules, 'booking_access')

  const nextSession = showBooking ? (myBookings || [])
    .filter(b => b.status === 'active')
    .map(b => ({ booking: b, slot: (slots || []).find(s => s.id === b.slot_id) }))
    .filter(({ slot }) => slot && slot.slot_date >= today && slot.status !== 'cancelled')
    .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))[0] || null
    : null

  const credits  = myPlan ? (myPlan.plan_type === 'unlimited' ? null : creditsRemaining(myPlan)) : null
  const daysLeft = myPlan ? daysUntilExpiry(myPlan) : null
  const planColor = !myPlan ? '#F87171'
    : (credits !== null && credits <= 2) || (daysLeft !== null && daysLeft <= 3) ? '#F87171'
    : (credits !== null && credits <= 4) || (daysLeft !== null && daysLeft <= 7) ? '#FB923C'
    : C.purple

  function bgDate(iso) {
    if (!iso) return ''
    return new Date(iso + 'T00:00:00').toLocaleDateString('bg-BG', { weekday: 'short', day: 'numeric', month: 'short' })
  }

  return (
    <>
      <ReminderBanners />

      {/* ── Greeting ── */}
      <Box sx={{ mb: 2, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>{title}</Typography>
        <Typography sx={{ color: C.muted, fontSize: '14px' }}>{t('yourProgress')}</Typography>
      </Box>

      {/* ── Next session ── */}
      {showBooking && myPlan && (
        <Paper sx={{ p: 1.5, px: 2, mb: 1.5, borderRadius: '14px', border: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, letterSpacing: '0.5px', mb: 0.25 }}>
              {t('nextSessionLbl')}
            </Typography>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: nextSession ? C.text : C.muted }}>
              {nextSession ? `${bgDate(nextSession.slot.slot_date)}, ${nextSession.slot.start_time?.slice(0,5)}` : t('noUpcoming')}
            </Typography>
          </Box>
          {nextSession && !isCoachView && (
            <Button size="small" disabled={bookingBusy}
              onClick={() => cancelBookingForSlot(nextSession.slot.id)}
              sx={{
                fontSize: '11px', py: '4px', px: 1.5,
                color: '#F87171', border: '1px solid rgba(248,113,113,0.3)',
                borderRadius: '100px',
                '&:hover': { background: 'rgba(248,113,113,0.08)', borderColor: '#F87171' },
              }}>
              {t('cancelBookingBtn')}
            </Button>
          )}
        </Paper>
      )}

      {/* ── Plan info: Credits + Expiry ── */}
      {showBooking && myPlan && (
        <Box sx={{ display: 'flex', gap: 1.5, mb: 2 }}>
          <Paper sx={{ flex: 1, p: 2, textAlign: 'center', borderRadius: '18px', border: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: '32px', fontWeight: 800, color: C.text, fontFamily: "'MontBlanc', sans-serif", lineHeight: 1 }}>
              {myPlan.plan_type === 'unlimited' ? '∞' : credits}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600, mt: 0.75 }}>
              {t('remainingSessionsLbl')}
            </Typography>
          </Paper>
          <Paper sx={{ flex: 1, p: 2, textAlign: 'center', borderRadius: '18px', border: `1px solid ${C.border}` }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
              {fmtValidTo(myPlan)}
            </Typography>
            <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 600, mt: 0.75 }}>
              {daysLeft !== null && daysLeft > 0
                ? `${t('expiresInLbl')} ${daysLeft} ${t('daysLbl')}`
                : daysLeft !== null && daysLeft <= 0 ? t('planExpired') : t('validUntil')}
            </Typography>
          </Paper>
        </Box>
      )}

      {showBooking && !myPlan && (
        <Paper sx={{ p: '14px 16px', mb: 2, borderRadius: '16px', border: '1px solid rgba(248,113,113,0.3)', background: 'rgba(248,113,113,0.06)' }}>
          <Typography sx={{ fontSize: '14px', color: '#F87171', fontWeight: 700 }}>{t('noPlan')}</Typography>
        </Paper>
      )}

      {/* ── +Добави храна / +Добави тегло ── */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
        {[
          hasModule(auth.modules, 'nutrition_tracking') && { key: 'food', view: 'food', color: '#5EC6D0', Icon: RestaurantIcon, label: t('addFoodBtn') },
          hasModule(auth.modules, 'weight_tracking') && { key: 'weight', view: 'weight', color: '#C8C5FF', Icon: MonitorWeightIcon, label: t('addWeightBtn') },
          (hasModule(auth.modules, 'nutrition_tracking') || hasModule(auth.modules, 'weight_tracking')) && { key: 'steps', view: 'steps', color: '#FFD070', Icon: DirectionsWalkIcon, label: t('addStepsBtn') },
          { key: 'workout', view: 'workout', color: '#A78BFA', Icon: FitnessCenterIcon, label: t('addWorkoutBtn') },
          { key: 'tasks', view: 'tasks', color: '#F87171', Icon: AssignmentIcon, label: t('navTasks') },
        ].filter(Boolean).map(({ key, view, color, Icon, label }) => (
          <Paper key={key} onClick={() => setView(view)}
            sx={{
              p: '16px 12px', borderRadius: '14px', cursor: 'pointer',
              border: `1px solid ${color}25`,
              background: `linear-gradient(145deg, ${color}0A 0%, var(--c-cardDeep) 100%)`,
              transition: `all 0.2s ${EASE.standard}`,
              '&:hover': { transform: 'translateY(-2px)', borderColor: `${color}50`, boxShadow: `0 0 20px ${color}20` },
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, textAlign: 'center',
            }}>
            <Box sx={{
              width: 48, height: 48, borderRadius: '12px', mx: 'auto',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: `${color}28`, border: `2px solid ${color}70`,
              boxShadow: `0 0 14px ${color}22`,
            }}>
              <Icon sx={{ fontSize: 24, color }} />
            </Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 800, color: C.text, lineHeight: 1.3 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted }}>{t('tapToLog')}</Typography>
          </Paper>
        ))}
      </Box>
    </>
  )
}

// ─── Portal Home (empty state — no active modules) ────────────────
function PortalHome() {
  const { auth, t } = useApp()

  const cards = [
    {
      href: '../studio.html',
      titleKey: 'portalStudioTitle',
      descKey:  'portalStudioDesc',
      gradient: 'rgba(170,169,205,0.08)',
      border:   'rgba(170,169,205,0.2)',
      color:    C.purple,
    },
    {
      href: '../remote.html',
      titleKey: 'portalRemoteTitle',
      descKey:  'portalRemoteDesc',
      gradient: 'rgba(200,197,255,0.08)',
      border:   'rgba(200,197,255,0.2)',
      color:    '#C8C5FF',
    },
    {
      href: '../index.html#cta',
      titleKey: 'portalContactTitle',
      descKey:  'portalContactDesc',
      gradient: 'rgba(255,255,255,0.04)',
      border:   C.border,
      color:    C.text,
    },
  ]

  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {t('greeting')}, {auth.name}
        </Typography>
        <Typography sx={{ color: C.muted, fontSize: '14px' }}>
          {t('portalWelcome')}
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {cards.map(card => (
          <Paper
            key={card.titleKey}
            component="a"
            href={card.href}
            sx={{
              p: 2.5, borderRadius: '20px', textDecoration: 'none',
              border: `1px solid ${card.border}`,
              background: `linear-gradient(135deg, ${card.gradient} 0%, transparent 100%)`,
              cursor: 'pointer', transition: 'transform 0.15s',
              '&:hover': { transform: 'translateY(-2px)' },
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '16px', color: card.color, mb: 0.5 }}>
              {t(card.titleKey)}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: C.muted }}>
              {t(card.descKey)}
            </Typography>
          </Paper>
        ))}
      </Box>
    </Box>
  )
}

// ─── Dashboard router ─────────────────────────────────────────────
export default function Dashboard() {
  const { auth, viewingCoach } = useApp()

  // Coach/Admin not in tracker mode → show coach dashboard
  if ((auth.role === 'coach' || auth.role === 'admin') && !viewingCoach) {
    return <DashboardCoach />
  }
  // Coach/Admin viewing own tracker
  if ((auth.role === 'coach' || auth.role === 'admin') && viewingCoach !== null) {
    return <DashboardClient isCoachView />
  }
  // Client with no modules → portal home
  if (!hasAnyModule(auth.modules || [])) {
    return <PortalHome />
  }
  // Client with modules → regular dashboard
  return <DashboardClient />
}

// ─── Client Schedule: 3-day booking calendar ─────────────────────
export function ClientSchedule() {
  const { auth, t, lang } = useApp()
  const {
    slots, myBookings, myPlan, bookingBusy,
    loadSlots, loadMyBookings, loadMyPlan,
    bookSlot, cancelBookingForSlot,
  } = useBooking()

  const [loaded,    setLoaded]    = useState(false)
  const [dayOffset, setDayOffset] = useState(0) // first day offset from today

  useEffect(() => {
    if (!auth.id) return
    Promise.all([loadSlots(), loadMyBookings(auth.id), loadMyPlan(auth.id)])
      .then(() => setLoaded(true))
  }, [auth.id]) // eslint-disable-line

  const today = isoToday()

  // ── Compact header data ───────────────────────────────────────
  const rem      = myPlan ? creditsRemaining(myPlan) : 0
  const isUnlim  = myPlan?.plan_type === 'unlimited'

  const allBooked = (myBookings || [])
    .filter(b => b.status === 'active')
    .map(b => ({ booking: b, slot: (slots || []).find(s => s.id === b.slot_id) }))
    .filter(({ slot }) => slot && slot.slot_date >= today && slot.status !== 'cancelled')
    .sort((a, b) => (a.slot.slot_date + a.slot.start_time).localeCompare(b.slot.slot_date + b.slot.start_time))

  // ── 3-day grid ────────────────────────────────────────────────
  const dayDates = [
    isoDatePlusDays(dayOffset),
    isoDatePlusDays(dayOffset + 1),
    isoDatePlusDays(dayOffset + 2),
  ]

  const activeSlots = (slots || []).filter(s => s.status !== 'cancelled')
  const grouped     = groupByDate(activeSlots)

  async function handleBook(slotId) {
    return await bookSlot(slotId)
  }

  async function handleCancel(slotId) {
    return await cancelBookingForSlot(slotId)
  }

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 2.5 }}>
        {t('navBookSlot')}
      </Typography>

      {/* ── Compact header: Credits + My sessions ─────────────── */}
      {myPlan && (
        <Box sx={{ mb: 2.5 }}>
          {/* Remaining credits */}
          <Paper sx={{
            p: 1.75, borderRadius: '14px', mb: 1.5,
            border: `1px solid ${C.primaryA20}`,
            background: 'linear-gradient(135deg, rgba(170,169,205,0.08) 0%, rgba(170,169,205,0.04) 100%)',
            display: 'flex', alignItems: 'center', gap: 2,
          }}>
            <Typography sx={{ fontSize: '30px', fontWeight: 800, color: C.text, lineHeight: 1 }}>
              {isUnlim ? '∞' : rem}
              {!isUnlim && (
                <Box component="span" sx={{ fontSize: '13px', color: C.muted, fontWeight: 400, ml: 0.75 }}>
                  / {myPlan.credits_total}
                </Box>
              )}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 600 }}>
              {t('remainingSessionsLbl')}
            </Typography>
          </Paper>

          {/* My sessions list */}
          <Paper sx={{
            p: 1.75, borderRadius: '14px',
            border: `1px solid ${C.border}`,
            background: 'rgba(255,255,255,0.03)',
          }}>
            <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 600, mb: 1 }}>
              {t('myTrainings')}
            </Typography>
            {allBooked.length === 0 ? (
              <Typography sx={{ fontSize: '13px', color: C.muted }}>{t('noUpcoming')}</Typography>
            ) : (
              allBooked.map(({ booking, slot }) => (
                <Box key={booking.id} sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  py: 1, borderBottom: `1px solid ${C.border}`,
                  '&:last-child': { borderBottom: 'none', pb: 0 },
                  '&:first-of-type': { pt: 0 },
                }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text, lineHeight: 1.3 }}>
                      {dayLabel(slot.slot_date, lang)}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>
                      {fmtTime(slot.start_time)} – {fmtTime(slot.end_time)} · {slot.coach_name}
                    </Typography>
                  </Box>
                  {canClientCancel(slot).ok && (
                    <Button size="small" disabled={bookingBusy}
                      onClick={() => handleCancel(slot.id)}
                      sx={{
                        minWidth: 'auto', fontSize: '11px', py: '4px', px: 1.25,
                        color: '#F87171', border: '1px solid rgba(248,113,113,0.3)',
                        borderRadius: '8px', flexShrink: 0,
                        '&:hover': { background: 'rgba(248,113,113,0.08)', borderColor: '#F87171' },
                        '&.Mui-disabled': { opacity: 0.5 },
                      }}>
                      {t('cancelBookingBtn')}
                    </Button>
                  )}
                </Box>
              ))
            )}
          </Paper>
        </Box>
      )}

      {/* ── 3-day booking calendar ─────────────────────────────── */}
      {!loaded ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <Box sx={{ width: 28, height: 28, borderRadius: '50%', border: `3px solid ${C.primary}`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        </Box>
      ) : (
        <>
          {/* Navigation row */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
            <Button
              size="small" variant="outlined"
              disabled={dayOffset === 0}
              onClick={() => setDayOffset(p => Math.max(0, p - 3))}
              sx={{
                fontSize: '12px', fontWeight: 700, borderColor: C.border, color: C.muted,
                '&:hover': { borderColor: C.primary, color: C.purple },
                '&.Mui-disabled': { borderColor: C.border, color: C.border },
                minWidth: 0, px: 1.5,
              }}
            >
              ← {lang === 'bg' ? 'Назад' : 'Back'}
            </Button>
            <Typography sx={{ fontSize: '12px', color: C.muted }}>
              {dayDates[0].slice(5).replace('-', '/')} – {dayDates[2].slice(5).replace('-', '/')}
            </Typography>
            <Button
              size="small" variant="outlined"
              onClick={() => setDayOffset(p => p + 3)}
              sx={{
                fontSize: '12px', fontWeight: 700, borderColor: C.border, color: C.muted,
                '&:hover': { borderColor: C.primary, color: C.purple },
                minWidth: 0, px: 1.5,
              }}
            >
              {lang === 'bg' ? 'Напред' : 'Next'} →
            </Button>
          </Box>

          {/* 3 columns */}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1.25 }}>
            {dayDates.map(date => {
              const daySlots = (grouped[date] || [])
              const isTdy    = date === today

              return (
                <Box key={date}>
                  {/* Day header */}
                  <Box sx={{
                    px: 1, py: 0.875, mb: 1,
                    borderRadius: '10px',
                    background: isTdy ? C.accentSoft : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${isTdy ? C.primaryA20 : C.border}`,
                    textAlign: 'center',
                  }}>
                    <Typography sx={{ fontSize: '11px', fontWeight: 800, color: isTdy ? C.purple : C.text, textTransform: 'capitalize' }}>
                      {dayLabel(date, lang)}
                    </Typography>
                    <Typography sx={{ fontSize: '10px', color: C.muted }}>
                      {date.slice(5).replace('-', '/')}
                    </Typography>
                  </Box>

                  {/* Slot bubbles */}
                  {daySlots.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 2.5 }}>
                      <Typography sx={{ fontSize: '11px', color: C.muted }}>
                        {lang === 'bg' ? 'Няма часове' : 'No slots'}
                      </Typography>
                    </Box>
                  ) : (
                    daySlots.map(slot => {
                      const isBooked    = (myBookings || []).some(b => b.slot_id === slot.id && b.status === 'active')
                      const bookCheck   = !isBooked ? canClientBook(slot, myPlan, myBookings || []) : { ok: false }
                      const cancelCheck = isBooked  ? canClientCancel(slot) : { ok: false }
                      const isFull      = (slot.booked_count || 0) >= slot.capacity
                      const freeCount   = slot.capacity - (slot.booked_count || 0)

                      return (
                        <Box key={slot.id} sx={{
                          mb: 1, p: '10px 12px',
                          borderRadius: '12px',
                          border: `1px solid ${isBooked ? C.primaryA20 : C.border}`,
                          background: isBooked
                            ? 'linear-gradient(135deg, rgba(170,169,205,0.12) 0%, rgba(170,169,205,0.06) 100%)'
                            : 'rgba(255,255,255,0.03)',
                          transition: 'border-color 0.15s',
                        }}>
                          {/* Time */}
                          <Typography sx={{ fontWeight: 800, fontSize: '15px', color: C.text, lineHeight: 1.2 }}>
                            {fmtTime(slot.start_time)}
                          </Typography>
                          <Typography sx={{ fontSize: '10px', color: C.muted, mb: 0.625 }}>
                            – {fmtTime(slot.end_time)}
                          </Typography>

                          {/* Coach */}
                          <Typography sx={{ fontSize: '11px', color: C.muted, mb: 0.625, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {slot.coach_name}
                          </Typography>

                          {/* Places badge */}
                          <Box sx={{
                            display: 'inline-block', px: 0.75, py: '2px', mb: 1,
                            borderRadius: '6px',
                            background: isFull ? 'rgba(248,113,113,0.12)' : 'rgba(255,255,255,0.06)',
                            border: `1px solid ${isFull ? 'rgba(248,113,113,0.35)' : C.border}`,
                          }}>
                            <Typography sx={{ fontSize: '10px', fontWeight: 700, color: isFull ? '#F87171' : C.muted }}>
                              {isFull
                                ? (lang === 'bg' ? 'Запълнен' : 'Full')
                                : (lang === 'bg' ? `${freeCount} св. места` : `${freeCount} free`)}
                            </Typography>
                          </Box>

                          {/* Action */}
                          {isBooked ? (
                            <Box>
                              <Typography sx={{ fontSize: '10px', color: C.text, fontWeight: 700, mb: 0.5 }}>
                                ✓ {t('bookedLabel')}
                              </Typography>
                              {cancelCheck.ok && (
                                <Button size="small" fullWidth disabled={bookingBusy}
                                  onClick={() => handleCancel(slot.id)}
                                  sx={{
                                    fontSize: '10px', py: 0.4,
                                    border: `1px solid rgba(248,113,113,0.3)`, color: '#F87171',
                                    borderRadius: '8px',
                                    '&:hover': { border: '1px solid #F87171', background: 'rgba(248,113,113,0.08)' },
                                    '&.Mui-disabled': { opacity: 0.5 },
                                  }}>
                                  {t('cancelBookingBtn')}
                                </Button>
                              )}
                            </Box>
                          ) : isFull ? null : bookCheck.ok ? (
                            <Button size="small" fullWidth variant="contained" disabled={bookingBusy}
                              onClick={() => handleBook(slot.id)}
                              sx={{
                                fontSize: '11px', py: 0.5,
                                background: C.primary, color: '#0f1c11', fontWeight: 700,
                                borderRadius: '8px',
                                '&:hover': { background: '#a8e6a3' },
                                '&.Mui-disabled': { opacity: 0.5 },
                              }}>
                              {t('bookBtn')}
                            </Button>
                          ) : (
                            <Typography sx={{ fontSize: '10px', color: C.muted, fontStyle: 'italic', lineHeight: 1.3 }}>
                              {bookCheck.reason}
                            </Typography>
                          )}
                        </Box>
                      )
                    })
                  )}
                </Box>
              )
            })}
          </Box>
        </>
      )}
    </Box>
  )
}
