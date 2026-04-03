import {
  Box, BottomNavigation, BottomNavigationAction,
} from '@mui/material'
import DashboardIcon          from '@mui/icons-material/Dashboard'
import TrendingUpIcon         from '@mui/icons-material/TrendingUp'
import LeaderboardIcon        from '@mui/icons-material/Leaderboard'
import PlayCircleOutlineIcon  from '@mui/icons-material/PlayCircleOutline'
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import MenuBookIcon           from '@mui/icons-material/MenuBook'
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
      { view: 'recipes',   Icon: MenuBookIcon,      labelKey: 'navRecipes'   },
    ]
    if (admin) items.push({ view: 'admin', Icon: AdminPanelSettingsIcon, labelKey: 'navAdmin' })
    return items
  }
  // Client nav — module-aware, locked items always visible
  const modules = auth.modules || []
  const hasProgramAccess = hasModule(modules, 'program_access')
  const hasBookingAccess = hasModule(modules, 'booking_access')

  const items = [{ view: 'dashboard', Icon: DashboardIcon, labelKey: 'navDashboard' }]
  if (hasModule(modules, 'nutrition_tracking') || hasModule(modules, 'weight_tracking'))
    items.push({ view: 'progress', Icon: TrendingUpIcon, labelKey: 'navProgress' })

  // Programs: always visible — locked with indicator if no program_access
  items.push({ view: 'programs', Icon: PlayCircleOutlineIcon, labelKey: 'navPrograms', isLocked: !hasProgramAccess })

  // Schedule: always visible — locked with indicator if no booking_access
  items.push({ view: 'schedule', Icon: CalendarMonthIcon, labelKey: 'navBookSlot', isLocked: !hasBookingAccess })

  // SYNRG Method: always visible — locked if no synrg_method module
  items.push({ view: 'synrg_method', Icon: SpaIcon, labelKey: 'navSynrgMethod', isLocked: !modules.includes('synrg_method') })
  return items
}

// ── Lock icon SVG ─────────────────────────────────────
function LockBadge() {
  return (
    <Box sx={{
      position: 'absolute', bottom: -3, right: -5,
      width: 12, height: 12, borderRadius: '4px',
      background: 'rgba(20,24,22,0.95)',
      border: '1px solid rgba(255,255,255,0.08)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="6" height="7" viewBox="0 0 6 8" fill="none">
        <rect x="0.5" y="3.5" width="5" height="4" rx="1" fill="rgba(196,209,205,0.45)" />
        <path d="M1.5 3.5V2.5a1.5 1.5 0 0 1 3 0v1" stroke="rgba(196,209,205,0.45)" strokeWidth="1.1" strokeLinecap="round" />
      </svg>
    </Box>
  )
}

// ── Shared pill-style nav button ─────────────────────────────
function NavAction({ value, Icon, label, isSelected, onClick, badge, isLocked, ...rest }) {
  const iconColor = isSelected ? C.purple : isLocked ? 'rgba(196,209,205,0.3)' : C.muted
  const labelColor = isSelected ? C.purple : isLocked ? 'rgba(196,209,205,0.3)' : C.muted

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
            <Icon sx={{ fontSize: '20px', color: iconColor }} />
            {isLocked && <LockBadge />}
            {badge > 0 && !isLocked && (
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
          color: `${labelColor} !important`,
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
            // Locked item → redirect to Programs (upgrade/buy page)
            const item = navItems.find(n => n.view === newView)
            if (item?.isLocked) {
              setView('programs')
              setShowClientMenu(false)
              setViewingCoach(null)
              setCoachClientMode(false)
              return
            }
            if (coachClientMode && client?.id) saveWorkoutDraft(client.id)
            setView(newView)
            setShowClientMenu(false)
            setViewingCoach(null)
            setCoachClientMode(false)
          }}
          sx={{ height: '64px', background: 'transparent', borderTop: 'none' }}
        >
          {/* Role-specific nav items */}
          {navItems.map(({ view: v, Icon, labelKey, isLocked }) => {
            const showBadge = unreadFeedCount > 0 && (v === 'progress' || v === 'ranking')
            return (
              <NavAction
                key={v}
                value={v}
                Icon={Icon}
                label={t(labelKey)}
                isSelected={view === v && !viewingCoach}
                badge={showBadge ? unreadFeedCount : 0}
                isLocked={!!isLocked}
              />
            )
          })}


        </BottomNavigation>
      </Box>


    </>
  )
}
