import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, CircularProgress, Typography, Button, Alert, Snackbar, IconButton, useMediaQuery } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { ThemeProvider, useTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AppProvider, useApp } from './context/AppContext'
import { BookingProvider }     from './context/BookingContext'
import { C, EASE, makeTheme }  from './theme'
import { isAdmin }             from './lib/bookingUtils'
import { hasModule }           from './lib/modules'
import {
  evaluateBadges, evaluateMonthlyBadgesForMonth, getCurrentMonthKey,
  ALLTIME_BADGES, MONTHLY_BADGES, PR_EXERCISES, getCurrentPRs,
  computeTotalXP, computeLevel, getLevelName,
} from './lib/gamification'

import SiteHeader     from './layout/SiteHeader'
import CookieBanner   from './components/CookieBanner'
import Sidebar        from './layout/Sidebar'
import MobileHeader   from './layout/MobileHeader'
import MobileNav      from './layout/MobileNav'

import Auth           from './pages/Auth'
import Dashboard, { ClientDetail, ClientSchedule } from './pages/Dashboard'
import FoodTracker    from './pages/FoodTracker'
import WeightTracker  from './pages/WeightTracker'
import Progress, { BadgeUnlockedToast, LevelUpCelebration } from './pages/Progress'
import Ranking        from './pages/Ranking'
import Tasks, { AllClientsTasks } from './pages/Tasks'
import SynrgMethod from './pages/SynrgMethod'
import Booking        from './pages/Booking'
import Schedule       from './pages/Schedule'
import Admin          from './pages/Admin'
import Programs       from './pages/Programs'
import StepsTracker   from './pages/StepsTracker'
import ClientWorkout  from './pages/ClientWorkout'
import Notifications  from './pages/Notifications'
import Recipes        from './pages/Recipes'
import CoachChat      from './pages/CoachChat'
import AdminMessagesTab from './pages/AdminMessagesTab'
import Profile        from './pages/Profile'
import OnlineHome     from './pages/OnlineHome'
import LeadHome       from './pages/LeadHome'
import useClientTier  from './hooks/useClientTier'

import ConfirmDeleteModal from './components/ConfirmDeleteModal'
import WelcomeTour        from './components/WelcomeTour'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

function LoadingScreen({ t }) {
  return (
    <Box sx={{
      flex:           1,
      background:     C.bg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            2,
      animation:      'fadeIn 0.4s ease',
    }}>
      <CircularProgress sx={{ color: C.primary }} size={36} thickness={3} />
      <Typography variant="body2" sx={{ color: C.muted, letterSpacing: '0.3px' }}>
        {t('loading')}
      </Typography>
    </Box>
  )
}

function ErrorScreen({ error, onRetry, t }) {
  return (
    <Box sx={{
      flex:           1,
      background:     C.bg,
      display:        'flex',
      alignItems:     'center',
      justifyContent: 'center',
      flexDirection:  'column',
      gap:            2,
      p:              3,
      animation:      'fadeInUp 0.3s ease',
    }}>
      <WarningAmberIcon sx={{ fontSize: '40px', color: C.danger }} />
      <Typography sx={{ color: C.danger, fontWeight: 700, letterSpacing: '-0.1px' }}>
        {t('loadError')}
      </Typography>
      <Box sx={{
        color:        C.muted,
        fontSize:     '13px',
        maxWidth:     '360px',
        textAlign:    'center',
        background:   C.card,
        p:            2,
        borderRadius: '16px',
        border:       `1px solid ${C.border}`,
      }}>
        {error}
      </Box>
      <Button variant="contained" color="primary" onClick={onRetry} sx={{ mt: 1 }}>
        {t('retry')}
      </Button>
    </Box>
  )
}

// ── Page wrapper — fades in every time the view changes ────────
function PageTransition({ children, viewKey }) {
  return (
    <Box
      key={viewKey}
      sx={{
        animation:  'fadeInUp 0.22s ease both',
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </Box>
  )
}

// ── Global badge + level-up watcher ──────────────────────────────
function BadgeUnlockWatcher() {
  const { client, t, lang, dismissBadge, dismissBadgesBulk } = useApp()
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const [levelUpInfo, setLevelUpInfo]     = useState(null)
  const prevEarnedRef  = useRef(null)
  const prevLevelRef   = useRef(null)

  const currentMonthKey  = useMemo(() => getCurrentMonthKey(), [])
  const earnedIds        = useMemo(() => evaluateBadges(client), [client.meals, client.weightLogs, client.workouts, client.stepsLogs])
  const monthlyEarnedIds = useMemo(() => evaluateMonthlyBadgesForMonth(client, currentMonthKey), [client.meals, client.weightLogs, client.workouts, client.stepsLogs, currentMonthKey])
  const totalXP          = useMemo(() => computeTotalXP(earnedIds, client), [earnedIds, client])
  const levelData        = useMemo(() => computeLevel(totalXP), [totalXP])

  // Detect NEW badges (not on first load — only live changes)
  useEffect(() => {
    if (unlockedBadge) return
    if (prevEarnedRef.current === null) {
      prevEarnedRef.current = { a: [...earnedIds], m: [...monthlyEarnedIds] }
      return
    }
    if (earnedIds.length === 0) return
    const dismissed = new Set(client.dismissedBadges || [])
    const newA = earnedIds.find(id => !prevEarnedRef.current.a.includes(id) && !dismissed.has(id))
    if (newA) {
      const badge = ALLTIME_BADGES.find(b => b.id === newA)
      if (badge) { setUnlockedBadge(badge); prevEarnedRef.current.a = [...earnedIds]; return }
    }
    const newM = monthlyEarnedIds.find(id => !prevEarnedRef.current.m.includes(id) && !dismissed.has(`${id}:${currentMonthKey}`))
    if (newM) {
      const badge = MONTHLY_BADGES.find(b => b.id === newM)
      if (badge) { setUnlockedBadge(badge); prevEarnedRef.current.m = [...monthlyEarnedIds]; return }
    }
    prevEarnedRef.current = { a: [...earnedIds], m: [...monthlyEarnedIds] }
  }, [earnedIds, monthlyEarnedIds, client.dismissedBadges, unlockedBadge])

  // Detect PR milestones (uses dismissed_badges, works on first load too)
  const currentPRs = useMemo(() => getCurrentPRs(client.workouts), [client.workouts])
  const [prCelebration, setPrCelebration] = useState(null)

  useEffect(() => {
    if (!client.workouts || client.workouts.length === 0) return
    if (unlockedBadge || prCelebration) return
    const dismissed = client.dismissedBadges || []
    for (const ex of PR_EXERCISES) {
      const pr = currentPRs[ex.id]
      if (!pr || pr.unlockedIdx.length === 0) continue
      // Only show the HIGHEST unlocked milestone, skip if already dismissed
      const highestIdx = pr.unlockedIdx[pr.unlockedIdx.length - 1]
      const m = ex.milestones[highestIdx]
      const key = `${ex.id}:${m.v}`
      if (!dismissed.includes(key)) {
        setPrCelebration({ exercise: ex, value: m.v, allMilestones: pr.unlockedIdx.map(i => ex.milestones[i]) })
        return
      }
    }
  }, [currentPRs, client.dismissedBadges, unlockedBadge, prCelebration])

  useEffect(() => {
    if (!prCelebration) return
    // Dismiss ALL milestones IMMEDIATELY when celebration shows.
    // This prevents the banner from re-appearing if user closes the app
    // before the auto-dismiss timer fires (PWA timers pause when backgrounded).
    const keys = (prCelebration.allMilestones || [{ v: prCelebration.value }])
      .map(m => `${prCelebration.exercise.id}:${m.v}`)
    dismissBadgesBulk(keys).catch(e => console.warn('PR dismiss failed:', e))
    // Hide visually after 4s
    const timer = setTimeout(() => setPrCelebration(null), 4000)
    return () => clearTimeout(timer)
  }, [prCelebration])

  // Detect level up
  useEffect(() => {
    const curLevel = levelData.level
    if (prevLevelRef.current !== null && curLevel > prevLevelRef.current) {
      setLevelUpInfo({ level: curLevel, name: getLevelName(curLevel, lang) })
    }
    prevLevelRef.current = curLevel
  }, [levelData.level, lang])

  // Auto-dismiss after 4s
  useEffect(() => {
    if (!unlockedBadge) return
    const timer = setTimeout(() => {
      if (unlockedBadge.monthly) dismissBadge(unlockedBadge.id, currentMonthKey)
      else dismissBadge(unlockedBadge.id)
      setUnlockedBadge(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [unlockedBadge])

  return (
    <>
      {unlockedBadge && (
        <BadgeUnlockedToast badge={unlockedBadge} t={t} onDismiss={() => {
          if (unlockedBadge.monthly) dismissBadge(unlockedBadge.id, currentMonthKey)
          else dismissBadge(unlockedBadge.id)
          setUnlockedBadge(null)
        }} />
      )}
      {prCelebration && (
        <Box onClick={() => setPrCelebration(null)}
          sx={{
            position: 'fixed', inset: 0, zIndex: 1500,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', cursor: 'pointer',
            animation: 'badgeOverlayIn 0.3s ease both',
            '@keyframes badgeOverlayIn': { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
          }}>
          <Typography sx={{ fontSize: '14px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '3px', color: '#D4AF37', mb: 2 }}>
            {lang === 'bg' ? 'НОВ ЛИЧЕН РЕКОРД!' : 'NEW PERSONAL RECORD!'}
          </Typography>
          <Typography sx={{ fontSize: '22px', fontWeight: 800, fontStyle: 'italic', fontFamily: "'MontBlanc', sans-serif", color: '#fff', mb: 1 }}>
            {lang === 'bg' ? prCelebration.exercise.labelBg : prCelebration.exercise.labelEn}
          </Typography>
          <Typography sx={{ fontSize: '48px', fontWeight: 900, color: '#D4AF37', fontFamily: "'MontBlanc', sans-serif", lineHeight: 1 }}>
            {prCelebration.value === 0 && prCelebration.exercise.type === 'weight'
              ? (lang === 'bg' ? 'Без тежест' : 'Bodyweight')
              : `${prCelebration.value}${prCelebration.exercise.type === 'weight' ? ' kg' : (lang === 'bg' ? ' пъти' : ' reps')}`}
          </Typography>
        </Box>
      )}
      {levelUpInfo && (
        <LevelUpCelebration info={levelUpInfo} t={t} onDismiss={() => setLevelUpInfo(null)} />
      )}
    </>
  )
}

// ── Main logged-in layout ────────────────────────────────────────
function AppShell() {
  const {
    auth, view, setView, client,
    loading, loadError, loadAll,
    snackbar, closeSnackbar,
    coachClientMode,
    t,
  } = useApp()

  const admin            = isAdmin(auth)
  const theme            = useTheme()
  const isMobile         = useMediaQuery(theme.breakpoints.down('sm'))
  const showClientDetail = (auth.role === 'coach' || auth.role === 'admin') && coachClientMode
  const { isOnline: isOnlineClient, isLead } = useClientTier()

  // Scroll to top whenever coach/admin opens a client
  useEffect(() => {
    if (coachClientMode) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [coachClientMode])

  if (loading)      return <LoadingScreen t={t} />
  if (loadError)    return <ErrorScreen error={loadError} onRetry={() => loadAll()} t={t} />
  if (!auth.isLoggedIn) return <Auth />

  return (
    <Box sx={{
      display:   'flex',
      flex:      1,
      minHeight: 0,
      height:    isMobile ? '100dvh' : 'auto',
      background: C.bg,
      color:      C.text,
      overflow:   'hidden',
      maxWidth:   '100vw',
    }}>
      {/* Desktop: permanent NavigationDrawer */}
      {!isMobile && <Sidebar />}

      {/* Main content column */}
      <Box sx={{
        display:       'flex',
        flexDirection: 'column',
        flex:          1,
        minWidth:      0,
        overflow:      'hidden',
      }}>
        {isMobile && <MobileHeader />}

        <Box
          component="main"
          sx={{
            flex:      1,
            px:        isMobile ? 2 : 3.5,
            pt:        isMobile ? 2 : 3.5,
            pb:        isMobile ? '96px' : 3.5,
            overflowY: 'auto',
            overflowX: 'hidden',
            minWidth:  0,
          }}
        >
          <PageTransition viewKey={showClientDetail ? `client-${client?.id}` : view}>
            {showClientDetail ? (
              <ClientDetail />
            ) : (
              <>
                {auth.isLoggedIn && view !== 'dashboard' && (
                  <Button size="small" startIcon={<ArrowBackIcon />} onClick={() => setView('dashboard')}
                    sx={{ color: C.muted, '&:hover': { color: C.purple }, pl: 0, mb: 1 }}>
                    {t('backBtn')}
                  </Button>
                )}
                {view === 'dashboard' && (
                  auth.role === 'client' && isOnlineClient
                    ? <OnlineHome />
                    : auth.role === 'client' && isLead
                      ? <LeadHome />
                      : <Dashboard />
                )}
                {view === 'progress'  && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking') || hasModule(auth.modules, 'weight_tracking')) && <Progress />}
                {view === 'food'      && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking')) && <FoodTracker />}
                {view === 'weight'    && (auth.role !== 'client' || hasModule(auth.modules, 'weight_tracking'))    && <WeightTracker />}
                {view === 'ranking'   && <Ranking />}
                {view === 'tasks'     && (auth.role === 'coach' || auth.role === 'admin') && <AllClientsTasks />}
                {view === 'tasks'     && auth.role === 'client' && <Tasks />}
                {view === 'synrg_method' && auth.role === 'client' && hasModule(auth.modules, 'synrg_method') && <SynrgMethod />}
                {view === 'booking'   && (auth.role !== 'client' || hasModule(auth.modules, 'booking_access'))     && <Booking />}
                {view === 'schedule'  && auth.role === 'client' && hasModule(auth.modules, 'booking_access')       && <ClientSchedule />}
                {view === 'schedule'  && auth.role !== 'client' && <Schedule />}
                {view === 'steps'     && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking') || hasModule(auth.modules, 'weight_tracking')) && <StepsTracker />}
                {view === 'workout'  && <ClientWorkout />}
                {view === 'programs'  && (auth.role === 'coach' || auth.role === 'admin' || auth.role === 'client') && <Programs />}
                {view === 'notifications' && auth.role === 'coach' && <Notifications />}
                {view === 'recipes'      && (auth.role !== 'client' || hasModule(auth.modules, 'program_access') || hasModule(auth.modules, 'training_plan_access')) && <Recipes />}
                {view === 'coach_chat'   && auth.role === 'client' && hasModule(auth.modules, 'synrg_method') && <CoachChat />}
                {view === 'coach_chat_admin' && auth.role === 'coach' && <AdminMessagesTab />}
                {view === 'profile'   && auth.role !== 'client' && <Profile />}
                {view === 'admin'     && admin && <Admin />}
              </>
            )}
          </PageTransition>
        </Box>
      </Box>

      {isMobile && <MobileNav />}

      <ConfirmDeleteModal />

      {auth.role === 'client' && isOnlineClient && <WelcomeTour />}

      {auth.role === 'client' && <BadgeUnlockWatcher />}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={closeSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: isMobile ? '88px' : 0 }}
      >
        <Alert
          onClose={closeSnackbar}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Root: AppProvider wraps everything so InstallScreen can use t ─
function AppContent() {
  const theme            = useTheme()
  const isMobile         = useMediaQuery(theme.breakpoints.down('sm'))
  const showSiteHeader   = !isStandalone && !isMobile

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {showSiteHeader && <SiteHeader />}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <AppShell />
      </Box>
      <CookieBanner />
    </Box>
  )
}

function ThemedWrapper({ children }) {
  const muiTheme = useMemo(() => makeTheme(), [])
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ThemedWrapper>
        {/* BookingProvider lives inside AppProvider so it can use useApp() */}
        <BookingProvider>
          <AppContent />
        </BookingProvider>
      </ThemedWrapper>
    </AppProvider>
  )
}
