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

  // ── Snackbar ─────────────────────────────────────────────────
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const showSnackbar = useCallback((message, severity = 'success') => {
    setSnackbar({ open: true, message, severity })
  }, [])
  const closeSnackbar = useCallback(() => {
    setSnackbar(s => ({ ...s, open: false }))
  }, [])

  // ── Workout form state ────────────────────────────────────────
  const [exName,          setExName]          = useState('')
  const [exScheme,        setExScheme]        = useState('')
  const [exWeight,        setExWeight]        = useState('')
  const [workoutCategory, setWorkoutCategory] = useState('Предна верига')
  const [currentWorkout,  setCurrentWorkout]  = useState([])
  const [selCoach,        setSelCoach]        = useState('')

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
      const [rawCoaches, rawClients, meals, workouts, weights, tasks, taskComments, reactions, stepsRaw] = await Promise.all([
        DB.selectAll('coaches'),
        DB.selectAll('clients'),
        DB.selectAll('meals'),
        DB.selectAll('workouts'),
        DB.selectAll('weight_logs'),
        DB.selectAll('tasks'),
        DB.selectAll('task_comments'),
        DB.selectAll('reactions'),
        DB.selectAll('steps_logs').catch(() => []),
      ])

      setCoaches(rawCoaches.map(c => ({ name: c.name, password: c.password, id: c.id })))
      if (rawCoaches.length) setSelCoach(sc => sc || rawCoaches[0].name)

      setClients(rawClients.map(c => ({
        id:             c.id,
        name:           c.name,
        password:       c.password,
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
      })))
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

    // Sync to MailerLite (if email provided)
    if (email) DB.syncToMailerLite('register', email, name)

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
    () => mealsForDate.reduce((a, m) => ({ kcal: a.kcal + Number(m.kcal || 0), protein: a.protein + Number(m.protein || 0) }), { kcal: 0, protein: 0 }),
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

  // ── Notifications: unread count ───────────────────────────────
  const unreadNotifCount = useMemo(() => {
    if (!auth.isLoggedIn || auth.role !== 'coach') return 0
    return notifications.filter(n => n.from_coach !== auth.name).length
  }, [notifications, auth])

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
    const data = await DB.insert('meals', {
      client_id: clientId, date: meal.date, label: meal.label,
      grams: meal.grams, kcal: meal.kcal, protein: meal.protein,
    })
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, meals: [...c.meals, { ...meal, id: data.id }] }
      : c
    ))
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

  async function deleteClient(clientId) {
    const [clientMeals, clientWorkouts, clientWeights] = await Promise.all([
      DB.findWhere('meals',       'client_id', clientId),
      DB.findWhere('workouts',    'client_id', clientId),
      DB.findWhere('weight_logs', 'client_id', clientId),
    ])
    await Promise.all([
      ...clientMeals.map(m    => DB.deleteById('meals',       m.id)),
      ...clientWorkouts.map(w => DB.deleteById('workouts',    w.id)),
      ...clientWeights.map(w  => DB.deleteById('weight_logs', w.id)),
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
    if (auth.role !== 'coach') return
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
      date:    selFoodDate,
    }
    addMealToClient(client.id, meal)
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
      date:    selFoodDate,
    }
    addMealToClient(client.id, meal)
    showSnackbar(`${food.label} ${t('foodAddedSuffix')}`)
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

  function saveWorkout() {
    if (!currentWorkout.length) return
    saveWorkoutToClient(client.id, {
      date:     todayDate(),
      coach:    auth.name,
      category: workoutCategory,
      items:    currentWorkout,
    })
    setCurrentWorkout([])
    showSnackbar(t('workoutSavedMsg'))
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

  async function dismissBadge(badgeId) {
    const cl = clients[actualIdx]
    if (!cl) return
    const updated = [...(cl.dismissedBadges || []), badgeId]
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
    isReadOnly,
    isTrackerReadOnly,
    // Snackbar
    snackbar, showSnackbar, closeSnackbar,
    // Notifications
    notifications, unreadNotifCount, pollNotifications,
    // Workout
    exName, setExName,
    exScheme, setExScheme,
    exWeight, setExWeight,
    workoutCategory, setWorkoutCategory,
    currentWorkout, setCurrentWorkout,
    selCoach, setSelCoach,
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
    deleteClient,
    addFoodFromModal, addQuickFood,
    saveWeight, saveSteps, addExercise, saveWorkout,
    addTask, addTaskForClient, toggleTaskDone, deleteTask, addTaskComment,
    sendReaction, dismissReaction,
    updateReminderSettings,
    updateClientModules,
    dismissBadge,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
