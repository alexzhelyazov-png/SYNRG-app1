import { useState } from 'react'
import { Box, Typography, TextField, Button, Chip, Paper, Switch, Collapse } from '@mui/material'
import { useApp } from '../context/AppContext'
import { WORKOUT_CATEGORIES } from '../lib/constants'
import { C, EASE } from '../theme'
import StatCard    from '../components/StatCard'
import ProgressRing from '../components/ProgressRing'
import Tasks       from './Tasks'
import { todayDate, fmt1 } from '../lib/utils'
import { computeReminders } from '../lib/reminders'

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
          🔔 {t('remindersTitle')}
        </Button>
      </Box>
    )
  }

  return (
    <Box sx={{ mb: 2.5, animation: `fadeInUp 0.22s ${EASE.decelerate} both` }}>
      {/* Reminder cards */}
      {visible.map(r => {
        let icon, msg, actions = null

        if (r.type === 'protein') {
          icon = '🥩'
          msg  = t('reminderProteinMsg')
            .replace('{cur}',    r.current)
            .replace('{needed}', r.needed)
            .replace('{tgt}',    r.target)
          actions = (
            <Box sx={{ display: 'flex', gap: 0.75, mt: 1, flexWrap: 'wrap' }}>
              {[
                ['протеин', 30,  t('addShake')],
                ['гръцко кисело мляко', 200, t('addSkyr')],
                ['пилешко филе', 150, t('addChicken')],
              ].map(([, , label]) => (
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
          icon = '⚖️'
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
          icon = '🍽️'
          msg  = t('reminderFoodMsg')
          actions = (
            <Button size="small" onClick={() => { setView('food'); dismiss(r.id) }}
              sx={{ mt: 0.75, fontSize: '12px', color: C.primary, p: 0 }}>
              → {t('navFood')}
            </Button>
          )
        } else if (r.type === 'coach') {
          icon = r.reactionType === 'like' ? '👍' : '💬'
          msg  = r.reactionType === 'like'
            ? `${r.trainerName}: 👍`
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
            <Typography sx={{ fontSize: '20px', lineHeight: 1.3, flexShrink: 0 }}>{icon}</Typography>
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

      {/* Settings toggle */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.5 }}>
        <Button
          size="small"
          onClick={() => setSettingsOpen(p => !p)}
          sx={{ color: C.muted, fontSize: '12px', '&:hover': { color: C.primary } }}
        >
          ⚙️ {t('reminderSettingsTitle')}
        </Button>
      </Box>

      {/* Settings panel */}
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

// ─── Coach view ─────────────────────────────────────────────────
function DashboardCoach() {
  const {
    auth, client, t,
    latestWeight, latestAvg, weeklyRate,
    exName, setExName, exScheme, setExScheme, exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    addExercise, saveWorkout,
    updateClient, updateClientTargets,
  } = useApp()

  const isMobile = window.innerWidth < 640

  return (
    <>
      {/* ── Header ────────────────────────────────────── */}
      <Box sx={{
        display:        'flex',
        justifyContent: 'space-between',
        alignItems:     'flex-start',
        mb:             3,
        gap:            2,
        flexWrap:       'wrap',
        animation:      `fadeInUp 0.22s ${EASE.decelerate} both`,
      }}>
        <Box>
          <Typography variant="h2" sx={{ mb: 0.75 }}>{client.name}</Typography>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 0.5 }}>
            {[
              ['⚖️', latestWeight !== null ? `${fmt1(latestWeight)} ${t('kgUnit')}` : '—', C.text],
              ['〰️', latestAvg    !== null ? `${fmt1(latestAvg)} ${t('kgUnit')}`    : '—', C.purple],
              ['trend', weeklyRate !== null
                ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}`
                : '—',
                weeklyRate === null ? C.muted : weeklyRate > 0 ? C.orange : C.primary],
              ['🔥', `${client.calorieTarget} kcal`, C.text],
              ['🥩', `${client.proteinTarget}${t('gUnit')}`, C.text],
            ].map(([label, val, color]) => (
              <Box key={label} sx={{
                display:      'inline-flex',
                alignItems:   'center',
                gap:          0.5,
                px:           1.25,
                py:           '4px',
                background:   'rgba(255,255,255,0.04)',
                border:       `1px solid ${C.border}`,
                borderRadius: '99px',
                fontSize:     '12.5px',
                color:        C.muted,
                transition:   `border-color 0.2s ${EASE.standard}`,
                '&:hover':    { borderColor: 'rgba(255,255,255,0.12)' },
              }}>
                {label} <span style={{ color, fontWeight: 700 }}>{val}</span>
              </Box>
            ))}
          </Box>
        </Box>

        {/* Target inputs */}
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

      {/* ── Workout Builder ────────────────────────────── */}
      <Paper sx={{
        border:       `1px solid rgba(196,233,191,0.25)`,
        borderRadius: '20px',
        p:            3,
        mb:           2.5,
        background:   'linear-gradient(145deg, rgba(196,233,191,0.04) 0%, #1C1A19 100%)',
        boxShadow:    '0 0 0 1px rgba(196,233,191,0.08), 0 8px 32px rgba(0,0,0,0.3)',
        transition:   `box-shadow 0.3s ${EASE.standard}`,
        '&:hover':    { boxShadow: '0 0 0 1px rgba(196,233,191,0.15), 0 12px 40px rgba(0,0,0,0.4)' },
        animation:    `fadeInUp 0.28s ${EASE.decelerate} 0.06s both`,
      }}>
        {/* Title row */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 2.25 }}>
          <Box sx={{
            width:      8, height: 8,
            borderRadius: '99px',
            background: C.primary,
            boxShadow:  `0 0 10px ${C.primaryGlow}`,
            flexShrink: 0,
            animation:  `pulse 2.5s ${EASE.standard} infinite`,
          }} />
          <Typography variant="h3">
            {t('workout')} — {todayDate()}
          </Typography>
        </Box>

        {/* Category chips */}
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 2.5 }}>
          {WORKOUT_CATEGORIES.map(({ key, icon }) => {
            const active = workoutCategory === key
            return (
              <Chip
                key={key}
                label={`${icon} ${t(key)}`}
                onClick={() => setWorkoutCategory(key)}
                sx={{
                  background:  active ? C.primary : 'rgba(255,255,255,0.04)',
                  color:       active ? '#0A2E0F' : C.text,
                  border:      `1px solid ${active ? C.primary : C.border}`,
                  fontWeight:  active ? 800 : 500,
                  fontSize:    '13px',
                  cursor:      'pointer',
                  transition:  `all 0.18s ${EASE.spring}`,
                  '&:hover':   {
                    background: active ? C.primaryHover : C.accentSoft,
                    transform:  'translateY(-1px)',
                    boxShadow:  active ? `0 4px 12px ${C.primaryGlow}` : 'none',
                  },
                  '& .MuiChip-label': { px: 1.5 },
                }}
              />
            )
          })}
        </Box>

        {/* Exercise inputs */}
        <Box sx={{
          display:             'grid',
          gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr 1fr auto',
          gap:                 1.25,
          mb:                  1.75,
          alignItems:          'end',
        }}>
          {[
            { labelKey: 'exerciseLbl', placeholder: t('exPlaceholder'), value: exName, onChange: e => setExName(e.target.value), large: true },
            { labelKey: 'setsReps',    placeholder: '4×8',              value: exScheme, onChange: e => setExScheme(e.target.value) },
            { labelKey: 'kgLbl',       placeholder: '80',               value: exWeight, onChange: e => setExWeight(e.target.value) },
          ].map(({ labelKey, placeholder, value, onChange, large }) => (
            <Box key={labelKey}>
              <Typography sx={{
                fontSize:      '11px',
                color:         C.muted,
                mb:            0.6,
                fontWeight:    700,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
              }}>
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
            variant="contained"
            color="primary"
            onClick={addExercise}
            sx={{
              py:        '13px',
              px:        2.5,
              fontSize:  '22px',
              alignSelf: 'flex-end',
              minWidth:  '48px',
            }}
          >+</Button>
        </Box>

        {/* Current exercises list */}
        {currentWorkout.length > 0 && (
          <Box sx={{
            background:   'rgba(0,0,0,0.3)',
            border:       `1px solid ${C.border}`,
            borderRadius: '14px',
            p:            1.75,
            mb:           2,
            animation:    `scaleIn 0.18s ${EASE.spring} both`,
          }}>
            <Typography sx={{
              fontSize:      '11px',
              color:         C.muted,
              mb:            1.25,
              fontWeight:    700,
              textTransform: 'uppercase',
              letterSpacing: '0.7px',
            }}>
              {t(workoutCategory)} · {currentWorkout.length} {t('exercisesLbl')}
            </Typography>
            {currentWorkout.map((ex, i) => (
              <Box
                key={i}
                sx={{
                  display:             'grid',
                  gridTemplateColumns: isMobile ? '1fr 80px auto' : '1fr 110px 80px auto',
                  gap:                 1,
                  py:                  1.1,
                  borderBottom:        i < currentWorkout.length - 1 ? `1px solid ${C.border}` : 'none',
                  alignItems:          'center',
                  animation:           `fadeIn 0.18s ${EASE.decelerate} both`,
                  animationDelay:      `${i * 0.04}s`,
                  borderRadius:        '6px',
                  transition:          `background-color 0.12s ${EASE.standard}`,
                  '&:hover':           { backgroundColor: 'rgba(255,255,255,0.025)' },
                }}
              >
                <Typography sx={{ fontWeight: 600, fontSize: '14.5px' }}>{ex.exercise}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.scheme}</Typography>
                <Typography sx={{ color: C.muted, fontSize: '13.5px' }}>{ex.weight} {t('kgUnit')}</Typography>
                <Button
                  size="small"
                  onClick={() => setCurrentWorkout(prev => prev.filter((_, j) => j !== i))}
                  sx={{
                    minWidth:    'auto',
                    background:  C.dangerSoft,
                    color:       C.danger,
                    border:      '1px solid rgba(255,107,157,0.2)',
                    borderRadius:'10px',
                    px:          1.25,
                    py:          '4px',
                    fontSize:    '13px',
                    transition:  `all 0.15s ${EASE.spring}`,
                    '&:hover':   {
                      background: 'rgba(255,107,157,0.18)',
                      boxShadow:  '0 3px 10px rgba(255,107,157,0.2)',
                      transform:  'translateY(-1px)',
                    },
                  }}
                >✕</Button>
              </Box>
            ))}
          </Box>
        )}

        {/* Save button */}
        <Button
          variant="contained"
          fullWidth
          disabled={!currentWorkout.length}
          onClick={saveWorkout}
          sx={{
            py:           1.875,
            fontSize:     '15px',
            fontWeight:   800,
            letterSpacing:'0.3px',
            background:   currentWorkout.length
              ? `linear-gradient(135deg, ${C.primary}, ${C.primaryDeep})`
              : 'rgba(255,255,255,0.06)',
            color:        currentWorkout.length ? C.primaryOn : 'rgba(255,255,255,0.3)',
            boxShadow:    currentWorkout.length ? `0 4px 20px rgba(196,233,191,0.2)` : 'none',
            '&:hover':    {
              background: currentWorkout.length
                ? `linear-gradient(135deg, ${C.primaryHover}, ${C.primary})`
                : 'rgba(255,255,255,0.06)',
              boxShadow:  currentWorkout.length ? `0 6px 24px rgba(196,233,191,0.3)` : 'none',
            },
            '&.Mui-disabled': {
              background: 'rgba(255,255,255,0.06)',
              color:      'rgba(255,255,255,0.3)',
            },
          }}
        >
          💾 {t('saveWorkout')} ({currentWorkout.length} {t('exercisesLbl')})
        </Button>
      </Paper>

      {/* ── Coach react panel ───────────────────────────── */}
      <CoachReactPanel />

      {/* ── Tasks (mobile) ──────────────────────────────── */}
      <Box sx={{ display: { xs: 'block', sm: 'none' } }}>
        <Tasks />
      </Box>

      {/* ── Workout history ─────────────────────────────── */}
      <Paper sx={{
        p:         2.75,
        animation: `fadeInUp 0.3s ${EASE.decelerate} 0.1s both`,
      }}>
        <Typography variant="h3" sx={{ mb: 2 }}>{t('workoutHistory')}</Typography>
        {client.workouts.length === 0 ? (
          <Typography sx={{ color: C.muted, py: 1 }}>{t('noWorkouts')}</Typography>
        ) : (
          client.workouts.map((w, i) => (
            <Box
              key={i}
              sx={{
                mb:           2,
                pb:           1.75,
                borderBottom: i < client.workouts.length - 1 ? `1px solid ${C.border}` : 'none',
                animation:    `fadeIn 0.2s ${EASE.standard} both`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <Box sx={{
                display:        'flex',
                justifyContent: 'space-between',
                mb:             1,
                alignItems:     'center',
                flexWrap:       'wrap',
                gap:            1,
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, color: i === 0 ? C.primary : C.text }}>
                    {w.date}
                  </Typography>
                  {w.category && (
                    <Chip
                      label={t(w.category)}
                      size="small"
                      sx={{
                        background: C.purpleSoft,
                        color:      C.purple,
                        border:     '1px solid rgba(200,197,255,0.2)',
                        fontSize:   '11.5px',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {i === 0 && (
                    <Chip
                      label={t('latestTag')}
                      size="small"
                      sx={{
                        background: C.accentSoft,
                        color:      C.primary,
                        border:     '1px solid rgba(196,233,191,0.3)',
                        fontSize:   '11px',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Box>
                <Typography sx={{ color: C.muted, fontSize: '13px' }}>
                  {t('coachByLbl')}: {w.coach || '—'}
                </Typography>
              </Box>

              <Box sx={{
                background:   'rgba(0,0,0,0.15)',
                borderRadius: '10px',
                p:            '10px 14px',
              }}>
                {w.items.map((ex, j) => (
                  <Box
                    key={j}
                    sx={{
                      display:             'grid',
                      gridTemplateColumns: '1fr 110px 80px',
                      gap:                 1.25,
                      py:                  0.75,
                      borderBottom:        j < w.items.length - 1 ? `1px solid ${C.border}` : 'none',
                      fontSize:            '14px',
                    }}
                  >
                    <Typography sx={{ color: C.text,  fontWeight: 600, fontSize: '13.5px' }}>{ex.exercise}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '13px' }}>{ex.scheme}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '13px' }}>{ex.weight} {t('kgUnit')}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          ))
        )}
      </Paper>
    </>
  )
}

// ─── Client view ─────────────────────────────────────────────────
function DashboardClient() {
  const {
    client, auth, ranking, t,
    latestWeight, latestAvg, weeklyRate,
    kcalPct, protPct, foodTotals,
    setView,
  } = useApp()

  const isMobile  = window.innerWidth < 640
  const myRank    = ranking.findIndex(r => r.name === client.name)
  const myData    = ranking[myRank]
  const medals    = ['🥇', '🥈', '🥉']
  const posLabel  = myRank >= 0 && myRank < 3 ? medals[myRank] : myRank >= 0 ? `#${myRank + 1}` : '—'

  return (
    <>
      {/* ── Smart reminders ───────────────────────────── */}
      <ReminderBanners />

      {/* ── Greeting ──────────────────────────────────── */}
      <Box sx={{
        mb:        3.5,
        animation: `fadeInUp 0.22s ${EASE.decelerate} both`,
      }}>
        <Typography variant="h2" sx={{ mb: 0.5 }}>
          {t('greeting')}, {client.name} 👋
        </Typography>
        <Typography sx={{ color: C.muted, fontSize: '14px' }}>{t('yourProgress')}</Typography>
      </Box>

      {/* ── Today's progress rings ────────────────────── */}
      <Box sx={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap:                 1.5,
        mb:                  2.5,
      }}>
        {[
          [t('todayCalLbl'), kcalPct, foodTotals.kcal,   client.calorieTarget, '',          C.primary, 'primary'],
          [t('todayProtLbl'), protPct, foodTotals.protein, client.proteinTarget, t('gUnit'), C.purple,  'purple'],
        ].map(([label, pct, cur, tgt, suf, color, cn], idx) => (
          <Box
            key={label}
            sx={{
              background:   `linear-gradient(145deg, var(--c-${cn}A5) 0%, var(--c-${cn}A3) 100%)`,
              border:       `1px solid var(--c-${cn}A13)`,
              borderRadius: '16px',
              p:            '18px 20px',
              display:      'flex',
              alignItems:   'center',
              gap:          1.75,
              cursor:       'default',
              transition:   `box-shadow 0.25s ${EASE.standard}, transform 0.25s ${EASE.standard}, border-color 0.25s ${EASE.standard}`,
              animation:    `fadeInUp 0.22s ${EASE.decelerate} ${0.06 + idx * 0.04}s both`,
              '&:hover':    {
                transform:   'translateY(-2px)',
                boxShadow:   `0 0 0 1px var(--c-${cn}A20), 0 8px 28px var(--c-shadow)`,
                borderColor: `var(--c-${cn}A20)`,
              },
            }}
          >
            <Box sx={{ position: 'relative', flexShrink: 0 }}>
              <ProgressRing percent={pct} color={color} size={64} />
              <Box sx={{
                position:       'absolute',
                inset:          0,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                fontSize:       '11px',
                fontWeight:     700,
                color,
              }}>
                {Math.round(pct)}%
              </Box>
            </Box>
            <Box>
              <Typography sx={{
                fontSize:      '10.5px',
                color:         C.muted,
                mb:            0.6,
                textTransform: 'uppercase',
                letterSpacing: '0.8px',
                fontWeight:    700,
              }}>
                {label}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                <Typography sx={{
                  fontSize:      '26px',
                  fontWeight:    800,
                  color,
                  lineHeight:    1.1,
                  letterSpacing: '-0.5px',
                  fontFamily:    "'Space Grotesk', sans-serif",
                }}>
                  {fmt1(cur)}{suf}
                </Typography>
                <Typography sx={{ color: C.muted, fontSize: '13px', fontWeight: 600 }}>
                  / {tgt}{suf}
                </Typography>
              </Box>
            </Box>
          </Box>
        ))}
      </Box>

      {/* ── Weight stat cards ─────────────────────────── */}
      <Box sx={{
        display:             'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap:                 1.5,
        mb:                  2.5,
        animation:           `fadeInUp 0.26s ${EASE.decelerate} 0.1s both`,
      }}>
        <StatCard
          label={t('weightKgLbl')}
          value={latestWeight !== null ? `${fmt1(latestWeight)} ${t('kgUnit')}` : '—'}
          sub={t('lastMeasurement')}
        />
        <StatCard
          label={t('sevenDayAvg')}
          value={latestAvg !== null ? `${fmt1(latestAvg)} ${t('kgUnit')}` : '—'}
        />
        <StatCard
          label="Weekly Rate"
          value={weeklyRate !== null ? `${weeklyRate > 0 ? '+' : ''}${fmt1(weeklyRate)} ${t('kgWeek')}` : '—'}
          accent={weeklyRate !== null && weeklyRate < 0}
          sub={weeklyRate === null ? t('insufficientData') : weeklyRate > 0 ? t('gaining') : t('losing')}
        />
      </Box>

      {/* ── Ranking position ──────────────────────────── */}
      {myData && (
        <Paper sx={{
          p:         2.75,
          animation: `fadeInUp 0.28s ${EASE.decelerate} 0.14s both`,
        }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h3">{t('myRanking')}</Typography>
            <Button
              variant="outlined"
              size="small"
              onClick={() => setView('ranking')}
              sx={{
                fontSize:   '13px',
                transition: `all 0.18s ${EASE.spring}`,
                '&:hover':  { transform: 'translateX(2px)' },
              }}
            >
              {t('seeAll')}
            </Button>
          </Box>

          <Box sx={{
            display:      'flex',
            alignItems:   'center',
            gap:          2.5,
            background:   'linear-gradient(135deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.06) 100%)',
            border:       '1px solid rgba(196,233,191,0.2)',
            borderRadius: '16px',
            p:            '16px 20px',
            transition:   `box-shadow 0.25s ${EASE.standard}`,
            '&:hover':    { boxShadow: '0 4px 20px rgba(196,233,191,0.1)' },
          }}>
            <Typography sx={{
              fontSize:  '44px',
              lineHeight: 1,
              minWidth:  '56px',
              textAlign: 'center',
              filter:    myRank === 0 ? 'drop-shadow(0 0 8px rgba(196,233,191,0.4))' : 'none',
            }}>
              {posLabel}
            </Typography>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{
                fontWeight:    800,
                fontSize:      '22px',
                color:         C.primary,
                mb:            0.75,
                fontFamily:    "'Space Grotesk', sans-serif",
                letterSpacing: '-0.4px',
              }}>
                {myData.points} {t('points')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                {[
                  ['⚖️', myData.breakdown.weightPts],
                  ['💪', myData.breakdown.workoutPts],
                  ['🔥', myData.breakdown.calPts],
                  ['🥩', myData.breakdown.protPts],
                ].map(([ico, pts]) => (
                  <Typography key={ico} sx={{ fontSize: '13px', color: C.muted }}>
                    {ico} <span style={{ color: C.text, fontWeight: 700 }}>{pts}</span>
                  </Typography>
                ))}
              </Box>
            </Box>
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography sx={{ fontSize: '13px', color: C.muted }}>
                {t('ofLbl')} {ranking.length} {t('ofClients')}
              </Typography>
              {myRank > 0 && (
                <Typography sx={{ fontSize: '13px', color: C.muted, mt: 0.5 }}>
                  {t('toFirst')} <span style={{ color: C.primary, fontWeight: 700 }}>
                    {ranking[0].points - myData.points} {t('points')}
                  </span>
                </Typography>
              )}
            </Box>
          </Box>
        </Paper>
      )}

      {/* ── Workout history (client) ───────────────────── */}
      {client.workouts && client.workouts.length > 0 && (
        <Paper sx={{
          p:         2.75,
          mt:        2.5,
          animation: `fadeInUp 0.3s ${EASE.decelerate} 0.18s both`,
        }}>
          <Typography variant="h3" sx={{ mb: 2 }}>{t('workoutHistory')}</Typography>
          {client.workouts.slice(0, 10).map((w, i) => (
            <Box
              key={i}
              sx={{
                display:        'flex',
                alignItems:     'center',
                gap:            1.5,
                py:             1.1,
                px:             1,
                mx:             -1,
                borderBottom:   i < Math.min(client.workouts.length, 10) - 1 ? `1px solid ${C.border}` : 'none',
                borderRadius:   '8px',
                transition:     `background-color 0.12s ${EASE.standard}`,
                '&:hover':      { background: 'rgba(255,255,255,0.025)' },
                animation:      `fadeIn 0.18s ${EASE.standard} both`,
                animationDelay: `${i * 0.04}s`,
              }}
            >
              <Typography sx={{ color: C.muted, fontSize: '13px', minWidth: '92px', fontWeight: 500 }}>
                {w.date}
              </Typography>
              {w.category && (
                <Chip
                  label={t(w.category)}
                  size="small"
                  sx={{
                    background: C.purpleSoft,
                    color:      C.purple,
                    border:     '1px solid rgba(200,197,255,0.2)',
                    fontSize:   '11.5px',
                    fontWeight: 600,
                  }}
                />
              )}
              {i === 0 && (
                <Chip
                  label={t('latestTag')}
                  size="small"
                  sx={{
                    background: C.accentSoft,
                    color:      C.primary,
                    border:     '1px solid rgba(196,233,191,0.3)',
                    fontSize:   '11px',
                    fontWeight: 700,
                  }}
                />
              )}
              <Typography sx={{ color: C.muted, fontSize: '12px', ml: 'auto' }}>
                {w.items?.length || 0} {t('exercisesLbl')}
              </Typography>
            </Box>
          ))}
        </Paper>
      )}

      {/* ── Tasks (mobile) ──────────────────────────────── */}
      <Box sx={{ display: { xs: 'block', sm: 'none' }, mt: 2.5 }}>
        <Tasks />
      </Box>
    </>
  )
}

// ─── Dashboard router ─────────────────────────────────────────────
export default function Dashboard() {
  const { auth } = useApp()
  return auth.role === 'coach' ? <DashboardCoach /> : <DashboardClient />
}
