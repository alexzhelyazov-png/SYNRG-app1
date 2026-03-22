import { useState, useMemo, useEffect, useRef } from 'react'
import { Box, CircularProgress, Typography, Button, Alert, Snackbar, useMediaQuery } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ThemeProvider, useTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AppProvider, useApp } from './context/AppContext'
import { BookingProvider }     from './context/BookingContext'
import { C, EASE, makeTheme }  from './theme'
import { isAdmin }             from './lib/bookingUtils'
import { hasModule }           from './lib/modules'
import {
  evaluateBadges, evaluateMonthlyBadgesForMonth, getCurrentMonthKey,
  ALLTIME_BADGES, MONTHLY_BADGES, BADGES,
  computeTotalXP, computeLevel, getLevelName,
} from './lib/gamification'

import SiteHeader     from './layout/SiteHeader'
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
import Booking        from './pages/Booking'
import Schedule       from './pages/Schedule'
import Admin          from './pages/Admin'
import Programs       from './pages/Programs'
import StepsTracker   from './pages/StepsTracker'
import ClientWorkout  from './pages/ClientWorkout'
import Notifications  from './pages/Notifications'

import ConfirmDeleteModal from './components/ConfirmDeleteModal'

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

// ── Global badge unlock watcher ──────────────────────────────────
function BadgeUnlockWatcher() {
  const { client, t, lang, dismissBadge } = useApp()
  const [unlockedBadge, setUnlockedBadge] = useState(null)
  const [levelUpInfo, setLevelUpInfo]     = useState(null)
  const prevEarnedRef  = useRef(null)
  const prevMonthlyRef = useRef(null)
  const prevLevelRef   = useRef(null)

  const currentMonthKey = useMemo(() => getCurrentMonthKey(), [])
  const earnedIds       = useMemo(() => evaluateBadges(client), [client.meals, client.weightLogs, client.workouts, client.stepsLogs])
  const monthlyEarnedIds = useMemo(() => evaluateMonthlyBadgesForMonth(client, currentMonthKey), [client, currentMonthKey])
  const totalXP         = useMemo(() => computeTotalXP(earnedIds, client), [earnedIds, client])
  const levelData       = useMemo(() => computeLevel(totalXP), [totalXP])

  // Detect new all-time badges (only AFTER initial load)
  useEffect(() => {
    if (earnedIds.length === 0) return
    if (prevEarnedRef.current === null) {
      // First load: just store current state, no celebration
      prevEarnedRef.current = earnedIds
      return
    }
    const dismissed = new Set(client.dismissedBadges || [])
    const newOnes = earnedIds.filter(id => !prevEarnedRef.current.includes(id) && !dismissed.has(id))
    if (newOnes.length > 0) {
      const badge = ALLTIME_BADGES.find(b => b.id === newOnes[0])
      if (badge) setUnlockedBadge(badge)
    }
    prevEarnedRef.current = earnedIds
  }, [earnedIds, client.dismissedBadges])

  // Detect new monthly badges (only AFTER initial load)
  useEffect(() => {
    if (monthlyEarnedIds.length === 0 && earnedIds.length === 0) return
    if (prevMonthlyRef.current === null) {
      prevMonthlyRef.current = monthlyEarnedIds
      return
    }
    const dismissed = new Set(client.dismissedBadges || [])
    const newOnes = monthlyEarnedIds.filter(id =>
      !prevMonthlyRef.current.includes(id) && !dismissed.has(`${id}:${currentMonthKey}`)
    )
    if (newOnes.length > 0) {
      const badge = MONTHLY_BADGES.find(b => b.id === newOnes[0])
      if (badge) setUnlockedBadge(badge)
    }
    prevMonthlyRef.current = monthlyEarnedIds
  }, [monthlyEarnedIds, client.dismissedBadges])

  // Detect level up
  useEffect(() => {
    const curLevel = levelData.level
    if (prevLevelRef.current !== null && curLevel > prevLevelRef.current) {
      setLevelUpInfo({ level: curLevel, name: getLevelName(curLevel, lang) })
    }
    prevLevelRef.current = curLevel
  }, [levelData.level, lang])

  // Auto-dismiss badge toast
  useEffect(() => {
    if (!unlockedBadge) return
    const timer = setTimeout(() => {
      if (unlockedBadge.monthly) {
        dismissBadge(unlockedBadge.id, currentMonthKey)
      } else {
        dismissBadge(unlockedBadge.id)
      }
      setUnlockedBadge(null)
    }, 4000)
    return () => clearTimeout(timer)
  }, [unlockedBadge])

  return (
    <>
      {unlockedBadge && (
        <BadgeUnlockedToast badge={unlockedBadge} t={t} onDismiss={() => {
          if (unlockedBadge.monthly) {
            dismissBadge(unlockedBadge.id, currentMonthKey)
          } else {
            dismissBadge(unlockedBadge.id)
          }
          setUnlockedBadge(null)
        }} />
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
    auth, view, client,
    loading, loadError, loadAll,
    snackbar, closeSnackbar,
    coachClientMode,
    t,
  } = useApp()

  const admin            = isAdmin(auth)
  const theme            = useTheme()
  const isMobile         = useMediaQuery(theme.breakpoints.down('sm'))
  const showClientDetail = (auth.role === 'coach' || auth.role === 'admin') && coachClientMode

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
                {view === 'dashboard' && <Dashboard />}
                {view === 'progress'  && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking') || hasModule(auth.modules, 'weight_tracking')) && <Progress />}
                {view === 'food'      && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking')) && <FoodTracker />}
                {view === 'weight'    && (auth.role !== 'client' || hasModule(auth.modules, 'weight_tracking'))    && <WeightTracker />}
                {view === 'ranking'   && <Ranking />}
                {view === 'tasks'     && (auth.role === 'coach' || auth.role === 'admin') && <AllClientsTasks />}
                {view === 'tasks'     && auth.role === 'client' && <Tasks />}
                {view === 'booking'   && (auth.role !== 'client' || hasModule(auth.modules, 'booking_access'))     && <Booking />}
                {view === 'schedule'  && auth.role === 'client' && hasModule(auth.modules, 'booking_access')       && <ClientSchedule />}
                {view === 'schedule'  && auth.role !== 'client' && <Schedule />}
                {view === 'steps'     && (auth.role !== 'client' || hasModule(auth.modules, 'nutrition_tracking') || hasModule(auth.modules, 'weight_tracking')) && <StepsTracker />}
                {view === 'workout'  && auth.role === 'client' && <ClientWorkout />}
                {view === 'programs'  && (auth.role !== 'client' || hasModule(auth.modules, 'program_access')) && <Programs />}
                {view === 'notifications' && auth.role === 'coach' && <Notifications />}
                {view === 'admin'     && admin && <Admin />}
              </>
            )}
          </PageTransition>
        </Box>
      </Box>

      {isMobile && <MobileNav />}

      <ConfirmDeleteModal />

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
