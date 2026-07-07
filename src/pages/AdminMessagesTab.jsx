import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Typography, TextField, IconButton, Paper, Button, Divider, Chip,
  Collapse,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { useApp } from '../context/AppContext'
import { isAdmin, isFullAdmin } from '../lib/bookingUtils'
import { DB } from '../lib/db'
import { C } from '../theme'

// Inline editable numeric field. Click value → input → Enter/blur saves.
// Used for daily targets (calories, protein) which the coach often adjusts.
function EditableNumber({ value, suffix, onSave }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)

  function start() {
    setDraft(value === null || value === undefined ? '' : String(value))
    setEditing(true)
  }

  async function commit() {
    if (saving) return
    const trimmed = draft.trim()
    const num = trimmed === '' ? null : Number(trimmed)
    if (trimmed !== '' && (!Number.isFinite(num) || num < 0)) {
      setEditing(false)
      return
    }
    if (num === (value ?? null)) {
      setEditing(false)
      return
    }
    setSaving(true)
    try {
      await onSave(num)
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <input
        type="number"
        value={draft}
        autoFocus
        disabled={saving}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter')  commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{
          width: 70, padding: '2px 6px', fontSize: 12, fontWeight: 500,
          background: C.card, color: C.text,
          border: `1px solid ${C.primary || '#c4e9bf'}`, borderRadius: 6, outline: 'none',
        }}
      />
    )
  }
  const display = value === null || value === undefined || value === '' ? '—' : `${value}${suffix ? ' ' + suffix : ''}`
  return (
    <span
      onClick={start}
      title="Кликни за промяна"
      style={{
        cursor: 'pointer', borderBottom: `1px dashed ${C.muted}`, paddingBottom: 1,
      }}
    >
      {display}
    </span>
  )
}

// Compact client snapshot for the coach to read while replying. Loads quiz +
// program state + recent activity on demand (only when expanded). Empty fields
// show '—' so the coach can spot what hasn't been filled in.
function ClientInfoPanel({ client }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState(null)
  const [targets, setTargets] = useState({
    calorie: client?.calorieTarget || client?.calorie_target || null,
    protein: client?.proteinTarget || client?.protein_target || null,
  })
  // Sync local targets when switching clients
  useEffect(() => {
    setTargets({
      calorie: client?.calorieTarget || client?.calorie_target || null,
      protein: client?.proteinTarget || client?.protein_target || null,
    })
  }, [client?.id])

  async function saveTarget(field, value) {
    if (!client?.id) return
    const dbField = field === 'calorie' ? 'calorie_target' : 'protein_target'
    await DB.update('clients', client.id, { [dbField]: value })
    setTargets(prev => ({ ...prev, [field]: value }))
  }
  useEffect(() => {
    if (!open || data || !client?.id) return
    let cancelled = false
    Promise.all([
      DB.findWhere('client_program_state',         'client_id', client.id).catch(() => []),
      DB.findWhere('program_purchases',            'client_id', client.id).catch(() => []),
      DB.findWhere('meals',                        'client_id', client.id).catch(() => []),
      DB.findWhere('weight_logs',                  'client_id', client.id).catch(() => []),
      DB.findWhere('client_workout_completions',   'client_id', client.id).catch(() => []),
      DB.findWhere('steps_logs',                   'client_id', client.id).catch(() => []),
    ]).then(([states, purchases, meals, weights, workouts, steps]) => {
      if (cancelled) return
      const state    = (states    || [])[0] || null
      const purchase = (purchases || []).filter(p => p.status === 'active')
        .sort((a, b) => (b.purchased_at || '').localeCompare(a.purchased_at || ''))[0] || null

      const sortDesc = (a, b, key = 'created_at') => (b[key] || '').localeCompare(a[key] || '')

      // Meals: aggregate by day, then total stats
      const allMeals = (meals || []).slice().sort((a, b) => sortDesc(a, b, 'created_at'))
      const mealsByDay = new Map()
      for (const m of allMeals) {
        const day = (m.created_at || m.eaten_at || '').slice(0, 10)
        if (!day) continue
        const cur = mealsByDay.get(day) || { date: day, count: 0, kcal: 0 }
        cur.count += 1
        cur.kcal  += Number(m.kcal || 0)
        mealsByDay.set(day, cur)
      }
      const byDay = Array.from(mealsByDay.values()).sort((a, b) => b.date.localeCompare(a.date))
      const today = new Date()
      const last7Cutoff = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6).toISOString().slice(0, 10)
      const daysLast7  = byDay.filter(d => d.date >= last7Cutoff).length
      const avgKcal    = byDay.length ? byDay.reduce((s, d) => s + d.kcal, 0) / byDay.length : 0
      const mealStats = {
        distinctDays: byDay.length,
        lastDay:      byDay[0]?.date || null,
        avgKcal,
        daysLast7,
        byDay,
      }

      // Weights: history + delta
      const allWeights = (weights || []).slice().sort((a, b) =>
        (b.logged_at || b.created_at || '').localeCompare(a.logged_at || a.created_at || '')
      )
      let weightStats = null
      if (allWeights.length) {
        const current = Number(allWeights[0].weight)
        const first   = Number(allWeights[allWeights.length - 1].weight)
        weightStats = {
          current,
          first,
          delta: current - first,
          firstDate: allWeights[allWeights.length - 1].logged_at || allWeights[allWeights.length - 1].created_at,
          lastDate:  allWeights[0].logged_at || allWeights[0].created_at,
        }
      }

      // Workouts: completion stats
      const allWorkouts = (workouts || []).slice().sort((a, b) => sortDesc(a, b, 'completed_at'))
      const workoutsByDay = new Set(allWorkouts.map(w => (w.completed_at || w.created_at || '').slice(0, 10)).filter(Boolean))
      const workoutsLast7 = Array.from(workoutsByDay).filter(d => d >= last7Cutoff).length
      const workoutStats = {
        total:        allWorkouts.length,
        distinctDays: workoutsByDay.size,
        lastDay:      allWorkouts[0]?.completed_at || allWorkouts[0]?.created_at || null,
        last7:        workoutsLast7,
      }

      // Steps: daily logs aggregation
      const allSteps = (steps || []).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''))
      const stepsLast7 = allSteps.filter(s => (s.date || '') >= last7Cutoff)
      const totalSteps = allSteps.reduce((s, x) => s + Number(x.steps || 0), 0)
      const avgStepsLast7 = stepsLast7.length ? stepsLast7.reduce((s, x) => s + Number(x.steps || 0), 0) / stepsLast7.length : 0
      const stepStats = {
        days:    allSteps.length,
        total:   totalSteps,
        last:    allSteps[0] || null,
        avgLast7: avgStepsLast7,
        recent:  allSteps.slice(0, 5),
      }

      setData({ state, purchase, allMeals, mealStats, allWeights, weightStats, allWorkouts, workoutStats, allSteps, stepStats })
    })
    return () => { cancelled = true }
  }, [open, client?.id])

  // Quiz lives on the client row itself (synrg_quiz jsonb column).
  const quiz = client?.synrgQuiz || client?.synrg_quiz || null

  function fmt(v) { return v === null || v === undefined || v === '' ? '—' : String(v) }
  function fmtDate(s) {
    if (!s) return '—'
    try { return new Date(s).toLocaleDateString('bg-BG') } catch { return String(s).slice(0, 10) }
  }

  // 8-week progress: derive current week from started_at if state.current_week missing.
  let weekN = null
  if (data?.state) {
    const startedAt = data.state.started_at
    const cur = Number(data.state.current_week) || 0
    if (cur > 0) weekN = Math.min(8, cur)
    else if (startedAt) {
      const days = Math.floor((Date.now() - new Date(startedAt).getTime()) / (24 * 3600 * 1000))
      weekN = Math.min(8, Math.max(1, Math.floor(days / 7) + 1))
    }
  }

  const Row = ({ label, value }) => (
    <Box sx={{ display: 'flex', gap: 1, py: 0.5 }}>
      <Typography sx={{ fontSize: 11, color: C.muted, minWidth: 92, flexShrink: 0 }}>{label}</Typography>
      <Typography sx={{ fontSize: 12, color: C.text, fontWeight: 500, wordBreak: 'break-word' }}>{value}</Typography>
    </Box>
  )

  return (
    <Box sx={{ borderBottom: `1px solid ${C.border}` }}>
      <Box
        onClick={() => setOpen(o => !o)}
        sx={{
          px: 2, py: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          cursor: 'pointer', userSelect: 'none',
          '&:hover': { background: 'rgba(255,255,255,0.03)' },
        }}
      >
        <Typography sx={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: '0.06em' }}>
          ПРОФИЛ НА КЛИЕНТА
        </Typography>
        <ExpandMoreIcon sx={{
          fontSize: 18, color: C.muted,
          transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }} />
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 2, pb: 2 }}>
          {!data ? (
            <Typography sx={{ fontSize: 12, color: C.muted, py: 1 }}>Зарежда...</Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
              {/* Program */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(196,233,191,0.05)', border: '1px solid rgba(196,233,191,0.15)' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#c4e9bf', mb: 0.5, letterSpacing: '0.06em' }}>
                  ПРОГРАМА
                </Typography>
                {data.purchase ? (
                  <>
                    <Row label="Седмица" value={weekN ? `${weekN} / 8` : '—'} />
                    <Row label="Старт"   value={fmtDate(data.state?.started_at)} />
                    <Row label="Валидна до" value={fmtDate(data.purchase.valid_until)} />
                    <Row label="Платено"  value={`${(Number(data.purchase.amount_cents || 0) / 100).toFixed(0)} ${(data.purchase.currency || 'EUR').toUpperCase()}`} />
                  </>
                ) : (
                  <Typography sx={{ fontSize: 12, color: C.muted }}>Без активна онлайн програма</Typography>
                )}
              </Paper>

              {/* Targets — inline editable so the coach can adjust directly from chat */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(165,180,252,0.05)', border: '1px solid rgba(165,180,252,0.15)' }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', mb: 0.5, letterSpacing: '0.06em' }}>
                  ДНЕВНИ ЦЕЛИ
                </Typography>
                <Row label="Калории" value={
                  <EditableNumber value={targets.calorie} onSave={v => saveTarget('calorie', v)} />
                } />
                <Row label="Протеин" value={
                  <EditableNumber value={targets.protein} suffix="г" onSave={v => saveTarget('protein', v)} />
                } />
              </Paper>

              {/* Quiz */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}`, gridColumn: { xs: '1', sm: '1 / -1' } }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.06em' }}>
                  ВЪПРОСНИК
                </Typography>
                {!quiz ? (
                  <Typography sx={{ fontSize: 12, color: '#F87171', fontStyle: 'italic' }}>Не е попълнен</Typography>
                ) : (
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: '1fr 1fr 1fr' }, gap: 0.5 }}>
                    {Object.entries(quiz).map(([k, v]) => (
                      <Row key={k} label={k} value={fmt(v)} />
                    ))}
                  </Box>
                )}
              </Paper>

              {/* Meals — compliance stats + history */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.06em' }}>
                  ХРАНЕНЕ
                </Typography>
                {data.allMeals.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: '#F87171', fontStyle: 'italic' }}>Не записва нищо</Typography>
                ) : (
                  <>
                    <Row label="Общо записи" value={`${data.allMeals.length}`} />
                    <Row label="Различни дни" value={`${data.mealStats.distinctDays}`} />
                    <Row label="Последен ден" value={fmtDate(data.mealStats.lastDay)} />
                    <Row label="Ср. ккал/ден" value={data.mealStats.avgKcal ? `${Math.round(data.mealStats.avgKcal)}` : '—'} />
                    <Row label="Дни последните 7" value={`${data.mealStats.daysLast7} / 7`} />
                    {data.mealStats.byDay.length > 0 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${C.border}` }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: C.muted, mb: 0.5 }}>ПОСЛЕДНИ ДНИ</Typography>
                        {data.mealStats.byDay.slice(0, 5).map(d => (
                          <Row key={d.date} label={fmtDate(d.date)} value={`${d.count} запис${d.count !== 1 ? 'а' : ''} · ${Math.round(d.kcal)} ккал`} />
                        ))}
                      </Box>
                    )}
                  </>
                )}
              </Paper>

              {/* Workouts — completion stats */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.06em' }}>
                  ТРЕНИРОВКИ
                </Typography>
                {data.workoutStats.total === 0 ? (
                  <Typography sx={{ fontSize: 12, color: '#F87171', fontStyle: 'italic' }}>Не тренира</Typography>
                ) : (
                  <>
                    <Row label="Общо" value={`${data.workoutStats.total}`} />
                    <Row label="Различни дни" value={`${data.workoutStats.distinctDays}`} />
                    <Row label="Дни последните 7" value={`${data.workoutStats.last7} / 7`} />
                    <Row label="Последна" value={fmtDate(data.workoutStats.lastDay)} />
                  </>
                )}
              </Paper>

              {/* Steps — daily activity */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.06em' }}>
                  СТЪПКИ
                </Typography>
                {data.stepStats.days === 0 ? (
                  <Typography sx={{ fontSize: 12, color: '#F87171', fontStyle: 'italic' }}>Не записва стъпки</Typography>
                ) : (
                  <>
                    <Row label="Дни записи" value={`${data.stepStats.days}`} />
                    <Row label="Общо стъпки" value={data.stepStats.total.toLocaleString('bg-BG')} />
                    <Row label="Ср. посл. 7 дни" value={data.stepStats.avgLast7 ? `${Math.round(data.stepStats.avgLast7).toLocaleString('bg-BG')}` : '—'} />
                    <Row label="Последно" value={data.stepStats.last ? `${Number(data.stepStats.last.steps || 0).toLocaleString('bg-BG')} (${fmtDate(data.stepStats.last.date)})` : '—'} />
                    {data.stepStats.recent.length > 1 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${C.border}` }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: C.muted, mb: 0.5 }}>ПОСЛЕДНИ ДНИ</Typography>
                        {data.stepStats.recent.map(s => (
                          <Row key={s.id || s.date} label={fmtDate(s.date)} value={Number(s.steps || 0).toLocaleString('bg-BG')} />
                        ))}
                      </Box>
                    )}
                  </>
                )}
              </Paper>

              {/* Weight — progress stats + history */}
              <Paper sx={{ p: 1.25, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: `1px solid ${C.border}` }}>
                <Typography sx={{ fontSize: 10, fontWeight: 700, color: C.muted, mb: 0.5, letterSpacing: '0.06em' }}>
                  ТЕГЛО
                </Typography>
                {data.allWeights.length === 0 ? (
                  <Typography sx={{ fontSize: 12, color: '#F87171', fontStyle: 'italic' }}>Не се претегля</Typography>
                ) : (
                  <>
                    <Row label="Общо записи" value={`${data.allWeights.length}`} />
                    <Row label="Текущо" value={`${data.weightStats.current} кг`} />
                    <Row label="Начално" value={`${data.weightStats.first} кг (${fmtDate(data.weightStats.firstDate)})`} />
                    <Row label="Промяна" value={
                      <span style={{
                        color: data.weightStats.delta < 0 ? '#c4e9bf' : data.weightStats.delta > 0 ? '#FBBF24' : C.text,
                        fontWeight: 700,
                      }}>
                        {data.weightStats.delta > 0 ? '+' : ''}{data.weightStats.delta.toFixed(1)} кг
                      </span>
                    } />
                    <Row label="Последно" value={fmtDate(data.weightStats.lastDate)} />
                    {data.allWeights.length > 1 && (
                      <Box sx={{ mt: 1, pt: 1, borderTop: `1px solid ${C.border}` }}>
                        <Typography sx={{ fontSize: 9, fontWeight: 700, color: C.muted, mb: 0.5 }}>ИСТОРИЯ</Typography>
                        {data.allWeights.slice(0, 5).map(w => (
                          <Row key={w.id || w.logged_at} label={fmtDate(w.logged_at || w.created_at)} value={`${w.weight} кг`} />
                        ))}
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            </Box>
          )}
        </Box>
      </Collapse>
    </Box>
  )
}

// ── Admin Messages Tab ────────────────────────────────────────
// For coach (shows only their assigned clients) and admin (shows all).
// Admin can filter by coach; messages from admin get a distinct gold badge.
export default function AdminMessagesTab() {
  const {
    auth, clients, coaches,
    coachMessages, coachMsgsLoaded,
    sendCoachMessage, markCoachMessagesRead, assignCoach,
  } = useApp()

  // Only real coaches (exclude admin shadow profiles)
  const realCoaches = coaches.filter(c => !/^Админ/i.test(c.name))

  // Admin status is determined by name (role is 'coach' for everyone in coaches table)
  const isAdminUser = isAdmin(auth) || isFullAdmin(auth) || auth.role === 'admin'
  // Shadow admins (АдминАлекс, АдминКари) are pure overseers: they see ALL
  // inboxes via the coach tabs. Real coaches — incl. Елина, who also has
  // admin rights — see ONLY their own clients here (each answers their own).
  const isShadowAdmin = auth.role === 'admin' || /^Админ/i.test(auth.name || '')
  const [selectedClientId, setSelectedClientId] = useState(null)
  // Default to Studio — that's where all current clients live. Online will
  // populate once real Stripe-subscribed clients start signing up.
  const [clientTypeFilter, setClientTypeFilter] = useState('studio') // 'online' | 'studio'
  const [onlineClientIds, setOnlineClientIds] = useState(() => new Set())
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  // A client is ONLINE iff they bought the online program via Stripe — i.e. they have
  // a row in `program_purchases` (inserted by the stripe-webhook function). Everyone
  // else (including studio 8/12/unlimited clients, ex-studio, freemium-only) = STUDIO.
  useEffect(() => {
    let cancelled = false
    DB.selectAll('program_purchases').then(rows => {
      if (cancelled) return
      // Only ACTIVE purchases count as online — refunded/disputed/expired clients
      // shouldn't surface in the online filter (they're back to free tier).
      const ids = new Set(
        (rows || [])
          .filter(r => r.status === 'active')
          .map(r => r.client_id)
          .filter(Boolean)
      )
      setOnlineClientIds(ids)
    }).catch(() => { /* silent — treat as no online clients */ })
    return () => { cancelled = true }
  }, [])

  const isOnline = (c) => onlineClientIds.has(c.id)

  // ── Shared inbox: coach tabs ИЦКО | ЕЛИНА | ДРУГИ ────────────
  // EVERY staff member (both coaches + admins) sees ALL tabs with per-tab
  // unread counts, so a client message can never sit unseen in a colleague's
  // inbox. A client shows in a coach's tab if assigned to them OR has a
  // message thread with them (union — a thread is never invisible).
  const mainCoaches = useMemo(() => {
    const icko  = realCoaches.find(c => /ицко/i.test(c.name || ''))
    const elina = realCoaches.find(c => /елина/i.test(c.name || ''))
    return [icko, elina].filter(Boolean)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coaches])

  // clientId → Set(coach ids they have a thread with)
  const threadCoachesByClient = useMemo(() => {
    const map = new Map()
    for (const m of coachMessages) {
      if (!m.client_id || !m.coach_id) continue
      if (!map.has(m.client_id)) map.set(m.client_id, new Set())
      map.get(m.client_id).add(m.coach_id)
    }
    return map
  }, [coachMessages])

  const belongsToCoach = (c, coachId) =>
    c.assigned_coach_id === coachId || threadCoachesByClient.get(c.id)?.has(coachId)

  const [coachTab, setCoachTab] = useState(null) // coach id | 'other' (shadow admins only)
  useEffect(() => {
    if (coachTab || !mainCoaches.length) return
    setCoachTab(mainCoaches[0].id)
  }, [mainCoaches, coachTab])

  const realClientList = useMemo(() => clients.filter(c => !c.is_coach && c.id), [clients])

  const tabClientIds = useMemo(() => {
    const res = {}
    for (const k of mainCoaches) {
      res[k.id] = new Set(realClientList.filter(c => belongsToCoach(c, k.id)).map(c => c.id))
    }
    res.other = new Set(
      realClientList
        .filter(c => !mainCoaches.some(k => belongsToCoach(c, k.id)))
        .map(c => c.id)
    )
    return res
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realClientList, mainCoaches, threadCoachesByClient])

  const unreadByTab = useMemo(() => {
    const count = (set) => coachMessages.filter(m => m.sender_role === 'client' && !m.read_at && set?.has(m.client_id)).length
    const res = { other: count(tabClientIds.other) }
    for (const k of mainCoaches) res[k.id] = count(tabClientIds[k.id])
    return res
  }, [coachMessages, tabClientIds, mainCoaches])

  // Visible scope: shadow admin → the selected coach tab; real coach → ONLY
  // their own clients (assigned OR with an existing thread with them).
  const scopedClients = useMemo(() => {
    if (!isShadowAdmin) return realClientList.filter(c => belongsToCoach(c, auth.id))
    const set = (coachTab && tabClientIds[coachTab]) || new Set()
    return realClientList.filter(c => set.has(c.id))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realClientList, isShadowAdmin, auth.id, tabClientIds, coachTab, threadCoachesByClient])

  const eligibleClients = useMemo(() => {
    return clientTypeFilter === 'online'
      ? scopedClients.filter(isOnline)
      : scopedClients.filter(c => !isOnline(c))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopedClients, clientTypeFilter, onlineClientIds])

  // Compute per-client chat summary
  const clientRows = useMemo(() => {
    return eligibleClients.map(c => {
      const msgs = coachMessages.filter(m => m.client_id === c.id)
      const last = msgs.length ? msgs[msgs.length - 1] : null
      const unread = msgs.filter(m => m.sender_role === 'client' && !m.read_at).length
      return { client: c, last, unread, hasMessages: msgs.length > 0 }
    }).sort((a, b) => {
      // Unread first, then most recent message, then name
      if (a.unread !== b.unread) return b.unread - a.unread
      const ta = a.last?.created_at || ''
      const tb = b.last?.created_at || ''
      if (ta !== tb) return tb.localeCompare(ta)
      return (a.client.name || '').localeCompare(b.client.name || '', 'bg')
    })
  }, [eligibleClients, coachMessages])

  const selected = selectedClientId ? clients.find(c => c.id === selectedClientId) : null
  const thread = selected
    ? coachMessages.filter(m => m.client_id === selected.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    : []

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.length, selectedClientId])

  // Mark as read when opening a thread
  useEffect(() => {
    if (selectedClientId) markCoachMessagesRead(selectedClientId)
  }, [selectedClientId, thread.length, markCoachMessagesRead])

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected || sending) return
    // For admin sending on behalf: use the assigned_coach_id, else fallback to current user.
    const coachId = selected.assigned_coach_id || (!isAdminUser ? auth.id : null)
    if (!coachId) {
      alert('Клиентът няма назначен треньор. Първо му назначи треньор.')
      return
    }
    setSending(true)
    setDraft('')
    try {
      await sendCoachMessage({
        clientId: selected.id,
        coachId,
        text,
      })
    } finally {
      setSending(false)
    }
  }

  // ── Detail view ─────────────────────────────────────────────
  if (selected) {
    const assignedCoach = selected.assigned_coach_id ? coaches.find(c => c.id === selected.assigned_coach_id) : null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 420 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.5, borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
          <IconButton onClick={() => setSelectedClientId(null)} size="small" sx={{ color: C.muted }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.name}</Typography>
            {!isAdminUser && (
              <Typography sx={{ fontSize: 11, color: C.muted }}>
                Треньор: {assignedCoach?.name || <span style={{ color: '#ff6b6b' }}>не е назначен</span>}
              </Typography>
            )}
          </Box>
          {/* Inline coach assignment (admin only) */}
          {isAdminUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <Typography sx={{ fontSize: 11, color: C.muted, fontWeight: 700 }}>Треньор:</Typography>
              <select
                value={selected.assigned_coach_id || ''}
                onChange={async (e) => {
                  const newId = e.target.value || null
                  await assignCoach(selected.id, newId)
                }}
                style={{
                  padding: '6px 8px', fontSize: 12,
                  background: C.card, color: C.text,
                  border: `1px solid ${!selected.assigned_coach_id ? '#ef4444' : C.border}`,
                  borderRadius: 8, outline: 'none', cursor: 'pointer',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                <option value="" style={{ background: C.card, color: C.text }}>— назначи —</option>
                {realCoaches.map(c => (
                  <option key={c.id} value={c.id} style={{ background: C.card, color: C.text }}>{c.name}</option>
                ))}
              </select>
            </Box>
          )}
        </Box>

        {/* Collapsible client snapshot — quick context for the coach (quiz,
            program week, targets, recent meals/weight) */}
        <ClientInfoPanel client={selected} />

        {/* Messages */}
        <Box
          ref={scrollRef}
          sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {thread.length === 0 && (
            <Typography sx={{ fontSize: 13, color: C.muted, textAlign: 'center', mt: 3 }}>
              Няма съобщения с този клиент.
            </Typography>
          )}
          {thread.map(m => {
            const isClient = m.sender_role === 'client'
            const isAdminMsg = m.sender_role === 'admin'
            return (
              <Box key={m.id} sx={{ alignSelf: isClient ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
                <Paper elevation={0} sx={{
                  px: 1.5, py: 1,
                  borderRadius: isClient ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                  background: isClient ? C.surface : (isAdminMsg ? '#3b2a1f' : C.purple),
                  color: isClient ? C.text : '#fff',
                  border: isClient ? `1px solid ${C.border}` : 'none',
                }}>
                  {isAdminMsg && (
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', mb: 0.25, letterSpacing: '0.04em' }}>
                      {m.sender_name || 'Собственик'}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text}
                  </Typography>
                </Paper>
                <Typography sx={{ fontSize: 10, color: C.muted, mt: 0.25, textAlign: isClient ? 'left' : 'right' }}>
                  {new Date(m.created_at).toLocaleString('bg-BG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Composer */}
        <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1, borderTop: `1px solid ${C.border}` }}>
          <TextField
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={isAdminUser ?'Пишеш като собственик (жълто)...' : 'Съобщение…'}
            multiline
            maxRows={4}
            size="small"
            fullWidth
            disabled={sending}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontSize: 14 } }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            sx={{
              color: '#fff',
              background: isAdminUser ?'#d97706' : C.purple,
              borderRadius: '12px',
              width: 44, height: 44,
              alignSelf: 'flex-end',
              '&:hover': { background: isAdminUser ?'#d97706' : C.purple, opacity: 0.9 },
              '&:disabled': { background: C.border, color: C.muted },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    )
  }

  // ── List view ───────────────────────────────────────────────
  return (
    <Box>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: C.text, mb: 2 }}>
        Съобщения
      </Typography>

      {/* Coach tabs — ONLY shadow admins oversee all inboxes (ИЦКО | ЕЛИНА |
          ДРУГИ). Real coaches see just their own clients — no tabs. */}
      {isShadowAdmin && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          {mainCoaches.map(k => (
            <CoachTab
              key={k.id}
              active={coachTab === k.id}
              onClick={() => setCoachTab(k.id)}
              label={(k.name || '').toUpperCase()}
              unread={unreadByTab[k.id] || 0}
            />
          ))}
          <CoachTab
            active={coachTab === 'other'}
            onClick={() => setCoachTab('other')}
            label="ДРУГИ"
            unread={unreadByTab.other || 0}
          />
        </Box>
      )}

      {/* Online / Studio filter — shown for BOTH admins and regular coaches.
          Pink bubbles show unread per bucket so a message can't hide behind
          the other filter. */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
        {(() => {
          const onlineScoped = scopedClients.filter(isOnline)
          const studioScoped = scopedClients.filter(c => !isOnline(c))
          const unreadIn = (list) => {
            const s = new Set(list.map(c => c.id))
            return coachMessages.filter(m => m.sender_role === 'client' && !m.read_at && s.has(m.client_id)).length
          }
          const onlineUnread = unreadIn(onlineScoped)
          const studioUnread = unreadIn(studioScoped)
          const onlineCount = onlineScoped.length
          const studioCount = studioScoped.length
          return (
            <>
              <FilterChip active={clientTypeFilter === 'online'} onClick={() => setClientTypeFilter('online')} unread={onlineUnread}>
                Онлайн ({onlineCount})
              </FilterChip>
              <FilterChip active={clientTypeFilter === 'studio'} onClick={() => setClientTypeFilter('studio')} unread={studioUnread}>
                Студио ({studioCount})
              </FilterChip>
            </>
          )
        })()}
      </Box>

      {!coachMsgsLoaded && (
        <Typography sx={{ color: C.muted, fontSize: 13, py: 2 }}>Зареждане…</Typography>
      )}

      <Paper sx={{ overflow: 'hidden' }}>
        {clientRows.length === 0 && coachMsgsLoaded && (
          <Typography sx={{ p: 2, color: C.muted, fontSize: 13 }}>
            Няма клиенти в този филтър.
          </Typography>
        )}
        {clientRows.map((row, i) => {
          const { client: c, last, unread } = row
          const assigned = c.assigned_coach_id ? coaches.find(k => k.id === c.assigned_coach_id) : null
          return (
            <Box key={c.id}>
              <Box
                onClick={() => setSelectedClientId(c.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1.5, cursor: 'pointer',
                  '&:hover': { background: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Box sx={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: unread > 0 ? C.purple : C.purpleSoft,
                  border: `1px solid ${unread > 0 ? C.purple : 'rgba(200,197,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Typography sx={{ color: unread > 0 ? '#fff' : C.purple, fontWeight: 800, fontSize: 14 }}>
                    {c.name?.[0] || '?'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </Typography>
                    {assigned && (
                      <Chip label={assigned.name} size="small" sx={{ height: 18, fontSize: 10, background: C.surface, color: C.muted }} />
                    )}
                    {!assigned && (
                      <Chip label="без треньор" size="small" sx={{ height: 18, fontSize: 10, background: '#3b1f1f', color: '#ff9999' }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                    {last ? (
                      <>
                        <span style={{ fontWeight: 700, color: last.sender_role === 'client' ? C.text : C.muted }}>
                          {last.sender_role === 'client' ? c.name?.split(' ')[0] : 'Ти'}:
                        </span>{' '}
                        {last.text}
                      </>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Няма съобщения</span>
                    )}
                  </Typography>
                </Box>
                {unread > 0 && (
                  <Box sx={{
                    minWidth: 22, height: 22, px: 0.75,
                    borderRadius: '11px', background: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{unread}</Typography>
                  </Box>
                )}
              </Box>
              {i < clientRows.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
            </Box>
          )
        })}
      </Paper>
    </Box>
  )
}

// Coach inbox tab — bold pill with a PINK unread bubble (same accent as the
// sidebar notification badge), so unread counts scream from across the room.
function CoachTab({ active, onClick, label, unread }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.75, py: 0.75, borderRadius: '12px', cursor: 'pointer',
        fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
        background: active ? C.purple : 'rgba(200,197,255,0.06)',
        color:      active ? '#fff' : C.text,
        border:     `1.5px solid ${active ? C.purple : C.border}`,
        transition: 'all 0.18s',
        '&:hover':  active ? {} : { borderColor: C.purple },
      }}
    >
      {label}
      {unread > 0 && (
        <Box sx={{
          minWidth: 20, height: 20, px: 0.5, borderRadius: '10px',
          background: C.danger,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function FilterChip({ active, onClick, children, unread = 0 }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        display: 'flex', alignItems: 'center', gap: 0.75,
        px: 1.25, py: 0.5, borderRadius: '100px', cursor: 'pointer',
        fontSize: 12, fontWeight: 700,
        background: active ? C.purple : 'transparent',
        color:      active ? '#fff' : C.muted,
        border:     `1px solid ${active ? C.purple : C.border}`,
        transition: 'all 0.18s',
        '&:hover':  active ? {} : { color: C.text, borderColor: C.muted },
      }}
    >
      {children}
      {unread > 0 && (
        <Box sx={{
          minWidth: 18, height: 18, px: 0.5, borderRadius: '9px',
          background: C.danger,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>
            {unread > 9 ? '9+' : unread}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
