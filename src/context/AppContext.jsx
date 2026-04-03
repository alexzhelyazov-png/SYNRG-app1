import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { DB } from '../lib/db'
import { foodDB, quickFoods } from '../lib/constants'
import { T } from '../lib/translations'
import {
  todayDate, dateToInput, inputToDate, parseDate,
  fmt1, avgArr, sameDateStr,
} from '../lib/utils'
import { computeXPRanking } from '../lib/gamification'
import { applyColors } from '../theme'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // ── Core data ─────────────────────────────────────────────────
  const [clients,      setClients]      = useState([])
  const [coaches,      setCoaches]      = useState([])
  const [auth,         setAuth]         = useState(() => {
    try { const s = localStorage.getItem('synrg_auth'); return s ? JSON.parse(s) : { isLoggedIn: false, role: null, name: '', id: null } }
    catch { return { isLoggedIn: false, role: null, name: '', id: null } }
  })
  const [loading,      setLoading]      = useState(true)
  const [loadError,    setLoadError]    = useState('')
  const [notifications, setNotifications] = useState([])
  const [synrgHabits,  setSynrgHabits]  = useState([])
  const [viewingCoach, setViewingCoach] = useState(null) // coach name being viewed, or null

  // ── Theme — always dark ──────────────────────────────────────
  useEffect(() => { applyColors() }, [])

  // ── Language ──────────────────────────────────────────────────
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'bg')
  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])
  const t = useCallback((key) => T[lang]?.[key] ?? key, [lang])

  // ── UI state ──────────────────────────────────────────────────
  const [view,           setView]           = useState('dashboard')
  const [selIdx,         setSelIdx]         = useState(() => Number(localStorage.getItem('synrg_selidx') || 0))
  const [sidebarOpen,    setSidebarOpen]    = useState(false)
  const [showClientMenu, setShowClientMenu] = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(null)
  const [coachClientMode, setCoachClientMode] = useState(false) // true after coach explicitly clicks a client
  const [pendingProgressTab, setPendingProgressTab] = useState(null) // deep-link to a Progress sub-tab

  // ── Snackbar ─────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }, [])
  const closeSnackbar = useCallback(() => {
    setSnackbar(s => ({ ...s, open: false }))
  }, [])

  // ── Feed state ──────────────────────────────────────────────
  const [feedPosts,     setFeedPosts]     = useState([])
  const [postReactions, setPostReactions] = useState([]) // { id, post_id, author_name, emoji }
  const [postComments,  setPostComments]  = useState([]) // { id, post_id, author_name, content, created_at }

  // ── Workout form state ────────────────────────────────────────
  const [exName,          setExName]          = useState('')
  const [exScheme,        setExScheme]        = useState('')
  const [exWeight,        setExWeight]        = useState('')
  const [workoutCategory, setWorkoutCategory] = useState('Предна верига')
  const [currentWorkout,  setCurrentWorkout]  = useState([])
  const [workoutDate,     setWorkoutDate]     = useState(dateToInput(todayDate()))
  const [selCoach,        setSelCoach]        = useState('')
  const workoutDraftsRef = useRef({})  // { [clientId]: { exercises, category, date, exName, exScheme, exWeight } }
  // Keep refs in sync with latest state so saveWorkoutDraft always reads fresh values
  const workoutStateRef = useRef({ currentWorkout: [], exName: '', exScheme: '', exWeight: '', workoutCategory: 'Предна верига', workoutDate: '' })
  workoutStateRef.current = { currentWorkout, exName, exScheme, exWeight, workoutCategory, workoutDate }

  // ── Food state ────────────────────────────────────────────────
  const [foodDate,      setFoodDate]      = useState(dateToInput(todayDate()))
  const [foodModalOpen, setFoodModalOpen] = useState(false)
  const [foodSearch,    setFoodSearch]    = useState('')
  const [gramsInput,    setGramsInput]    = useState('')

  // ── Weight state ──────────────────────────────────────────────
  const [weightInput, setWeightInput] = useState('')
  const [weightDate,  setWeightDate]  = useState(dateToInput(todayDate()))

  // ── Steps state ─────────────────────────────────────────────
  const [stepsInput, setStepsInput] = useState('')
  const [stepsDate,  setStepsDate]  = useState(dateToInput(todayDate()))

  // ── Load all data ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      await DB.seedIfEmpty()
      const [rawCoaches, rawClients, meals, workouts, weights, tasks, taskComments, reactions, stepsRaw, postsRaw, rawSynrgHabits, rawPostReactions, rawPostComments] = await Promise.all([
        DB.selectAll('coaches'),
        DB.selectAll('clients'),
        DB.selectAll('meals', '&order=id.desc&limit=5000'),
        DB.selectAll('workouts'),
        DB.selectAll('weight_logs'),
        DB.selectAll('tasks'),
        DB.selectAll('task_comments'),
        DB.selectAll('reactions'),
        DB.selectAll('steps_logs').catch(() => []),
        DB.selectAll('community_posts').catch(() => []),
        DB.selectAll('synrg_habits').catch(() => []),
        DB.selectAll('post_reactions').catch(() => []),
        DB.selectAll('post_comments', '&order=created_at.asc').catch(() => []),
      ])

      setCoaches(rawCoaches.map(c => ({ name: c.name, password: c.password, id: c.id })))
      if (rawCoaches.length) setSelCoach(sc => sc || rawCoaches[0].name)

      setClients(rawClients.map(c => ({
        id:             c.id,
        name:           c.name,
        password:       c.password,
        email:          c.email || null,
        is_coach:       c.is_coach || false,
        calorieTarget:  c.calorie_target  || c.calorieTarget  || 2000,
        proteinTarget:  c.protein_target  || c.proteinTarget  || 140,
        meals: meals.filter(m => m.client_id === c.id).map(m => ({
          id: m.id, label: m.label, grams: m.grams, kcal: m.kcal, protein: m.protein, date: m.date,
        })),
        workouts: workouts.filter(w => w.client_id === c.id)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          .map(w => ({ id: w.id, date: w.date, coach: w.coach, category: w.category, items: w.items || [] })),
        weightLogs: weights.filter(w => w.client_id === c.id)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(w => ({ id: w.id, date: w.date, weight: Number(w.weight) })),
        stepsLogs: stepsRaw.filter(s => s.client_id === c.id)
          .sort((a, b) => a.date.localeCompare(b.date))
          .map(s => ({ id: s.id, date: s.date, steps: Number(s.steps) })),
        tasks: tasks
          .filter(tk => tk.client_id === c.id)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          .map(tk => ({
            ...tk,
            comments: taskComments
              .filter(cm => cm.task_id === tk.id)
              .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || '')),
          })),
        reactions: reactions
          .filter(r => r.client_id === c.id)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')),
        modules: Array.isArray(c.modules) ? c.modules : (c.modules ? JSON.parse(c.modules) : []),
        dismissedBadges: Array.isArray(c.dismissed_badges) ? c.dismissed_badges
          : (c.dismissed_badges ? JSON.parse(c.dismissed_badges) : []),
        reminderSettings: c.reminder_settings
          ? (typeof c.reminder_settings === 'string'
              ? JSON.parse(c.reminder_settings)
              : c.reminder_settings)
          : { protein: true, weight: true, foodLog: true, coach: true },
        synrgStartedAt: c.synrg_started_at || null,
        synrgQuiz:      c.synrg_quiz       || null,
      })))
      setFeedPosts((postsRaw || []).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
      setPostReactions(rawPostReactions || [])
      setPostComments(rawPostComments || [])
      setSynrgHabits((rawSynrgHabits || []).sort((a, b) => a.sort_order - b.sort_order))
    } catch(e) {
      console.error('loadAll error:', JSON.stringify(e), e?.message)
      setLoadError(`${e?.name || 'Error'}: ${e?.message || JSON.stringify(e)}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Notification polling (coaches only, every 60s) ────────────
  const notifTimerRef = useRef(null)
  const pollNotifications = useCallback(async () => {
    const data = await DB.getNotifications(48)
    setNotifications(data)
  }, [])

  useEffect(() => {
    if (!auth.isLoggedIn || auth.role !== 'coach') return
    pollNotifications()
    notifTimerRef.current = setInterval(pollNotifications, 60000)
    return () => clearInterval(notifTimerRef.current)
  }, [auth.isLoggedIn, auth.role, pollNotifications])

  // ── Auth ──────────────────────────────────────────────────────
  async function handleLogin(name, pass) {
    // Try coaches first
    const coach = coaches.find(c => c.name.toLowerCase() === name.toLowerCase() && c.password === pass)
    if (coach) {
      const a = { isLoggedIn: true, role: 'coach', name: coach.name, id: coach.id }
      setAuth(a)
      localStorage.setItem('synrg_auth', JSON.stringify(a))
      setSelCoach(coach.name)
      setViewingCoach(null)
      return null
    }
    // Try clients (only non-coach profiles)
    const c = clients.find(c => !c.is_coach && c.name.toLowerCase() === name.toLowerCase() && c.password === pass)
    if (c) {
      const i = clients.findIndex(x => x.name === c.name)
      setSelIdx(i)
      localStorage.setItem('synrg_selidx', String(i))
      const a = { isLoggedIn: true, role: 'client', name: c.name, id: c.id, modules: c.modules || [] }
      setAuth(a)
      localStorage.setItem('synrg_auth', JSON.stringify(a))
      return null
    }
    return t('errLogin')
  }

  async function handleRegisterClient(name, pass, email = null) {
    const exists = clients.find(c => !c.is_coach && c.name.toLowerCase() === name.toLowerCase())
    if (exists) return t('errClientExists')
    const row = { name, password: pass, calorie_target: 2000, protein_target: 140, is_coach: false, modules: [] }
    if (email) row.email = email
    const data = await DB.insert('clients', row)
    const newClient = {
      id: data.id, name, password: pass, is_coach: false,
      calorieTarget: 2000, proteinTarget: 140, modules: [],
      meals: [], workouts: [], weightLogs: [], tasks: [], reactions: [],
      reminderSettings: { protein: true, weight: true, foodLog: true, coach: true },
    }
    setClients(prev => {
      const updated = [...prev, newClient]
      const newRealIdx = updated.filter(c => !c.is_coach).length - 1
      setSelIdx(newRealIdx)
      return updated
    })
    setAuth({ isLoggedIn: true, role: 'client', name, id: data.id, modules: [] })

    // Notify coaches/admins about the new registration
    DB.insertNotification('Система', name, 'registration', name)

    // Sync to MailerLite + send welcome email (if email provided)
    if (email) {
      DB.syncToMailerLite('register', email, name)
      DB.syncToMailerLite('send_email', email, name, {},
        'Добре дошъл в SYNRG Beyond Fitness!',
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#1a1a1a;color:#e0e0e0;border-radius:16px">
          <h2 style="color:#c4e9bf;margin:0 0 16px">${name},</h2>
          <p style="font-size:16px;line-height:1.6">Добре дошъл в SYNRG Beyond Fitness!</p>
          <p style="font-size:14px;color:#999;line-height:1.6">Профилът ти е създаден успешно. Очакваме те в студиото!</p>
          <hr style="border:none;border-top:1px solid #333;margin:24px 0">
          <p style="font-size:12px;color:#666">SYNRG Beyond Fitness</p>
        </div>`)
    }

    return null
  }

  function logout() {
    localStorage.removeItem('synrg_auth')
    localStorage.removeItem('synrg_selidx')
    setAuth({ isLoggedIn: false, role: null, name: '', id: null })
    setView('dashboard')
    setCurrentWorkout([])
    setViewingCoach(null)
    setNotifications([])
  }

  // ── Validate stored auth after data loads ─────────────────────
  useEffect(() => {
    if (loading) return
    if (!auth.isLoggedIn) return
    // If data failed to load (network error etc.) keep the user logged in — don't log out on a transient error
    if (loadError) return
    if (auth.role === 'coach') {
      const valid = coaches.find(c => c.id === auth.id)
      if (!valid) { logout(); return }
      setSelCoach(auth.name)
    } else if (auth.role === 'client') {
      const valid = clients.find(c => c.id === auth.id && !c.is_coach)
      if (!valid) { logout(); return }
      // Refresh modules from DB data (catches admin changes)
      const freshModules = valid.modules || []
      if (JSON.stringify(freshModules) !== JSON.stringify(auth.modules || [])) {
        const updatedAuth = { ...auth, modules: freshModules }
        setAuth(updatedAuth)
        localStorage.setItem('synrg_auth', JSON.stringify(updatedAuth))
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  // ── Computed: real clients (no coach profiles) ────────────────
  const realClients = useMemo(() => clients.filter(c => !c.is_coach), [clients])

  // ── Computed: coach profiles (shadow clients for coaches) ──────
  const coachProfiles = useMemo(() => clients.filter(c => c.is_coach), [clients])

  // ── actualIdx points into realClients for both roles ──────────
  const actualIdx = useMemo(() => {
    if (auth.role === 'coach' || auth.role === 'admin') return selIdx
    const i = realClients.findIndex(c => c.name === auth.name)
    return i >= 0 ? i : 0
  }, [auth, selIdx, realClients])

  // ── The active "subject" being viewed ─────────────────────────
  const client = useMemo(() => {
    const blank = {
      name: '', calorieTarget: 0, proteinTarget: 0,
      meals: [], workouts: [], weightLogs: [],
      tasks: [], reactions: [], reminderSettings: {},
    }
    if ((auth.role === 'coach' || auth.role === 'admin') && viewingCoach) {
      return coachProfiles.find(c => c.name === viewingCoach) || blank
    }
    return realClients[actualIdx] || blank
  }, [auth, viewingCoach, coachProfiles, realClients, actualIdx])

  // ── Read-only: viewing another coach's data (blocks everything) ──────
  const isReadOnly = (auth.role === 'coach' || auth.role === 'admin') && viewingCoach !== null && viewingCoach !== auth.name

  // ── Tracker read-only: coaches/admins can only edit their OWN tracker ─
  // Blocks food + weight writes when viewing a client OR another coach
  const isTrackerReadOnly = (auth.role === 'coach' || auth.role === 'admin') && viewingCoach !== auth.name

  // ── visibleClients for coach's client list ────────────────────
  const visibleClients = (auth.role === 'coach' || auth.role === 'admin')
    ? realClients
    : realClients.filter(c => c.name === auth.name)

  const selFoodDate = inputToDate(foodDate)

  const mealsForDate = useMemo(
    () => (client.meals || []).filter(m => sameDateStr(m.date, selFoodDate)),
    [client.meals, selFoodDate]
  )

  const foodTotals = useMemo(
    () => mealsForDate.reduce((a, m) => ({
      kcal:    a.kcal    + Number(m.kcal    || 0),
      protein: a.protein + Number(m.protein || 0),
      carbs:   a.carbs   + Number(m.carbs   || 0),
      fat:     a.fat     + Number(m.fat     || 0),
    }), { kcal: 0, protein: 0, carbs: 0, fat: 0 }),
    [mealsForDate]
  )

  const foodSuggestions = useMemo(() => {
    const s = foodSearch.trim().toLowerCase()
    if (!s) return []
    return Object.entries(foodDB).filter(([k, f]) => k.includes(s) || f.label.toLowerCase().includes(s) || (f.labelEn || '').toLowerCase().includes(s)).slice(0, 8)
  }, [foodSearch])

  const sortedWeightLogs = useMemo(
    () => [...(client.weightLogs || [])].sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    [client.weightLogs]
  )

  const weightChartData = useMemo(
    () => sortedWeightLogs.map((item, idx, arr) => {
      const slice = arr.slice(Math.max(0, idx - 6), idx + 1)
      return {
        date:   item.date,
        weight: Number(item.weight),
        avg:    Math.round(avgArr(slice.map(x => Number(x.weight))) * 10) / 10,
      }
    }),
    [sortedWeightLogs]
  )

  const latestWeight = weightChartData.length ? weightChartData[weightChartData.length - 1].weight : null
  const latestAvg    = weightChartData.length ? weightChartData[weightChartData.length - 1].avg    : null

  const weeklyRate = useMemo(() => {
    if (sortedWeightLogs.length >= 14) {
      return avgArr(sortedWeightLogs.slice(-7).map(x => Number(x.weight)))
           - avgArr(sortedWeightLogs.slice(-14, -7).map(x => Number(x.weight)))
    }
    if (sortedWeightLogs.length >= 2) {
      const f = sortedWeightLogs[0], l = sortedWeightLogs[sortedWeightLogs.length - 1]
      const days = Math.max(1, Math.round((parseDate(l.date) - parseDate(f.date)) / 86400000))
      return ((Number(l.weight) - Number(f.weight)) / days) * 7
    }
    return null
  }, [sortedWeightLogs])

  const sortedStepsLogs = useMemo(
    () => [...(client.stepsLogs || [])].sort((a, b) => parseDate(a.date) - parseDate(b.date)),
    [client.stepsLogs]
  )

  // ── Ranking excludes coach profiles ───────────────────────────
  const ranking  = useMemo(() => computeXPRanking(realClients), [realClients])
  const kcalPct  = Math.min((foodTotals.kcal    / (client.calorieTarget || 1)) * 100, 100)
  const protPct  = Math.min((foodTotals.protein / (client.proteinTarget || 1)) * 100, 100)

  // ── Notifications: unread count (resets when viewing notifications page) ──
  const [lastNotifSeen, setLastNotifSeen] = useState(() => {
    return localStorage.getItem('synrg_last_notif_seen') || ''
  })
  function markNotifsRead() {
    const now = new Date().toISOString()
    setLastNotifSeen(now)
    localStorage.setItem('synrg_last_notif_seen', now)
  }
  const unreadNotifCount = useMemo(() => {
    if (!auth.isLoggedIn || auth.role !== 'coach') return 0
    if (!lastNotifSeen) return notifications.filter(n => n.from_coach !== auth.name).length
    return notifications.filter(n => n.from_coach !== auth.name && n.created_at > lastNotifSeen).length
  }, [notifications, auth, lastNotifSeen])

  // ── Unread feed count ─────────────────────────────────────────
  const feedKey = auth.id ? `synrg_lastSeenFeed_${auth.id}` : 'synrg_lastSeenFeed'
  const [lastSeenFeed, setLastSeenFeed] = useState(() => localStorage.getItem(feedKey) || '')
  // Reload per-user key whenever auth changes (login / switch account)
  useEffect(() => {
    setLastSeenFeed(localStorage.getItem(feedKey) || '')
  }, [auth.id]) // eslint-disable-line react-hooks/exhaustive-deps
  function markFeedSeen() {
    const now = new Date().toISOString()
    setLastSeenFeed(now)
    localStorage.setItem(feedKey, now)
  }
  const unreadFeedCount = useMemo(() => {
    if (!auth.isLoggedIn) return 0
    const since = lastSeenFeed
    const newPosts    = feedPosts.filter(p => (!since || p.created_at > since) && p.author_name !== auth.name).length
    const newComments = postComments.filter(c => (!since || c.created_at > since) && c.author_name !== auth.name).length
    return newPosts + newComments
  }, [feedPosts, postComments, lastSeenFeed, auth])

  // ── Update helpers ────────────────────────────────────────────
  function updateClient(fn) {
    if (viewingCoach) {
      setClients(prev => prev.map(c => c.is_coach && c.name === viewingCoach ? fn(c) : c))
    } else {
      setClients(prev => prev.map((c, i) => {
        const ri = realClients.findIndex(rc => rc.id === c.id)
        return ri === actualIdx ? fn(c) : c
      }))
    }
  }

  async function updateClientTargets(id, calorieTarget, proteinTarget) {
    await DB.update('clients', id, { calorie_target: calorieTarget, protein_target: proteinTarget })
    setClients(prev => prev.map(c => c.id === id ? { ...c, calorieTarget, proteinTarget } : c))
  }

  async function addMealToClient(clientId, meal) {
    if (isTrackerReadOnly) return
    // Optimistic update — show immediately with temp ID
    const tmpId = 'tmp_' + Date.now()
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, meals: [...c.meals, { ...meal, id: tmpId }] }
      : c
    ))

    // Try up to 3 times before giving up (handles mobile network glitches)
    const payload = {
      client_id: clientId, date: meal.date, label: meal.label,
      grams: meal.grams, kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs || 0, fat: meal.fat || 0,
    }
    let saved = false
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 800 * attempt))
      try {
        const data = await DB.insert('meals', payload)
        // Replace temp ID with real DB ID
        setClients(prev => prev.map(c => c.id === clientId
          ? { ...c, meals: c.meals.map(m => m.id === tmpId ? { ...m, id: data.id } : m) }
          : c
        ))
        saved = true
        break
      } catch { /* retry */ }
    }

    if (!saved) {
      // All 3 attempts failed — rollback and show clear error
      setClients(prev => prev.map(c => c.id === clientId
        ? { ...c, meals: c.meals.filter(m => m.id !== tmpId) }
        : c
      ))
      showSnackbar('Неуспешно запазване — провери интернет и опитай пак', 'error')
    }
  }

  async function deleteMealFromClient(clientId, mealId) {
    if (isTrackerReadOnly) return
    await DB.deleteById('meals', mealId)
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, meals: c.meals.filter(m => m.id !== mealId) }
      : c
    ))
  }

  async function saveWorkoutToClient(clientId, workout) {
    if (isReadOnly) return
    // Optimistic update — show in history immediately
    const tmpId = 'tmp_' + Date.now()
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, workouts: [{ ...workout, id: tmpId }, ...c.workouts] }
      : c
    ))
    try {
      const data = await DB.insert('workouts', {
        client_id: clientId, date: workout.date, coach: workout.coach,
        category: workout.category, items: workout.items,
      })
      // Replace tmp id with real DB id
      if (data?.id) {
        setClients(prev => prev.map(c => c.id === clientId
          ? { ...c, workouts: c.workouts.map(w => w.id === tmpId ? { ...w, id: data.id } : w) }
          : c
        ))
      }
    } catch (e) {
      console.error('saveWorkoutToClient error:', e)
    }
  }

  async function saveWeightLog(clientId, date, weight) {
    if (isTrackerReadOnly) return
    const data = await DB.upsertByFields('weight_logs', { client_id: clientId, date, weight }, ['client_id', 'date'])
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const logs = c.weightLogs.filter(l => l.date !== date)
      return { ...c, weightLogs: [...logs, { id: data.id, date, weight: Number(weight) }].sort((a, b) => a.date.localeCompare(b.date)) }
    }))
  }

  async function deleteWeightLog(clientId, logId) {
    if (isTrackerReadOnly) return
    await DB.deleteById('weight_logs', logId)
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, weightLogs: c.weightLogs.filter(l => l.id !== logId) }
      : c
    ))
  }

  async function saveStepsLog(clientId, date, steps) {
    if (isTrackerReadOnly) return
    const data = await DB.upsertByFields('steps_logs', { client_id: clientId, date, steps }, ['client_id', 'date'])
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const logs = (c.stepsLogs || []).filter(l => l.date !== date)
      return { ...c, stepsLogs: [...logs, { id: data.id, date, steps: Number(steps) }].sort((a, b) => a.date.localeCompare(b.date)) }
    }))
  }

  async function deleteStepsLog(clientId, logId) {
    if (isTrackerReadOnly) return
    await DB.deleteById('steps_logs', logId)
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, stepsLogs: (c.stepsLogs || []).filter(l => l.id !== logId) }
      : c
    ))
  }

  // ── Feed actions ────────────────────────────────────────────
  async function addFeedPost(content) {
    const tmpId = 'tmp_' + Date.now()
    const tmpPost = { id: tmpId, client_id: auth.id, author_name: auth.name, content, created_at: new Date().toISOString() }
    setFeedPosts(prev => [tmpPost, ...prev])
    try {
      const data = await DB.insert('community_posts', { client_id: auth.id, author_name: auth.name, content })
      if (data) {
        setFeedPosts(prev => prev.map(p => p.id === tmpId ? data : p))
        DB.insertNotification(auth.name, 'Стена', 'feed_post', content.substring(0, 80))
      } else {
        setFeedPosts(prev => prev.filter(p => p.id !== tmpId))
        showSnackbar('Грешка при публикуване', 'error')
      }
    } catch {
      setFeedPosts(prev => prev.filter(p => p.id !== tmpId))
      showSnackbar('Грешка при публикуване', 'error')
    }
  }

  async function deleteFeedPost(postId) {
    await DB.deleteById('community_posts', postId)
    setFeedPosts(prev => prev.filter(p => p.id !== postId))
    setPostReactions(prev => prev.filter(r => r.post_id !== postId))
    setPostComments(prev => prev.filter(c => c.post_id !== postId))
  }

  // ── Post reactions ───────────────────────────────────────────
  async function togglePostReaction(postId, emoji) {
    const existing = postReactions.find(
      r => r.post_id === postId && r.author_name === auth.name && r.emoji === emoji
    )
    if (existing) {
      setPostReactions(prev => prev.filter(r => r.id !== existing.id))
      await DB.deleteById('post_reactions', existing.id)
    } else {
      const tmpId = 'tmp_r_' + Date.now()
      const tmp = { id: tmpId, post_id: postId, author_name: auth.name, emoji, created_at: new Date().toISOString() }
      setPostReactions(prev => [...prev, tmp])
      try {
        const data = await DB.insert('post_reactions', { post_id: postId, author_name: auth.name, emoji })
        if (data) setPostReactions(prev => prev.map(r => r.id === tmpId ? data : r))
        else setPostReactions(prev => prev.filter(r => r.id !== tmpId))
      } catch { setPostReactions(prev => prev.filter(r => r.id !== tmpId)) }
    }
  }

  // ── Post comments ────────────────────────────────────────────
  async function addPostComment(postId, content) {
    const tmpId = 'tmp_c_' + Date.now()
    const tmp = { id: tmpId, post_id: postId, author_name: auth.name, content, created_at: new Date().toISOString() }
    setPostComments(prev => [...prev, tmp])
    try {
      const data = await DB.insert('post_comments', { post_id: postId, author_name: auth.name, content })
      if (data) {
        setPostComments(prev => prev.map(c => c.id === tmpId ? data : c))
        DB.insertNotification(auth.name, 'Стена', 'feed_comment', content.substring(0, 80))
      } else setPostComments(prev => prev.filter(c => c.id !== tmpId))
    } catch { setPostComments(prev => prev.filter(c => c.id !== tmpId)) }
  }

  async function deletePostComment(commentId) {
    setPostComments(prev => prev.filter(c => c.id !== commentId))
    await DB.deleteById('post_comments', commentId)
  }

  async function deleteClient(clientId) {
    const [clientMeals, clientWorkouts, clientWeights, clientTasks, clientReactions, clientSteps, clientPlans, clientBookings] = await Promise.all([
      DB.findWhere('meals',          'client_id', clientId),
      DB.findWhere('workouts',       'client_id', clientId),
      DB.findWhere('weight_logs',    'client_id', clientId),
      DB.findWhere('tasks',          'client_id', clientId),
      DB.findWhere('reactions',      'client_id', clientId),
      DB.findWhere('steps_logs',     'client_id', clientId).catch(() => []),
      DB.findWhere('client_plans',   'client_id', clientId).catch(() => []),
      DB.findWhere('slot_bookings',  'client_id', clientId).catch(() => []),
    ])
    // Delete task comments for each task
    const taskCommentDeletes = []
    for (const tk of clientTasks) {
      const comments = await DB.findWhere('task_comments', 'task_id', tk.id).catch(() => [])
      comments.forEach(c => taskCommentDeletes.push(DB.deleteById('task_comments', c.id)))
    }
    await Promise.all([
      ...taskCommentDeletes,
      ...clientMeals.map(m     => DB.deleteById('meals',          m.id)),
      ...clientWorkouts.map(w  => DB.deleteById('workouts',       w.id)),
      ...clientWeights.map(w   => DB.deleteById('weight_logs',    w.id)),
      ...clientTasks.map(tk    => DB.deleteById('tasks',          tk.id)),
      ...clientReactions.map(r => DB.deleteById('reactions',      r.id)),
      ...clientSteps.map(s     => DB.deleteById('steps_logs',     s.id)),
      ...clientPlans.map(p     => DB.deleteById('client_plans',   p.id)),
      ...clientBookings.map(b  => DB.deleteById('slot_bookings',  b.id)),
      DB.deleteById('clients', clientId),
    ])
    setClients(prev => {
      const newList = prev.filter(c => c.id !== clientId)
      const newReal = newList.filter(c => !c.is_coach)
      setSelIdx(i => Math.min(i, Math.max(0, newReal.length - 1)))
      return newList
    })
    showSnackbar(t('clientDeletedMsg'), 'info')
  }

  // ── Send notification to other coaches ────────────────────────
  async function sendCoachNotification(actionType, clientName, content) {
    await DB.insertNotification(auth.name, clientName, actionType, content)
    // Refresh local notifications
    const fresh = await DB.getNotifications(48)
    setNotifications(fresh)
  }

  // ── Task actions ──────────────────────────────────────────────
  async function addTask(taskData) {
    const data = await DB.insert('tasks', {
      client_id:   client.id,
      title:       taskData.title,
      description: taskData.description || '',
      assigned_by: auth.name,
      status:      'pending',
    })
    setClients(prev => prev.map(c => c.id === client.id
      ? { ...c, tasks: [{ ...data, comments: [] }, ...(c.tasks || [])] }
      : c
    ))
    showSnackbar(t('taskSavedMsg'))
    await sendCoachNotification('task', client.name, taskData.title)
  }

  async function addTaskForClient(clientId, taskData) {
    const targetClient = clients.find(c => c.id === clientId)
    if (!targetClient) return
    const data = await DB.insert('tasks', {
      client_id:   clientId,
      title:       taskData.title,
      description: taskData.description || '',
      assigned_by: auth.name,
      status:      'pending',
    })
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, tasks: [{ ...data, comments: [] }, ...(c.tasks || [])] }
      : c
    ))
    showSnackbar(t('taskSavedMsg'))
    await sendCoachNotification('task', targetClient.name, taskData.title)
  }

  async function toggleTaskDone(taskId, done) {
    const newStatus = done ? 'done' : 'pending'
    await DB.update('tasks', taskId, { status: newStatus })
    // Update across all clients (supports AllClientsTasks view)
    setClients(prev => prev.map(c => ({
      ...c,
      tasks: (c.tasks || []).map(tk => tk.id === taskId ? { ...tk, status: newStatus } : tk),
    })))
  }

  async function deleteTask(taskId) {
    await DB.deleteById('tasks', taskId)
    // Remove across all clients (supports AllClientsTasks view)
    setClients(prev => prev.map(c => ({
      ...c,
      tasks: (c.tasks || []).filter(tk => tk.id !== taskId),
    })))
  }

  async function addTaskComment(taskId, text) {
    const data = await DB.insert('task_comments', {
      task_id:  taskId,
      author:   auth.name,
      text,
      is_coach: auth.role === 'coach',
    })
    // Update across all clients (supports AllClientsTasks view)
    setClients(prev => prev.map(c => ({
      ...c,
      tasks: (c.tasks || []).map(tk => tk.id === taskId
        ? { ...tk, comments: [...(tk.comments || []), data] }
        : tk
      ),
    })))
    showSnackbar(t('commentSavedMsg'))
    const task = (client.tasks || []).find(tk => tk.id === taskId)
    const taskTitle = task?.title || ''
    await sendCoachNotification('task_comment', client.name, `${taskTitle}: ${text}`)
  }

  // ── Reaction / coach message actions ──────────────────────────
  async function sendReaction(reactionType, message) {
    const data = await DB.insert('reactions', {
      client_id:    client.id,
      type:         reactionType,
      message:      message || '',
      trainer_name: auth.name,
      dismissed:    false,
    })
    setClients(prev => prev.map(c => c.id === client.id
      ? { ...c, reactions: [data, ...(c.reactions || [])] }
      : c
    ))
    showSnackbar(t('reactionSentMsg'))
    const notifContent = reactionType === 'like' ? 'Браво!' : message
    await sendCoachNotification('reaction', client.name, notifContent)
  }

  async function dismissReaction(reactionId) {
    await DB.update('reactions', reactionId, { dismissed: true })
    setClients(prev => prev.map(c => c.id === client.id
      ? { ...c, reactions: (c.reactions || []).map(r => r.id === reactionId ? { ...r, dismissed: true } : r) }
      : c
    ))
  }

  // ── Reminder settings ─────────────────────────────────────────
  async function updateReminderSettings(settings) {
    await DB.update('clients', client.id, { reminder_settings: settings })
    updateClient(c => ({ ...c, reminderSettings: settings }))
  }

  // ── Food actions ──────────────────────────────────────────────
  function addFoodFromModal(key, grams) {
    if (!key || !foodDB[key]) { showSnackbar(t('warningValidFood'), 'warning'); return }
    if (!grams || isNaN(grams)) { showSnackbar(t('warningGrams'), 'warning'); return }
    const food = foodDB[key]
    const meal = {
      label:   food.label,
      grams,
      kcal:    Math.round((food.kcal    / 100) * grams),
      protein: Math.round(((food.protein / 100) * grams) * 10) / 10,
      carbs:   Math.round(((food.carbs   || 0) / 100) * grams * 10) / 10,
      fat:     Math.round(((food.fat     || 0) / 100) * grams * 10) / 10,
      date:    todayDate(),
    }
    addMealToClient(client.id, meal)
    setFoodDate(dateToInput(todayDate())) // jump back to today
    setFoodSearch(''); setGramsInput(''); setFoodModalOpen(false)
    showSnackbar(`${food.label} ${t('foodAddedSuffix')}`)
  }

  function addQuickFood(key, grams) {
    const food = foodDB[key]; if (!food) return
    const meal = {
      label:   food.label,
      grams,
      kcal:    Math.round((food.kcal    / 100) * grams),
      protein: Math.round(((food.protein / 100) * grams) * 10) / 10,
      carbs:   Math.round(((food.carbs   || 0) / 100) * grams * 10) / 10,
      fat:     Math.round(((food.fat     || 0) / 100) * grams * 10) / 10,
      date:    todayDate(),
    }
    addMealToClient(client.id, meal)
    setFoodDate(dateToInput(todayDate())) // jump back to today
    showSnackbar(`${food.label} ${t('foodAddedSuffix')}`)
  }

  function addBarcodeFood(name, grams, kcalPer100, protPer100, carbsPer100 = 0, fatPer100 = 0) {
    if (!grams || isNaN(grams)) { showSnackbar(t('warningGrams'), 'warning'); return }
    const meal = {
      label:   name,
      grams,
      kcal:    Math.round((kcalPer100  / 100) * grams),
      protein: Math.round(((protPer100  / 100) * grams) * 10) / 10,
      carbs:   Math.round(((carbsPer100 / 100) * grams) * 10) / 10,
      fat:     Math.round(((fatPer100   / 100) * grams) * 10) / 10,
      date:    todayDate(),
    }
    addMealToClient(client.id, meal)
    setFoodDate(dateToInput(todayDate())) // jump back to today
    setFoodModalOpen(false)
    showSnackbar(`${name} ${t('foodAddedSuffix')}`)
  }

  // ── Weight actions ────────────────────────────────────────────
  function saveWeight() {
    const w = Number(String(weightInput).replace(',', '.'))
    if (!w || isNaN(w)) { showSnackbar(t('warningWeight'), 'warning'); return }
    const date = inputToDate(weightDate)
    saveWeightLog(client.id, date, w)
    setWeightInput('')
    showSnackbar(t('weightSavedMsg'))
  }

  function saveSteps() {
    const s = parseInt(String(stepsInput).replace(/\s/g, ''), 10)
    if (!s || isNaN(s) || s <= 0) { showSnackbar(t('warningSteps'), 'warning'); return }
    const date = inputToDate(stepsDate)
    saveStepsLog(client.id, date, s)
    setStepsInput('')
    showSnackbar(t('stepsSavedMsg'))
  }

  // ── Workout actions ───────────────────────────────────────────
  function addExercise() {
    if (!exName.trim() || !exScheme.trim() || !exWeight.trim()) {
      showSnackbar(t('warningExFields'), 'warning'); return
    }
    setCurrentWorkout(prev => [...prev, {
      exercise: exName.trim(), scheme: exScheme.trim(), weight: exWeight.trim(),
    }])
    setExName(''); setExScheme(''); setExWeight('')
  }

  function saveWorkoutDraft(clientId) {
    if (!clientId) return
    const s = workoutStateRef.current
    const hasData = s.currentWorkout.length || s.exName || s.exScheme || s.exWeight
    if (hasData) {
      workoutDraftsRef.current[clientId] = {
        exercises: [...s.currentWorkout], category: s.workoutCategory,
        date: s.workoutDate, exName: s.exName, exScheme: s.exScheme, exWeight: s.exWeight,
      }
    }
  }

  function restoreWorkoutDraft(clientId) {
    const draft = workoutDraftsRef.current[clientId]
    if (draft) {
      setCurrentWorkout(draft.exercises)
      setWorkoutCategory(draft.category)
      setWorkoutDate(draft.date)
      setExName(draft.exName || '')
      setExScheme(draft.exScheme || '')
      setExWeight(draft.exWeight || '')
      delete workoutDraftsRef.current[clientId]
    } else {
      setCurrentWorkout([])
      setExName(''); setExScheme(''); setExWeight('')
      setWorkoutCategory('Предна верига')
      setWorkoutDate(dateToInput(todayDate()))
    }
  }

  function saveWorkout() {
    if (!currentWorkout.length) return
    delete workoutDraftsRef.current[client.id]
    saveWorkoutToClient(client.id, {
      date:     inputToDate(workoutDate),
      coach:    auth.name,
      category: workoutCategory,
      items:    currentWorkout,
    })
    setCurrentWorkout([])
    showSnackbar(t('workoutSavedMsg'))
  }

  async function deleteWorkout(workoutId) {
    if (!workoutId || workoutId.startsWith?.('tmp_')) return
    setClients(prev => prev.map(c => ({ ...c, workouts: c.workouts.filter(w => w.id !== workoutId) })))
    try { await DB.deleteById('workouts', workoutId) } catch (e) { console.error('deleteWorkout:', e) }
  }

  async function updateWorkout(workoutId, updatedItems, extra = {}) {
    if (!workoutId) return
    const patch = { items: updatedItems, ...extra }
    setClients(prev => prev.map(c => ({
      ...c, workouts: c.workouts.map(w => w.id === workoutId ? { ...w, ...patch } : w)
    })))
    try { await DB.update('workouts', workoutId, patch) } catch (e) { console.error('updateWorkout:', e) }
  }

  // ── Module management (admin) ─────────────────────────────────
  async function updateClientModules(clientId, newModules) {
    await DB.update('clients', clientId, { modules: newModules })
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, modules: newModules } : c))
    // If the currently logged-in client's modules changed, update auth too
    if (auth.id === clientId) {
      const updatedAuth = { ...auth, modules: newModules }
      setAuth(updatedAuth)
      localStorage.setItem('synrg_auth', JSON.stringify(updatedAuth))
    }
  }

  async function dismissBadge(badgeId, monthKey = null) {
    const cl = client
    if (!cl?.id) return
    const key = monthKey ? `${badgeId}:${monthKey}` : badgeId
    const updated = [...(cl.dismissedBadges || []), key]
    await DB.update('clients', cl.id, { dismissed_badges: updated })
    setClients(prev => prev.map(c => c.id === cl.id ? { ...c, dismissedBadges: updated } : c))
  }

  const value = {
    // Language
    lang, setLang, t,
    // Data
    clients, coaches, realClients, coachProfiles,
    auth, loading, loadError,
    // UI
    view, setView,
    selIdx, setSelIdx,
    sidebarOpen, setSidebarOpen,
    showClientMenu, setShowClientMenu,
    confirmDelete, setConfirmDelete,
    // Coach tracker viewing
    viewingCoach, setViewingCoach,
    coachClientMode, setCoachClientMode,
    pendingProgressTab, setPendingProgressTab,
    isReadOnly,
    isTrackerReadOnly,
    // Snackbar
    snackbar, showSnackbar, closeSnackbar,
    // Notifications
    notifications, unreadNotifCount, markNotifsRead, pollNotifications,
    // Workout
    exName, setExName,
    exScheme, setExScheme,
    exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    workoutDate, setWorkoutDate,
    selCoach, setSelCoach,
    saveWorkoutDraft, restoreWorkoutDraft,
    // Food
    foodDate, setFoodDate,
    foodModalOpen, setFoodModalOpen,
    foodSearch, setFoodSearch,
    gramsInput, setGramsInput,
    // Weight
    weightInput, setWeightInput,
    weightDate, setWeightDate,
    // Steps
    stepsInput, setStepsInput,
    stepsDate, setStepsDate,
    // Computed
    client, actualIdx, selFoodDate,
    mealsForDate, foodTotals, foodSuggestions,
    sortedWeightLogs, weightChartData,
    latestWeight, latestAvg, weeklyRate,
    sortedStepsLogs,
    ranking, kcalPct, protPct, visibleClients,
    // Actions
    loadAll,
    handleLogin,
    handleRegisterClient,
    logout,
    updateClient, updateClientTargets,
    addMealToClient, deleteMealFromClient,
    saveWorkoutToClient,
    saveWeightLog, deleteWeightLog,
    saveStepsLog, deleteStepsLog,
    feedPosts, addFeedPost, deleteFeedPost,
    postReactions, postComments, togglePostReaction, addPostComment, deletePostComment,
    unreadFeedCount, markFeedSeen,
    deleteClient,
    addFoodFromModal, addQuickFood, addBarcodeFood,
    saveWeight, saveSteps, addExercise, saveWorkout, deleteWorkout, updateWorkout,
    addTask, addTaskForClient, toggleTaskDone, deleteTask, addTaskComment,
    sendReaction, dismissReaction,
    updateReminderSettings,
    updateClientModules,
    dismissBadge,
    synrgHabits, setSynrgHabits,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
