import { useState, useMemo } from 'react'
import { Box, CircularProgress, Typography, Button, Alert, Snackbar, useMediaQuery } from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { ThemeProvider, useTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { AppProvider, useApp } from './context/AppContext'
import { BookingProvider }     from './context/BookingContext'
import { C, EASE, makeTheme }  from './theme'
import { isAdmin }             from './lib/bookingUtils'

import InstallScreen  from './layout/InstallScreen'
import Sidebar        from './layout/Sidebar'
import MobileHeader   from './layout/MobileHeader'
import MobileNav      from './layout/MobileNav'

import Auth           from './pages/Auth'
import Dashboard, { ClientDetail } from './pages/Dashboard'
import FoodTracker    from './pages/FoodTracker'
import WeightTracker  from './pages/WeightTracker'
import Ranking        from './pages/Ranking'
import Tasks, { AllClientsTasks } from './pages/Tasks'
import Booking        from './pages/Booking'
import Schedule       from './pages/Schedule'
import Admin          from './pages/Admin'

import ConfirmDeleteModal from './components/ConfirmDeleteModal'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

function LoadingScreen({ t }) {
  return (
    <Box sx={{
      minHeight:      '100vh',
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
      minHeight:      '100vh',
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
  const showClientDetail = auth.role === 'coach' && coachClientMode

  if (loading)      return <LoadingScreen t={t} />
  if (loadError)    return <ErrorScreen error={loadError} onRetry={() => loadAll()} t={t} />
  if (!auth.isLoggedIn) return <Auth />

  return (
    <Box sx={{
      display:   'flex',
      minHeight: '100vh',
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
                {view === 'food'      && <FoodTracker />}
                {view === 'weight'    && <WeightTracker />}
                {view === 'ranking'   && <Ranking />}
                {view === 'tasks'     && auth.role === 'coach' && <AllClientsTasks />}
                {view === 'tasks'     && auth.role !== 'coach' && <Tasks />}
                {view === 'booking'   && <Booking />}
                {view === 'schedule'  && <Schedule />}
                {view === 'admin'     && admin && <Admin />}
              </>
            )}
          </PageTransition>
        </Box>
      </Box>

      {isMobile && <MobileNav />}

      <ConfirmDeleteModal />

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
  const [installDone, setInstallDone] = useState(isStandalone)

  if (!installDone) {
    return <InstallScreen onSkip={() => setInstallDone(true)} />
  }

  return <AppShell />
}

function ThemedWrapper({ children }) {
  const { isDark } = useApp()
  const muiTheme = useMemo(() => makeTheme(isDark), [isDark])
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
