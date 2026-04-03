import {
  Box, BottomNavigation, BottomNavigationAction,
} from '@mui/material'
import DashboardIcon          from '@mui/icons-material/Dashboard'
import TrendingUpIcon         from '@mui/icons-material/TrendingUp'
import LeaderboardIcon        from '@mui/icons-material/Leaderboard'
import PlayCircleOutlineIcon  from '@mui/icons-material/PlayCircleOutline'
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import PersonIcon            from '@mui/icons-material/Person'
import AssignmentIcon         from '@mui/icons-material/Assignment'
import SpaIcon                from '@mui/icons-material/Spa'
import { useApp }             from '../context/AppContext'
import { isAdmin }            from '../lib/bookingUtils'
import { hasModule }          from '../lib/modules'
import { C, EASE }            from '../theme'

// Build role-specific nav item list (module-aware for clients)
function getNavItems(auth, admin) {
  // Coach/admin nav — unchanged
  if (auth.role !== 'client') {
    const items = [
      { view: 'dashboard', Icon: DashboardIcon,     labelKey: 'navDashboard' },
      { view: 'schedule',  Icon: CalendarMonthIcon, labelKey: 'navSchedule'  },
      { view: 'ranking',   Icon: LeaderboardIcon,   labelKey: 'navRanking'   },
      { view: 'tasks',     Icon: AssignmentIcon,    labelKey: 'navTasks'     },
    ]
    if (admin) items.push({ view: 'admin', Icon: AdminPanelSettingsIcon, labelKey: 'navAdmin' })
    return items
  }
  // Client nav — module-aware
  const modules = auth.modules || []
  const items = [{ view: 'dashboard', Icon: DashboardIcon, labelKey: 'navDashboard' }]
  if (hasModule(modules, 'nutrition_tracking') || hasModule(modules, 'weight_tracking'))
    items.push({ view: 'progress', Icon: TrendingUpIcon, labelKey: 'navProgress' })
  if (hasModule(modules, 'program_access'))       items.push({ view: 'programs', Icon: PlayCircleOutlineIcon, labelKey: 'navPrograms' })
  if (hasModule(modules, 'booking_access'))       items.push({ view: 'schedule', Icon: CalendarMonthIcon, labelKey: 'navBookSlot' })
  if (modules.includes('synrg_method'))           items.push({ view: 'synrg_method', Icon: SpaIcon, labelKey: 'navSynrgMethod' })
  return items
}

// ── Shared pill-style nav button ─────────────────────────────
function NavAction({ value, Icon, label, isSelected, onClick, badge, ...rest }) {
  return (
    <BottomNavigationAction
      value={value}
      label={label}
      onClick={onClick}
      {...rest}
      icon={
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{
            position: 'absolute', width: '48px', height: '28px', borderRadius: '14px',
            background: isSelected ? C.primaryContainer : 'transparent',
            transition: `background 0.2s ${EASE.standard}`,
          }} />
          <Box sx={{
            position: 'relative', zIndex: 1, display: 'flex',
            transform: isSelected ? 'scale(1.08)' : 'scale(1)',
            transition: `transform 0.2s ${EASE.spring}`,
          }}>
            <Icon sx={{ fontSize: '20px', color: isSelected ? C.purple : C.muted }} />
            {badge > 0 && (
              <Box sx={{
                position: 'absolute', top: -4, right: -6,
                minWidth: 16, height: 16, borderRadius: '8px',
                background: '#c4e9bf', color: '#111',
                fontSize: '9px', fontWeight: 900,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                px: 0.4, lineHeight: 1,
              }}>
                {badge > 9 ? '9+' : badge}
              </Box>
            )}
          </Box>
        </Box>
      }
      sx={{
        '& .MuiBottomNavigationAction-label': {
          fontSize: '10px !important',
          fontWeight: isSelected ? '700 !important' : '500 !important',
          color: isSelected ? `${C.purple} !important` : `${C.muted} !important`,
          opacity: '1 !important',
          transition: `color 0.2s ${EASE.standard}`,
        },
        minWidth: 0, px: 0.25,
      }}
    />
  )
}

export default function MobileNav() {
  const {
    auth, view, setView, t,
    setShowClientMenu,
    viewingCoach, setViewingCoach,
    coachClientMode, setCoachClientMode,
    client, saveWorkoutDraft,
    unreadFeedCount,
  } = useApp()

  const admin = isAdmin(auth)
  const navItems = getNavItems(auth, admin)

  return (
    <>
      {/* ── NavigationBar ────────────────────────────── */}
      <Box sx={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
        background: C.sidebar, borderTop: `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <BottomNavigation
          value={view}
          showLabels
          onChange={(_, newView) => {
            if (newView === '__clients__' || newView === '__tracker__') return
            if (coachClientMode && client?.id) saveWorkoutDraft(client.id)
            setView(newView)
            setShowClientMenu(false)
            setViewingCoach(null)
            setCoachClientMode(false)
          }}
          sx={{ height: '64px', background: 'transparent', borderTop: 'none' }}
        >
          {/* Role-specific nav items */}
          {navItems.map(({ view: v, Icon, labelKey }) => {
            const showBadge = unreadFeedCount > 0 && (v === 'progress' || v === 'ranking')
            return (
              <NavAction
                key={v}
                value={v}
                Icon={Icon}
                label={t(labelKey)}
                isSelected={view === v && !viewingCoach}
                badge={showBadge ? unreadFeedCount : 0}
              />
            )
          })}


        </BottomNavigation>
      </Box>


    </>
  )
}
