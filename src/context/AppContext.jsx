import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { DB } from '../lib/db'

// ── Pending meal localStorage rescue (survives PWA kill on iOS) ──
const PENDING_MEALS_KEY = 'synrg_pending_v2'

// Normalize meal dates: legacy DB rows may be YYYY-MM-DD, app uses DD.MM.YYYY
function normalizeMealDate(date) {
  if (!date) return date
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const [y, m, d] = date.split('-')
    return `${d}.${m}.${y}`
  }
  return date
}
function lsReadPending() {
  try { return JSON.parse(localStorage.getItem(PENDING_MEALS_KEY) || '{}') } catch { return {} }
}
function lsWritePending(obj) {
  try {
    if (!Object.keys(obj).length) localStorage.removeItem(PENDING_MEALS_KEY)
    else localStorage.setItem(PENDING_MEALS_KEY, JSON.stringify(obj))
  } catch {}
}
import { foodDB, quickFoods } from '../lib/constants'
import { T } from '../lib/translations'
import {
  todayDate, dateToInput, inputToDate, parseDate,
  fmt1, avgArr, sameDateStr,
} from '../lib/utils'
import { computeXPRanking, computeTotalXP, computeMonthlyXP, computeLevel, evaluateBadges } from '../lib/gamification'
import { isAdmin as isAdminUser, isFullAdmin } from './../lib/bookingUtils'
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
  // ── Coach chat state ────────────────────────────────────────
  const [coachMessages, setCoachMessages] = useState([])       // All messages (coach/admin view) OR client's own thread
  const [coachMsgsLoaded, setCoachMsgsLoaded] = useState(false)
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
  const [pendingProgramOpen, setPendingProgramOpen] = useState(null) // deep-link: program slug to auto-open in Programs view

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

      // ── Determine role from localStorage (auth state may not be set yet at cold boot) ──
      let sessionAuth = { role: null, id: null }
      try { sessionAuth = JSON.parse(localStorage.getItem('synrg_auth') || '{}') } catch {}
      const isClientRole = sessionAuth.role === 'client' && sessionAuth.id

      // ── Query bounds: per-client for client role, date-bounded for coaches ──
      // Prevents unbounded table scans at scale (1000 clients × daily entries = millions of rows).
      const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10)
      const mealQuery = isClientRole
        ? `&client_id=eq.${sessionAuth.id}&order=id.desc&limit=50000`
        : `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=100000`
      const workoutQuery = isClientRole
        ? `&client_id=eq.${sessionAuth.id}&order=id.desc&limit=10000`
        : `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=50000`
      const weightQuery = isClientRole
        ? `&client_id=eq.${sessionAuth.id}&order=id.desc&limit=5000`
        : `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=20000`
      const stepsQuery = isClientRole
        ? `&client_id=eq.${sessionAuth.id}&order=id.desc&limit=5000`
        : `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=20000`

      const [rawCoaches, rawClients, meals, workouts, weights, tasks, taskComments, reactions, stepsRaw, postsRaw, rawSynrgHabits, rawPostReactions, rawPostComments, pastBookingsAll] = await Promise.all([
        DB.selectAll('coaches'),
        DB.selectAll('clients'),
        DB.selectAll('meals', mealQuery),
        DB.selectAll('workouts', workoutQuery).catch(() => []),
        DB.selectAll('weight_logs', weightQuery).catch(() => []),
        DB.selectAll('tasks').catch(() => []),
        DB.selectAll('task_comments').catch(() => []),
        DB.selectAll('reactions').catch(() => []),
        DB.selectAll('steps_logs', stepsQuery).catch(() => []),
        // CRITICAL: community_posts & post_comments need explicit limits — PostgREST
        // defaults cap at 1000 rows, which silently truncates Христиан's April entries
        // and causes m_community_* badges to appear missing in admin's XP computation.
        DB.selectAll('community_posts', '&order=created_at.desc&limit=50000').catch(() => []),
        DB.selectAll('synrg_habits').catch(() => []),
        DB.selectAll('post_reactions', '&limit=50000').catch(() => []),
        DB.selectAll('post_comments', '&order=created_at.desc&limit=100000').catch(() => []),
        // Completed slot_bookings — needed so gamification counts booked sessions
        // alongside manually-logged workout-tracker entries.
        DB.getAllPastBookings().catch(() => []),
      ])

      // Note: password fields no longer loaded into client state — auth handled via auth-login Edge Function
      setCoaches(rawCoaches.map(c => ({ name: c.name, id: c.id })))
      if (rawCoaches.length) setSelCoach(sc => sc || rawCoaches[0].name)

      // Check localStorage for any meals that were pending when the app was killed
      const pendingLS    = lsReadPending()
      const pendingLSArr = Object.entries(pendingLS)

      setClients(rawClients.map(c => {
        // Normalize dates: DB may store YYYY-MM-DD, app uses DD.MM.YYYY
        const dbMeals = meals.filter(m => m.client_id === c.id)
          .map(m => ({ ...m, date: normalizeMealDate(m.date) }))
        // Rescued meals: in localStorage but NOT yet in DB (count-aware dedup)
        const usedDbIds = new Set()
        const clientPending = pendingLSArr.filter(([, e]) => e.clientId === c.id)
        const rescued = []
        for (const [tmpId, { payload: p }] of clientPending) {
          const match = dbMeals.find(m =>
            !usedDbIds.has(m.id) &&
            m.date === p.date && m.label === p.label &&
            Number(m.grams) === Number(p.grams) && Math.round(Number(m.kcal)) === Math.round(Number(p.kcal))
          )
          if (match) {
            usedDbIds.add(match.id)
            // Already in DB — clean up localStorage
            const ls = lsReadPending(); delete ls[tmpId]; lsWritePending(ls)
          } else {
            rescued.push({
              id: tmpId, label: p.label, grams: p.grams, kcal: p.kcal,
              protein: p.protein, carbs: p.carbs || 0, fat: p.fat || 0, date: p.date,
            })
          }
        }
        return {
        id:             c.id,
        name:           c.name,
        email:          c.email || null,
        created_at:     c.created_at || null,
        is_coach:       c.is_coach || false,
        assigned_coach_id: c.assigned_coach_id || null,
        calorieTarget:  c.calorie_target  || c.calorieTarget  || 2000,
        proteinTarget:  c.protein_target  || c.proteinTarget  || 140,
        xp_monthly:     c.xp_monthly  || 0,
        xp_total:       c.xp_total    || 0,
        xp_level:       c.xp_level    || 1,
        meals: [
          ...dbMeals.map(m => ({
            id: m.id, label: m.label, grams: m.grams, kcal: m.kcal,
            protein: m.protein, carbs: m.carbs || 0, fat: m.fat || 0, date: m.date,
          })),
          ...rescued,
        ],
        workouts: workouts.filter(w => w.client_id === c.id)
          .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          .map(w => ({ id: w.id, date: w.date, coach: w.coach, category: w.category, items: w.items || [] })),
        // Completed calendar bookings — used by gamification to count training sessions.
        // Kept separate from workouts (which have exercises/items) to avoid UI side-effects.
        bookedSessions: pastBookingsAll.filter(b => b.clientId === c.id),
        weightLogs: weights.filter(w => w.client_id === c.id)
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))
          .map(w => ({ id: w.id, date: w.date, weight: Number(w.weight) })),
        stepsLogs: stepsRaw.filter(s => s.client_id === c.id)
          .sort((a, b) => parseDate(a.date) - parseDate(b.date))
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
        }
      }))

      // Retry saving rescued pending meals from localStorage (async, after state settles)
      if (pendingLSArr.length) {
        setTimeout(() => {
          pendingLSArr.forEach(([tmpId, { clientId, payload }]) => {
            const dbMeals = meals.filter(m => m.client_id === clientId)
            const alreadyInDB = dbMeals.some(m =>
              m.date === payload.date && m.label === payload.label &&
              Number(m.grams) === Number(payload.grams) && Math.round(Number(m.kcal)) === Math.round(Number(payload.kcal))
            )
            if (alreadyInDB) return // Already in DB, localStorage cleanup done above
            // Not in DB — retry save
            DB.insert('meals', payload)
              .then(data => {
                if (data?.id) {
                  setClients(prev => prev.map(c => c.id === clientId
                    ? { ...c, meals: c.meals.map(m => m.id === tmpId ? { ...m, id: data.id } : m) }
                    : c
                  ))
                }
                const ls = lsReadPending(); delete ls[tmpId]; lsWritePending(ls)
              })
              .catch(() => { /* network down — will retry on next app load */ })
          })
        }, 1500)
      }

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

  // ── Re-sync meals when app returns to foreground (mobile PWA) ────
  useEffect(() => {
    async function onVisible() {
      if (document.visibilityState !== 'visible') return
      try {
        let visAuth = { role: null, id: null }
        try { visAuth = JSON.parse(localStorage.getItem('synrg_auth') || '{}') } catch {}
        const visIsClient = visAuth.role === 'client' && visAuth.id
        const visTwoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10)
        const visQuery = visIsClient
          ? `&client_id=eq.${visAuth.id}&order=id.desc&limit=50000`
          : `&order=id.desc&created_at=gte.${visTwoYearsAgo}&limit=100000`
        const freshMeals = await DB.selectAll('meals', visQuery)
        setClients(prev => prev.map(c => {
          const saved = freshMeals.filter(m => m.client_id === c.id).map(m => ({
            id: m.id, label: m.label, grams: m.grams, kcal: m.kcal,
            protein: m.protein, carbs: m.carbs || 0, fat: m.fat || 0,
            date: normalizeMealDate(m.date),
          }))
          // Count-aware dedup: each saved meal "consumes" at most one tmp_ match.
          // Prevents N identical tmp_ entries from all being removed when only M < N are in DB.
          const usedIds = new Set()
          const pending = c.meals
            .filter(m => String(m.id).startsWith('tmp_'))
            .filter(tm => {
              const match = saved.find(s =>
                !usedIds.has(s.id) &&
                s.date === tm.date && s.label === tm.label &&
                Number(s.grams) === Number(tm.grams) && Math.round(Number(s.kcal)) === Math.round(Number(tm.kcal))
              )
              if (match) { usedIds.add(match.id); return false }
              return true
            })
          return { ...c, meals: [...saved, ...pending] }
        }))
      } catch { /* silent — offline */ }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // ── Refs so periodic-sync closures always see latest community data ──
  // XP computation uses communityPosts/communityComments; without these the admin
  // would compute lower XP than the client does from their own view.
  const feedPostsRef    = useRef([])
  const postCommentsRef = useRef([])
  const clientsRef      = useRef([])
  feedPostsRef.current    = feedPosts
  postCommentsRef.current = postComments
  clientsRef.current      = clients

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

  // ── Periodic data sync for coaches/admin (every 2 min + immediately on login) ──
  // Admin is the SOLE authority for XP: computes from fresh data (meals + workouts + weight
  // + steps) and writes authoritative values to DB. Clients read from DB — so everyone
  // always sees the same numbers with no competing writes.
  useEffect(() => {
    if (!auth.isLoggedIn || (auth.role !== 'coach' && auth.role !== 'admin')) return
    async function syncFresh() {
      try {
        const twoYearsAgo = new Date(Date.now() - 730 * 86400000).toISOString().slice(0, 10)
        // CRITICAL: queries MUST match initial loadAll() limits exactly — otherwise
        // periodic sync returns fewer rows than initial load (PostgREST defaults to
        // max 1000 rows) and SHRINKS the admin's dataset on refresh, silently
        // dropping clients' meals/weights/steps → incorrect XP computation.
        const [freshMeals, freshWeights, freshSteps, freshWorkouts, freshPosts, freshComments, freshBookings] = await Promise.all([
          DB.selectAll('meals',        `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=100000`),
          DB.selectAll('weight_logs',  `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=20000`).catch(() => []),
          DB.selectAll('steps_logs',   `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=20000`).catch(() => []),
          DB.selectAll('workouts',     `&order=id.desc&created_at=gte.${twoYearsAgo}&limit=50000`).catch(() => null),
          // Community posts/comments affect m_community_* badges → must be refreshed
          // with explicit limits. Using order=created_at.desc ensures newest entries
          // are never dropped if total exceeds the limit.
          DB.selectAll('community_posts', '&order=created_at.desc&limit=50000').catch(() => null),
          DB.selectAll('post_comments',   '&order=created_at.desc&limit=100000').catch(() => null),
          // Slot bookings for all clients — needed so XP computation counts booked sessions
          DB.getAllPastBookings().catch(() => []),
        ])
        // Push fresh community data into state + refs so XP computation below uses it
        if (freshPosts) {
          const sorted = [...freshPosts].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
          setFeedPosts(sorted)
          feedPostsRef.current = sorted
        }
        if (freshComments) {
          setPostComments(freshComments)
          postCommentsRef.current = freshComments
        }
        // Compute merged state OUTSIDE setClients so xpPayload is deterministic.
        // (React 18 setState updaters may be deferred; relying on side effects
        // inside them can leave xpPayload null when batchUpdateXP runs.)
        const prevClients = clientsRef.current || []
        const merged = prevClients.map(c => {
          const saved = freshMeals.filter(m => m.client_id === c.id).map(m => ({
            id: m.id, label: m.label, grams: m.grams, kcal: m.kcal,
            protein: m.protein, carbs: m.carbs || 0, fat: m.fat || 0,
            date: normalizeMealDate(m.date),
          }))
          const usedIds2 = new Set()
          const pending = (c.meals || [])
            .filter(m => String(m.id).startsWith('tmp_'))
            .filter(tm => {
              const match = saved.find(s =>
                !usedIds2.has(s.id) &&
                s.date === tm.date && s.label === tm.label &&
                Number(s.grams) === Number(tm.grams) && Math.round(Number(s.kcal)) === Math.round(Number(tm.kcal))
              )
              if (match) { usedIds2.add(match.id); return false }
              return true
            })
          return {
            ...c,
            meals: [...saved, ...pending],
            weightLogs: freshWeights.filter(w => w.client_id === c.id)
              .sort((a, b) => parseDate(a.date) - parseDate(b.date))
              .map(w => ({ id: w.id, date: w.date, weight: Number(w.weight) })),
            stepsLogs: freshSteps.filter(s => s.client_id === c.id)
              .sort((a, b) => parseDate(a.date) - parseDate(b.date))
              .map(s => ({ id: s.id, date: s.date, steps: Number(s.steps) })),
            ...(freshWorkouts ? {
              workouts: freshWorkouts.filter(w => w.client_id === c.id)
                .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
                .map(w => ({ id: w.id, date: w.date, coach: w.coach, category: w.category, items: w.items || [] })),
            } : {}),
            bookedSessions: freshBookings.filter(b => b.clientId === c.id),
          }
        })

        // Compute XP for all non-coach clients from fresh merged data.
        // Must enrich with community data (posts/comments) — XP system uses these
        // for m_community_* badges; without them admin computes lower XP than client.
        const curFeed     = feedPostsRef.current || []
        const curComments = postCommentsRef.current || []
        const xpPayload = merged.filter(c => !c.is_coach && c.id).map(c => {
          const enriched = {
            ...c,
            communityPosts:    curFeed.filter(p => p.author_name === c.name),
            communityComments: curComments.filter(cm => cm.author_name === c.name),
          }
          const earnedIds = evaluateBadges(enriched)
          const totalXP   = computeTotalXP(earnedIds, enriched)
          const monthlyXP = computeMonthlyXP(enriched)
          const { level } = computeLevel(totalXP)
          return { id: c.id, xp_monthly: monthlyXP, xp_total: totalXP, xp_level: level }
        })

        // Update state with merged clients (fresh meals/weights/steps/workouts)
        setClients(merged)
        clientsRef.current = merged

        // Write authoritative XP to DB — clients read from here.
        // Await so any error surfaces in catch below (was silently swallowed before).
        if (xpPayload.length) {
          try {
            console.log('[syncFresh] Writing XP to DB:', xpPayload.length, 'clients',
              xpPayload.map(x => `${x.id.slice(0,8)}=${x.xp_monthly}`).join(' '))
            await DB.batchUpdateXP(xpPayload)
          } catch (err) {
            console.error('[syncFresh] batchUpdateXP failed:', err)
          }
        }
      } catch (err) {
        console.warn('[syncFresh] failed:', err)
      }
    }
    syncFresh()  // run immediately so DB is up-to-date right on login
    const interval = setInterval(syncFresh, 120000)
    return () => clearInterval(interval)
  }, [auth.isLoggedIn, auth.role])

  // ── Client: periodically re-read XP from DB (admin writes there every 2 min) ──
  // Ensures clients see up-to-date ranking without any self-computation.
  useEffect(() => {
    if (!auth.isLoggedIn || auth.role !== 'client') return
    async function refreshXP() {
      try {
        const freshClients = await DB.selectAll('clients').catch(() => null)
        if (!freshClients?.length) return
        setClients(prev => prev.map(c => {
          const fc = freshClients.find(x => x.id === c.id)
          if (!fc) return c
          return { ...c, xp_monthly: fc.xp_monthly || 0, xp_total: fc.xp_total || 0, xp_level: fc.xp_level || 1 }
        }))
      } catch { /* silent */ }
    }
    refreshXP()  // run immediately on login to pick up latest admin-written values
    const interval = setInterval(refreshXP, 300000)  // every 5 min
    return () => clearInterval(interval)
  }, [auth.isLoggedIn, auth.role])

  // ── Auth ──────────────────────────────────────────────────────
  // Server-side bcrypt verification via auth-login Edge Function.
  // Replaces client-side password comparison (which exposed plaintext via anon key).
  async function handleLogin(name, pass, turnstileToken = null) {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
    let result
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ name: name.trim(), password: pass, turnstile_token: turnstileToken }),
      })
      result = await res.json()
      if (!res.ok || !result.ok) return t('errLogin')
    } catch {
      return t('errLogin')
    }

    const c = result.client
    if (c.is_coach) {
      const a = { isLoggedIn: true, role: 'coach', name: c.name, id: c.id }
      setAuth(a)
      localStorage.setItem('synrg_auth', JSON.stringify(a))
      setSelCoach(c.name)
      setViewingCoach(null)
      return null
    }
    // Client login
    const idx = clients.findIndex(x => x.id === c.id)
    if (idx >= 0) {
      setSelIdx(idx)
      localStorage.setItem('synrg_selidx', String(idx))
    }
    const a = { isLoggedIn: true, role: 'client', name: c.name, id: c.id, modules: c.modules || [] }
    setAuth(a)
    localStorage.setItem('synrg_auth', JSON.stringify(a))
    return null
  }

  async function handleRegisterClient(name, pass, email = null, turnstileToken = null) {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY
    const FREE_MODULES = ['nutrition_tracking', 'weight_tracking', 'steps_tracking']

    let result
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/auth-register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({ name: name.trim(), password: pass, email, turnstile_token: turnstileToken }),
      })
      result = await res.json()
      if (res.status === 409) return t('errClientExists')
      if (!res.ok || !result.ok) return result.error || t('errLogin')
    } catch {
      return t('errLogin')
    }

    const data = result.client
    const newClient = {
      id: data.id, name, is_coach: false,
      email: email || null,
      calorieTarget: 2000, proteinTarget: 140, modules: FREE_MODULES,
      meals: [], workouts: [], weightLogs: [], tasks: [], reactions: [],
      reminderSettings: { protein: true, weight: true, foodLog: true, coach: true },
    }
    setClients(prev => {
      const updated = [...prev, newClient]
      const newRealIdx = updated.filter(c => !c.is_coach).length - 1
      setSelIdx(newRealIdx)
      return updated
    })
    setAuth({ isLoggedIn: true, role: 'client', name, id: data.id, modules: FREE_MODULES })

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

  // ── Keep auth.modules in sync with DB whenever clients list refreshes ──
  // This catches admin module changes without requiring a logout/login cycle
  useEffect(() => {
    if (!auth.isLoggedIn || auth.role !== 'client' || !auth.id) return
    const me = clients.find(c => c.id === auth.id)
    if (!me) return
    const freshModules = me.modules || []
    if (JSON.stringify(freshModules) !== JSON.stringify(auth.modules || [])) {
      const updatedAuth = { ...auth, modules: freshModules }
      setAuth(updatedAuth)
      localStorage.setItem('synrg_auth', JSON.stringify(updatedAuth))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients])

  // ── Computed: real clients (no coach profiles) ────────────────
  // Enriched with community data so ALL downstream XP/badge computation is consistent
  // (Progress ranking, App.jsx BadgeUnlockWatcher, BadgeDetailDialog progress bars, etc.)
  const realClients = useMemo(
    () => clients.filter(c => !c.is_coach).map(c => ({
      ...c,
      communityPosts:    feedPosts.filter(p => p.author_name === c.name),
      communityComments: postComments.filter(cm => cm.author_name === c.name),
    })),
    [clients, feedPosts, postComments]
  )

  // ── Computed: coach profiles (shadow clients for coaches) ──────
  const coachProfiles = useMemo(
    () => clients.filter(c => c.is_coach).map(c => ({
      ...c,
      communityPosts:    feedPosts.filter(p => p.author_name === c.name),
      communityComments: postComments.filter(cm => cm.author_name === c.name),
    })),
    [clients, feedPosts, postComments]
  )

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
  const isCoachOrAdmin = auth.role === 'coach' || auth.role === 'admin'

  const ranking = useMemo(() => {
    if (isCoachOrAdmin) {
      // realClients is already enriched with community data (see realClients useMemo),
      // so computeXPRanking includes m_community_* badges — matches what each client
      // computes from their own Progress page.
      return computeXPRanking(realClients)
    }
    // Client role: read from DB (written by admin's periodic sync every 2 min).
    // All clients read the same DB values → everyone sees an identical ranking.
    return [...realClients]
      .map(c => ({
        name:        c.name,
        clientId:    c.id,
        xp:          c.xp_monthly || 0,
        totalXP:     c.xp_total   || 0,
        level:       c.xp_level   || 1,
        badge_count: 0,
      }))
      .sort((a, b) => b.xp - a.xp)
  }, [realClients, isCoachOrAdmin])
  const kcalPct  = Math.min((foodTotals.kcal    / (client.calorieTarget || 1)) * 100, 100)
  const protPct  = Math.min((foodTotals.protein / (client.proteinTarget || 1)) * 100, 100)

  // ── Derive carbs / fat targets from kcal + protein ─────────────
  // Standard split: fat ≈ 27% of total kcal (9 kcal/g),
  // carbs = remaining kcal after protein and fat (4 kcal/g).
  const fatTarget   = Math.round(((client.calorieTarget || 0) * 0.27) / 9)
  const carbsTarget = Math.max(
    0,
    Math.round(
      ((client.calorieTarget || 0) - (client.proteinTarget || 0) * 4 - fatTarget * 9) / 4
    )
  )
  const carbsPct = Math.min((foodTotals.carbs / (carbsTarget || 1)) * 100, 100)
  const fatPct   = Math.min((foodTotals.fat   / (fatTarget   || 1)) * 100, 100)

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
    const tmpId = 'tmp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
    const payload = {
      client_id: clientId, date: meal.date, label: meal.label,
      grams: meal.grams, kcal: meal.kcal, protein: meal.protein,
      carbs: meal.carbs || 0, fat: meal.fat || 0,
    }

    // Persist to localStorage BEFORE optimistic update — survives PWA kill on iOS/Android
    const lsBefore = lsReadPending()
    lsBefore[tmpId] = { clientId, payload }
    lsWritePending(lsBefore)

    // Optimistic update — show immediately with temp ID
    setClients(prev => prev.map(c => c.id === clientId
      ? { ...c, meals: [...c.meals, { ...meal, id: tmpId }] }
      : c
    ))

    // Try up to 5 times with exponential backoff
    let saved = false
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 1000 * attempt))
        // Before retrying: check if the meal was ALREADY saved in a previous attempt
        // whose response was dropped (prevents duplicate DB rows from retries)
        try {
          const existing = await DB.selectAll('meals',
            `&client_id=eq.${clientId}&date=eq.${payload.date}&label=eq.${encodeURIComponent(payload.label)}&grams=eq.${payload.grams}&order=id.desc&limit=1`
          )
          if (existing && existing.length > 0) {
            const realId = existing[0].id
            setClients(prev => prev.map(c => c.id === clientId
              ? { ...c, meals: c.meals.map(m => m.id === tmpId ? { ...m, id: realId } : m) }
              : c
            ))
            const lsCheck = lsReadPending(); delete lsCheck[tmpId]; lsWritePending(lsCheck)
            saved = true
            break
          }
        } catch { /* check failed — proceed with retry insert */ }
        if (saved) break
      }
      try {
        const data = await DB.insert('meals', payload)
        // Replace temp ID with real DB ID (data may be null if server returns 204)
        if (data?.id) {
          setClients(prev => prev.map(c => c.id === clientId
            ? { ...c, meals: c.meals.map(m => m.id === tmpId ? { ...m, id: data.id } : m) }
            : c
          ))
        }
        // Successfully saved — remove from localStorage
        const lsAfter = lsReadPending()
        delete lsAfter[tmpId]
        lsWritePending(lsAfter)
        saved = true
        break
      } catch { /* retry */ }
    }

    if (!saved) {
      // All attempts failed — keep the meal visible but flag it so user knows to retry
      // Leave in localStorage — will be retried on next app load
      setClients(prev => prev.map(c => c.id === clientId
        ? { ...c, meals: c.meals.map(m => m.id === tmpId ? { ...m, _failed: true } : m) }
        : c
      ))
      showSnackbar('Храната НЕ е запазена — провери интернет и въведи отново', 'error')
    }
  }

  async function deleteMealFromClient(clientId, mealId) {
    if (isTrackerReadOnly) return

    // Pending/unsaved meal (never reached DB) — just clean localStorage and state
    if (String(mealId).startsWith('tmp_')) {
      const ls = lsReadPending()
      delete ls[mealId]
      lsWritePending(ls)
      setClients(prev => prev.map(c => c.id === clientId
        ? { ...c, meals: c.meals.filter(m => m.id !== mealId) }
        : c
      ))
      return
    }

    // Real DB meal — optimistic delete, restore on failure
    let deletedMeal = null
    setClients(prev => prev.map(c => {
      if (c.id !== clientId) return c
      deletedMeal = c.meals.find(m => m.id === mealId) || null
      return { ...c, meals: c.meals.filter(m => m.id !== mealId) }
    }))

    try {
      await DB.deleteById('meals', mealId)
    } catch {
      // Network failure — restore the meal so nothing is lost
      if (deletedMeal) {
        setClients(prev => prev.map(c => c.id === clientId
          ? { ...c, meals: [...c.meals, deletedMeal] }
          : c
        ))
      }
      showSnackbar('Грешка при изтриване — провери интернет', 'error')
    }
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
      return { ...c, weightLogs: [...logs, { id: data.id, date, weight: Number(weight) }].sort((a, b) => parseDate(a.date) - parseDate(b.date)) }
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
      return { ...c, stepsLogs: [...logs, { id: data.id, date, steps: Number(steps) }].sort((a, b) => parseDate(a.date) - parseDate(b.date)) }
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
      date:    selFoodDate || todayDate(),
    }
    addMealToClient(client.id, meal)
    setFoodSearch(''); setGramsInput(''); setFoodModalOpen(false)
    const suffix = selFoodDate && selFoodDate !== todayDate() ? ` (${selFoodDate})` : ''
    showSnackbar(`${food.label} ${t('foodAddedSuffix')}${suffix}`)
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
      date:    selFoodDate || todayDate(),
    }
    addMealToClient(client.id, meal)
    const suffix = selFoodDate && selFoodDate !== todayDate() ? ` (${selFoodDate})` : ''
    showSnackbar(`${food.label} ${t('foodAddedSuffix')}${suffix}`)
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
      date:    selFoodDate || todayDate(),
    }
    addMealToClient(client.id, meal)
    setFoodModalOpen(false)
    const suffix = selFoodDate && selFoodDate !== todayDate() ? ` (${selFoodDate})` : ''
    showSnackbar(`${name} ${t('foodAddedSuffix')}${suffix}`)
  }

  // ── Weight actions ────────────────────────────────────────────
  // Sanity guards (protect the gamification/ranking from typos like "81500" or "9.6")
  const WEIGHT_MIN_KG     = 20
  const WEIGHT_MAX_KG     = 300
  const WEIGHT_JUMP_KG    = 10   // ask for confirmation beyond this delta vs. last log

  function saveWeight() {
    const raw = String(weightInput).trim().replace(',', '.')
    const w = Number(raw)
    if (!w || isNaN(w)) { showSnackbar(t('warningWeight'), 'warning'); return }

    // Missing-decimal detection (e.g. "81500" instead of "81.5")
    if (w >= 1000 && !raw.includes('.')) {
      showSnackbar(t('warningWeightNoDecimal'), 'warning')
      return
    }

    // Absolute bounds — plausible human range
    if (w < WEIGHT_MIN_KG || w > WEIGHT_MAX_KG) {
      showSnackbar(t('warningWeightRange'), 'warning')
      return
    }

    // Sanity check vs. the latest recorded weight — big jumps require confirmation
    const logs = [...(client.weightLogs || [])].sort((a, b) => parseDate(a.date) - parseDate(b.date))
    const last = logs[logs.length - 1]
    if (last && Math.abs(w - Number(last.weight)) >= WEIGHT_JUMP_KG) {
      const msg = t('confirmWeightJump')
        .replace('{prev}', fmt1(Number(last.weight)))
        .replace('{new}',  fmt1(w))
      if (!window.confirm(msg)) return
    }

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
    const prevClient = clients.find(c => c.id === clientId)
    const prevModules = prevClient?.modules || []
    const hadSynrg = prevModules.includes('synrg_method')
    const hasSynrg = newModules.includes('synrg_method')
    const gainedSynrg = hasSynrg && !hadSynrg

    await DB.update('clients', clientId, { modules: newModules })
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, modules: newModules } : c))
    // If the currently logged-in client's modules changed, update auth too
    if (auth.id === clientId) {
      const updatedAuth = { ...auth, modules: newModules }
      setAuth(updatedAuth)
      localStorage.setItem('synrg_auth', JSON.stringify(updatedAuth))
    }

    // Auto-assign coach when synrg_method is newly granted and no coach yet
    if (gainedSynrg && prevClient && !prevClient.assigned_coach_id) {
      const ELINA_ID = '1b0a54a2-22c0-49b6-8083-8ed6356e29d2'
      const ITSKO_ID = '4ce4ed28-1b4c-4a57-8d22-d02a402f45ac'
      let elinaCount = 0, itskoCount = 0
      for (const c of clients) {
        if (!(c.modules || []).includes('synrg_method')) continue
        if (c.assigned_coach_id === ELINA_ID) elinaCount++
        else if (c.assigned_coach_id === ITSKO_ID) itskoCount++
      }
      const pickedCoachId   = elinaCount <= itskoCount ? ELINA_ID : ITSKO_ID
      const pickedCoachName = pickedCoachId === ELINA_ID ? 'Елина' : 'Ицко'
      try {
        await DB.assignCoach(clientId, pickedCoachId)
        setClients(prev => prev.map(c => c.id === clientId ? { ...c, assigned_coach_id: pickedCoachId } : c))
        await DB.sendCoachMessage({
          clientId,
          coachId: pickedCoachId,
          senderRole: 'coach',
          senderName: pickedCoachName,
          text: `Здравей, ${prevClient.name || 'клиент'}! Аз съм ${pickedCoachName}, твоят ментор в SYNRG Метод. Добре дошъл/дошла! Имаш 2 check-in сесии на месец — пиши ми тук, когато имаш въпроси или се нуждаеш от корекция по плана.`,
        })
      } catch (e) { console.warn('Auto-assign coach failed:', e) }
    }
  }

  // ── Coach chat: fetch messages for a specific client ──────
  const fetchClientMessages = useCallback(async (clientId) => {
    if (!clientId) return []
    try {
      const rows = await DB.getCoachMessages(clientId)
      return rows
    } catch (err) {
      console.warn('[coachChat] fetchClientMessages failed:', err)
      return []
    }
  }, [])

  // ── Coach chat: send a message ────────────────────────────
  const sendCoachMessage = useCallback(async ({ clientId, coachId, text }) => {
    if (!clientId || !coachId || !text?.trim()) return null
    const senderRole = auth.role === 'admin' ? 'admin' : (auth.role === 'coach' ? 'coach' : 'client')
    try {
      const row = await DB.sendCoachMessage({
        clientId, coachId, senderRole,
        senderName: auth.name || null,
        text: text.trim(),
      })
      // Update local state if loaded
      setCoachMessages(prev => prev.some(m => m.id === row?.id) ? prev : [...prev, row].filter(Boolean))
      return row
    } catch (err) {
      console.warn('[coachChat] send failed:', err)
      showSnackbar('Съобщението не беше изпратено', 'error')
      return null
    }
  }, [auth.role, auth.name, showSnackbar])

  // ── Coach chat: mark read ─────────────────────────────────
  const markCoachMessagesRead = useCallback(async (clientId) => {
    if (!clientId) return
    const readerRole = auth.role === 'client' ? 'client' : 'coach'
    try {
      await DB.markCoachMessagesRead({ clientId, readerRole })
      const now = new Date().toISOString()
      setCoachMessages(prev => prev.map(m => {
        if (m.client_id !== clientId || m.read_at) return m
        if (readerRole === 'client' && m.sender_role === 'client') return m
        if (readerRole === 'coach'  && m.sender_role !== 'client') return m
        return { ...m, read_at: now }
      }))
    } catch { /* silent */ }
  }, [auth.role])

  // ── Coach chat: assign coach (admin only) ─────────────────
  const assignCoach = useCallback(async (clientId, coachId) => {
    if (!clientId) return
    await DB.assignCoach(clientId, coachId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, assigned_coach_id: coachId || null } : c))
  }, [])

  // ── Coach chat: polling (client reads their thread, coach/admin read all) ──
  const coachChatTimerRef = useRef(null)
  useEffect(() => {
    if (!auth.isLoggedIn) return
    let cancelled = false
    async function poll() {
      try {
        if (auth.role === 'client' && auth.id) {
          const rows = await DB.getCoachMessages(auth.id)
          if (!cancelled) { setCoachMessages(rows); setCoachMsgsLoaded(true) }
        } else if (auth.role === 'coach' || auth.role === 'admin') {
          const rows = await DB.getAllCoachMessages(5000)
          if (!cancelled) { setCoachMessages(rows); setCoachMsgsLoaded(true) }
        }
      } catch { /* silent */ }
    }
    poll()
    coachChatTimerRef.current = setInterval(poll, 30000)
    return () => { cancelled = true; clearInterval(coachChatTimerRef.current) }
  }, [auth.isLoggedIn, auth.role, auth.id])

  // Unread count for client (messages from coach/admin, not read)
  const unreadCoachMsgCount = useMemo(() => {
    if (auth.role === 'client') {
      return coachMessages.filter(m => m.sender_role !== 'client' && !m.read_at).length
    }
    // Admin (by name or role) → counts across all clients
    const isAdmn = isAdminUser(auth) || isFullAdmin(auth) || auth.role === 'admin'
    if (isAdmn) {
      return coachMessages.filter(m => m.sender_role === 'client' && !m.read_at).length
    }
    // Regular coach → only messages from their assigned clients
    if (auth.role === 'coach') {
      const myClientIds = new Set(clients.filter(c => c.assigned_coach_id === auth.id).map(c => c.id))
      return coachMessages.filter(m => m.sender_role === 'client' && !m.read_at && myClientIds.has(m.client_id)).length
    }
    return 0
  }, [coachMessages, auth, clients])

  async function dismissBadge(badgeId, monthKey = null) {
    const cl = client
    if (!cl?.id) return
    const key = monthKey ? `${badgeId}:${monthKey}` : badgeId
    // Read FRESH dismissedBadges via functional setClients to avoid closure races
    // (e.g., when called multiple times in a tight loop, each call would otherwise
    //  overwrite the previous one with stale state)
    let updated
    setClients(prev => prev.map(c => {
      if (c.id !== cl.id) return c
      updated = [...new Set([...(c.dismissedBadges || []), key])]
      return { ...c, dismissedBadges: updated }
    }))
    if (updated) {
      try { await DB.update('clients', cl.id, { dismissed_badges: updated }) }
      catch (e) { console.warn('dismissBadge persist failed:', e) }
    }
  }

  // Bulk-dismiss multiple badges in ONE DB call (used for PR celebrations
  // where 0,5,10 kg milestones all unlock at once).
  async function dismissBadgesBulk(keys) {
    const cl = client
    if (!cl?.id || !keys || keys.length === 0) return
    let merged
    setClients(prev => prev.map(c => {
      if (c.id !== cl.id) return c
      merged = [...new Set([...(c.dismissedBadges || []), ...keys])]
      return { ...c, dismissedBadges: merged }
    }))
    if (merged) {
      try { await DB.update('clients', cl.id, { dismissed_badges: merged }) }
      catch (e) { console.warn('dismissBadgesBulk persist failed:', e) }
    }
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
    pendingProgramOpen, setPendingProgramOpen,
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
    ranking, kcalPct, protPct, carbsPct, fatPct,
    carbsTarget, fatTarget, visibleClients,
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
    dismissBadgesBulk,
    synrgHabits, setSynrgHabits,
    // Coach chat
    coachMessages, coachMsgsLoaded, unreadCoachMsgCount,
    fetchClientMessages, sendCoachMessage, markCoachMessagesRead, assignCoach,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
