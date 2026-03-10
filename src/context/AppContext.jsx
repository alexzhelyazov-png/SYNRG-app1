import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { DB } from '../lib/db'
import { foodDB, quickFoods } from '../lib/constants'
import { T } from '../lib/translations'
import {
  todayDate, dateToInput, inputToDate, parseDate,
  fmt1, avgArr, sameDateStr, computeRanking,
} from '../lib/utils'
import { applyColors } from '../theme'

const AppContext = createContext(null)
export const useApp = () => useContext(AppContext)

export function AppProvider({ children }) {
  // ── Core data ─────────────────────────────────────────────────
  const [clients,   setClients]   = useState([])
  const [coaches,   setCoaches]   = useState([])
  const [auth,      setAuth]      = useState({ isLoggedIn: false, role: null, name: '', id: null })
  const [loading,   setLoading]   = useState(true)
  const [loadError, setLoadError] = useState('')

  // ── Theme mode ────────────────────────────────────────────────
  const [isDark, setIsDarkState] = useState(() => localStorage.getItem('themeMode') !== 'light')
  const setIsDark = useCallback((val) => {
    setIsDarkState(val)
    localStorage.setItem('themeMode', val ? 'dark' : 'light')
  }, [])
  useEffect(() => { applyColors(isDark) }, [isDark])

  // ── Language ──────────────────────────────────────────────────
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'bg')
  const setLang = useCallback((l) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }, [])
  const t = useCallback((key) => T[lang]?.[key] ?? key, [lang])

  // ── UI state ──────────────────────────────────────────────────
  const [view,            setView]            = useState('dashboard')
  const [selIdx,          setSelIdx]          = useState(0)
  const [sidebarOpen,     setSidebarOpen]     = useState(false)
  const [showClientMenu,  setShowClientMenu]  = useState(false)
  const [confirmDelete,   setConfirmDelete]   = useState(null) // { id, name }

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
  const [foodDate,       setFoodDate]       = useState(dateToInput(todayDate()))
  const [foodModalOpen,  setFoodModalOpen]  = useState(false)
  const [foodSearch,     setFoodSearch]     = useState('')
  const [gramsInput,     setGramsInput]     = useState('')

  // ── Weight state ──────────────────────────────────────────────
  const [weightInput, setWeightInput] = useState('')
  const [weightDate,  setWeightDate]  = useState(dateToInput(todayDate()))

  // ── Load all data ─────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      await DB.seedIfEmpty()
      const [rawCoaches, rawClients, meals, workouts, weights, tasks, taskComments, reactions] = await Promise.all([
        DB.selectAll('coaches'),
        DB.selectAll('clients'),
        DB.selectAll('meals'),
        DB.selectAll('workouts'),
        DB.selectAll('weight_logs'),
        DB.selectAll('tasks'),
        DB.selectAll('task_comments'),
        DB.selectAll('reactions'),
      ])

      setCoaches(rawCoaches.map(c => ({ name: c.name, password: c.password, id: c.id })))
      if (rawCoaches.length) setSelCoach(sc => sc || rawCoaches[0].name)

      setClients(rawClients.map(c => ({
        id:             c.id,
        name:           c.name,
        password:       c.password,
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
        reminderSettings: c.reminder_settings
          ? (typeof c.reminder_settings === 'string'
              ? JSON.parse(c.reminder_settings)
              : c.reminder_settings)
          : { protein: true, weight: true, foodLog: true, coach: true },
      })))
    } catch(e) {
      console.error('loadAll error:', e)
      setLoadError(`${e.name}: ${e.message}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Auth ──────────────────────────────────────────────────────
  async function handleLoginCoach(name, pass) {
    const coach = coaches.find(c => c.name.toLowerCase() === name.trim().toLowerCase() && c.password === pass)
    if (!coach) return t('errLogin')
    setAuth({ isLoggedIn: true, role: 'coach', name: coach.name, id: coach.id })
    setSelCoach(coach.name)
    return null
  }

  async function handleLoginClient(name, pass) {
    const c = clients.find(c => c.name.toLowerCase() === name.trim().toLowerCase() && c.password === pass)
    if (!c) return t('errLogin')
    setSelIdx(clients.findIndex(x => x.name === c.name))
    setAuth({ isLoggedIn: true, role: 'client', name: c.name, id: c.id })
    return null
  }

  async function handleRegisterCoach(name, pass) {
    try {
      await DB.insert('coaches', { name, password: pass })
      await loadAll()
      return null
    } catch(e) { return e.message }
  }

  async function handleRegisterClient(name, pass) {
    try {
      await DB.insert('clients', { name, password: pass, calorie_target: 2000, protein_target: 140 })
      await loadAll()
      return null
    } catch(e) { return e.message }
  }

  function logout() {
    setAuth({ isLoggedIn: false, role: null, name: '', id: null })
    setView('dashboard')
    setCurrentWorkout([])
  }

  // ── Computed ──────────────────────────────────────────────────
  const actualIdx = useMemo(() => {
    if (auth.role === 'coach') return selIdx
    const i = clients.findIndex(c => c.name === auth.name)
    return i >= 0 ? i : 0
  }, [auth, selIdx, clients])

  const client = clients[actualIdx] || {
    name: '', calorieTarget: 0, proteinTarget: 0,
    meals: [], workouts: [], weightLogs: [],
    tasks: [], reactions: [], reminderSettings: {},
  }

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
    return Object.entries(foodDB).filter(([k, f]) => k.includes(s) || f.label.toLowerCase().includes(s)).slice(0, 8)
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

  const ranking  = useMemo(() => computeRanking(clients), [clients])
  const kcalPct  = Math.min((foodTotals.kcal    / (client.calorieTarget || 1)) * 100, 100)
  const protPct  = Math.min((foodTotals.protein / (client.proteinTarget || 1)) * 100, 100)

  const visibleClients = auth.role === 'coach'
    ? clients
    : clients.filter(c => c.name === auth.name)

  // ── Update helpers ────────────────────────────────────────────
  function updateClient(fn) {
    setClients(prev => prev.map((c, i) => i === actualIdx ? fn(c) : c))
  }

  async function updateClientTargets(id, calorieTarget, proteinTarget) {
    await DB.update('clients', id, { calorie_target: calorieTarget, protein_target: proteinTarget })
    setClients(prev => prev.map(c => c.id === id ? { ...c, calorieTarget, proteinTarget } : c))
  }

  async function addMealToClient(clientId, meal) {
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
    await DB.deleteById('meals', mealId)
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, meals: c.meals.filter(m => m.id !== mealId) }
      : c
    ))
  }

  async function saveWorkoutToClient(clientId, workout) {
    const data = await DB.insert('workouts', {
      client_id: clientId, date: workout.date, coach: workout.coach,
      category: workout.category, items: workout.items,
    })
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, workouts: [{ ...workout, id: data.id }, ...c.workouts] }
      : c
    ))
  }

  async function saveWeightLog(clientId, date, weight) {
    const data = await DB.upsertByFields('weight_logs', { client_id: clientId, date, weight }, ['client_id', 'date'])
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      const logs = c.weightLogs.filter(l => l.date !== date)
      return { ...c, weightLogs: [...logs, { id: data.id, date, weight: Number(weight) }].sort((a, b) => a.date.localeCompare(b.date)) }
    }))
  }

  async function deleteWeightLog(clientId, logId) {
    await DB.deleteById('weight_logs', logId)
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, weightLogs: c.weightLogs.filter(l => l.id !== logId) }
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
      setSelIdx(i => Math.min(i, Math.max(0, newList.length - 1)))
      return newList
    })
    showSnackbar(t('clientDeletedMsg'), 'info')
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
    setClients(prev => prev.map((c, i) => i === actualIdx
      ? { ...c, tasks: [{ ...data, comments: [] }, ...(c.tasks || [])] }
      : c
    ))
    showSnackbar(t('taskSavedMsg'))
  }

  async function toggleTaskDone(taskId, done) {
    const newStatus = done ? 'done' : 'pending'
    await DB.update('tasks', taskId, { status: newStatus })
    setClients(prev => prev.map((c, i) => i === actualIdx
      ? { ...c, tasks: (c.tasks || []).map(tk => tk.id === taskId ? { ...tk, status: newStatus } : tk) }
      : c
    ))
  }

  async function deleteTask(taskId) {
    await DB.deleteById('tasks', taskId)
    setClients(prev => prev.map((c, i) => i === actualIdx
      ? { ...c, tasks: (c.tasks || []).filter(tk => tk.id !== taskId) }
      : c
    ))
  }

  async function addTaskComment(taskId, text) {
    const data = await DB.insert('task_comments', {
      task_id:  taskId,
      author:   auth.name,
      text,
      is_coach: auth.role === 'coach',
    })
    setClients(prev => prev.map((c, i) => i === actualIdx
      ? {
          ...c,
          tasks: (c.tasks || []).map(tk => tk.id === taskId
            ? { ...tk, comments: [...(tk.comments || []), data] }
            : tk
          ),
        }
      : c
    ))
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
    setClients(prev => prev.map((c, i) => i === actualIdx
      ? { ...c, reactions: [data, ...(c.reactions || [])] }
      : c
    ))
    showSnackbar(t('reactionSentMsg'))
  }

  async function dismissReaction(reactionId) {
    await DB.update('reactions', reactionId, { dismissed: true })
    setClients(prev => prev.map((c, i) => i === actualIdx
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

  const value = {
    // Theme
    isDark, setIsDark,
    // Language
    lang, setLang, t,
    // Data
    clients, coaches, auth, loading, loadError,
    // UI
    view, setView,
    selIdx, setSelIdx,
    sidebarOpen, setSidebarOpen,
    showClientMenu, setShowClientMenu,
    confirmDelete, setConfirmDelete,
    // Snackbar
    snackbar, showSnackbar, closeSnackbar,
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
    // Computed
    client, actualIdx, selFoodDate,
    mealsForDate, foodTotals, foodSuggestions,
    sortedWeightLogs, weightChartData,
    latestWeight, latestAvg, weeklyRate,
    ranking, kcalPct, protPct, visibleClients,
    // Actions
    loadAll,
    handleLoginCoach, handleLoginClient,
    handleRegisterCoach, handleRegisterClient,
    logout,
    updateClient, updateClientTargets,
    addMealToClient, deleteMealFromClient,
    saveWorkoutToClient,
    saveWeightLog, deleteWeightLog,
    deleteClient,
    addFoodFromModal, addQuickFood,
    saveWeight, addExercise, saveWorkout,
    addTask, toggleTaskDone, deleteTask, addTaskComment,
    sendReaction, dismissReaction,
    updateReminderSettings,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
