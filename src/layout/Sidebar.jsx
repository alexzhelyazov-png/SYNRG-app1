import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Tooltip, Button, Badge,
} from '@mui/material'
import ChevronRightIcon      from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon       from '@mui/icons-material/ChevronLeft'
import LogoutIcon            from '@mui/icons-material/Logout'
import DashboardIcon         from '@mui/icons-material/Dashboard'
import TrendingUpIcon        from '@mui/icons-material/TrendingUp'
import LeaderboardIcon       from '@mui/icons-material/Leaderboard'
import AssignmentIcon        from '@mui/icons-material/Assignment'
import PeopleIcon            from '@mui/icons-material/People'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import PersonIcon            from '@mui/icons-material/Person'
import CalendarMonthIcon     from '@mui/icons-material/CalendarMonth'
import EventIcon             from '@mui/icons-material/Event'
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline'
import SpaIcon               from '@mui/icons-material/Spa'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import MenuBookIcon           from '@mui/icons-material/MenuBook'
import { useApp }            from '../context/AppContext'
import { C, EASE }           from '../theme'
import { isAdmin }           from '../lib/bookingUtils'
import { hasModule }         from '../lib/modules'
const DRAWER_WIDTH = 272
const RAIL_WIDTH   = 72

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches
const SITE_HEADER_H = 96

// ── Nav items — adjust per role + modules ─────────────────────
function getNavItems(auth, admin) {
  // Coach/admin nav — unchanged
  if (auth.role !== 'client') {
    const coachItems = [
      { view: 'dashboard', labelKey: 'navDashboard', Icon: DashboardIcon },
      { view: 'schedule',  labelKey: 'navSchedule',  Icon: CalendarMonthIcon },
      { view: 'ranking',   labelKey: 'navRanking',   Icon: LeaderboardIcon },
      { view: 'tasks',     labelKey: 'navTasks',     Icon: AssignmentIcon },
    ]
    coachItems.push({ view: 'recipes', labelKey: 'navRecipes', Icon: MenuBookIcon })
    if (admin) coachItems.push({ view: 'admin', labelKey: 'navAdmin', Icon: AdminPanelSettingsIcon })
    return coachItems
  }
  // Client nav — module-aware, locked items always visible
  const modules = auth.modules || []
  const hasProgramAccess = hasModule(modules, 'program_access')
  const hasBookingAccess = hasModule(modules, 'booking_access')

  const items = [{ view: 'dashboard', labelKey: 'navDashboard', Icon: DashboardIcon }]
  if (hasModule(modules, 'nutrition_tracking') || hasModule(modules, 'weight_tracking'))
    items.push({ view: 'progress', labelKey: 'navProgress', Icon: TrendingUpIcon })

  // Programs: always visible — locked with indicator if no program_access
  items.push({ view: 'programs', labelKey: 'navPrograms', Icon: PlayCircleOutlineIcon, isLocked: !hasProgramAccess })

  // Schedule: always visible — locked with indicator if no booking_access
  items.push({ view: 'schedule', labelKey: 'navBookSlot', Icon: EventIcon, isLocked: !hasBookingAccess })

  // SYNRG Method: always visible — locked if no synrg_method module
  items.push({ view: 'synrg_method', labelKey: 'navSynrgMethod', Icon: SpaIcon, isLocked: !modules.includes('synrg_method') })
  return items
}

export default function Sidebar() {
  const {
    auth, view, setView, logout,
    sidebarOpen, setSidebarOpen,
    coaches, coachProfiles,
    viewingCoach, setViewingCoach,
    coachClientMode, setCoachClientMode,
    unreadNotifCount, unreadFeedCount,
    lang, setLang, t,
    client, saveWorkoutDraft,
  } = useApp()

  const admin = isAdmin(auth)

  const open    = sidebarOpen
  const navItems = getNavItems(auth, admin)

  function selectCoachTracker(coachName) {
    if (coachClientMode && client?.id) saveWorkoutDraft(client.id)
    setViewingCoach(coachName)
    setView('dashboard')
  }

  return (
    <Drawer
      variant="permanent"
      sx={{
        width:      open ? DRAWER_WIDTH : RAIL_WIDTH,
        flexShrink: 0,
        transition: `width 0.25s ${EASE.standard}`,
        '& .MuiDrawer-paper': {
          width:         open ? DRAWER_WIDTH : RAIL_WIDTH,
          transition:    `width 0.25s ${EASE.standard}`,
          overflowX:     'hidden',
          overflowY:     'hidden',
          display:       'flex',
          flexDirection: 'column',
          ...(!isStandalone && {
            top:    SITE_HEADER_H,
            height: `calc(100vh - ${SITE_HEADER_H}px)`,
          }),
        },
      }}
    >
      {/* ── Header (collapse toggle only) ────────────────── */}
      <Box sx={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: open ? 'flex-end' : 'center',
        px:             open ? 2.5 : 1,
        minHeight:      48,
        flexShrink:     0,
      }}>
        <Tooltip title={open ? t('navHide') : t('navExpand')} placement="right" arrow>
          <IconButton onClick={() => setSidebarOpen(p => !p)} size="small"
            sx={{ color: C.muted, width: 32, height: 32, '&:hover': { color: C.text } }}>
            {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Role badge ──────────────────────────────────── */}
      {open && (
        <Box sx={{
          mx: 1.5, mb: 1, px: 1.75, py: 1.25,
          background: auth.role === 'coach'
            ? 'linear-gradient(135deg, rgba(170,169,205,0.1) 0%, rgba(170,169,205,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(200,197,255,0.1) 0%, rgba(200,197,255,0.06) 100%)',
          borderRadius: '14px',
          border: `1px solid ${auth.role === 'coach' ? 'rgba(170,169,205,0.15)' : 'rgba(200,197,255,0.15)'}`,
          flexShrink: 0, animation: 'fadeIn 0.2s ease',
        }}>
          <Typography variant="overline" sx={{
            color: C.purple,
            display: 'block', lineHeight: 1, mb: 0.5,
          }}>
            {admin ? 'Admin' : auth.role === 'coach' ? t('coachRole') : t('clientRole')}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text }}>
            {auth.name}
          </Typography>
        </Box>
      )}

      {/* ── Nav items ───────────────────────────────────── */}
      <List sx={{ px: 0, py: 0.5, flexShrink: 0 }}>
        {navItems.map(({ view: v, labelKey, Icon, isLocked }) => {
          const isActive = view === v && !viewingCoach
          // Show feed badge on 'ranking' (coach) and 'progress' (client)
          const showFeedBadge = unreadFeedCount > 0 && (v === 'ranking' || v === 'progress')
          const iconColor = isActive ? C.purple : isLocked ? 'rgba(196,209,205,0.28)' : C.muted
          return (
            <Tooltip key={v} title={!open ? t(labelKey) : ''} placement="right" arrow>
              <ListItemButton
                selected={isActive}
                onClick={() => {
                  // Locked item → redirect to Programs (upgrade/buy page)
                  if (isLocked) { setView('programs'); setViewingCoach(null); setCoachClientMode(false); return }
                  if (coachClientMode && client?.id) saveWorkoutDraft(client.id)
                  setView(v); setViewingCoach(null); setCoachClientMode(false)
                }}
                sx={{
                  justifyContent: open ? 'flex-start' : 'center',
                  px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44,
                  opacity: isLocked ? 0.65 : 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: iconColor, position: 'relative' }}>
                  <Icon sx={{ fontSize: '20px' }} />
                  {/* Lock indicator */}
                  {isLocked && (
                    <Box sx={{
                      position: 'absolute', bottom: -2, right: open ? -2 : -4,
                      width: 14, height: 14, borderRadius: '4px',
                      background: '#FFB800',
                      boxShadow: '0 0 6px rgba(255,184,0,0.55)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <svg width="7" height="8" viewBox="0 0 6 8" fill="none">
                        <rect x="0.5" y="3.5" width="5" height="4" rx="1" fill="#1a1200" />
                        <path d="M1.5 3.5V2.5a1.5 1.5 0 0 1 3 0v1" stroke="#1a1200" strokeWidth="1.3" strokeLinecap="round" />
                      </svg>
                    </Box>
                  )}
                  {/* Small dot on icon when sidebar is collapsed */}
                  {showFeedBadge && !open && (
                    <Box sx={{
                      position: 'absolute', top: -1, right: -1,
                      width: 10, height: 10, borderRadius: '50%',
                      background: '#F87171',
                      boxShadow: '0 0 6px rgba(248,113,113,0.7)',
                    }} />
                  )}
                </ListItemIcon>
                {open && (
                  <Box sx={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
                    <ListItemText primary={t(labelKey)} sx={{
                      flex: 'none',
                      '& .MuiListItemText-primary': {
                        color:      isActive ? C.purple : isLocked ? 'rgba(196,209,205,0.4)' : C.text,
                        fontWeight: isActive ? 700 : 500,
                        fontSize:   '14px',
                      }
                    }} />
                    {showFeedBadge && (
                      <Box sx={{
                        ml: 1,
                        minWidth: 18, height: 18, borderRadius: '9px',
                        background: '#c4e9bf', color: '#111',
                        fontSize: '10px', fontWeight: 900,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        px: 0.5,
                      }}>
                        {unreadFeedCount > 9 ? '9+' : unreadFeedCount}
                      </Box>
                    )}
                  </Box>
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}


        {/* Notifications (coach only) — navigates to dedicated page */}
        {auth.role === 'coach' && (() => {
          const isActive = view === 'notifications'
          return (
            <Tooltip title={!open ? t('navNotifications') : ''} placement="right" arrow>
              <ListItemButton
                selected={isActive}
                onClick={() => { if (coachClientMode && client?.id) saveWorkoutDraft(client.id); setView('notifications'); setViewingCoach(null); setCoachClientMode(false) }}
                sx={{ justifyContent: open ? 'flex-start' : 'center', px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44 }}
              >
                <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: isActive ? C.purple : (unreadNotifCount > 0 ? '#F87171' : C.muted) }}>
                  <Badge badgeContent={unreadNotifCount} color="error" max={9}>
                    <NotificationsNoneIcon sx={{ fontSize: '20px' }} />
                  </Badge>
                </ListItemIcon>
                {open && <ListItemText primary={t('navNotifications')} sx={{ '& .MuiListItemText-primary': { color: isActive ? C.purple : (unreadNotifCount > 0 ? C.text : C.muted), fontWeight: isActive || unreadNotifCount > 0 ? 700 : 500, fontSize: '14px' } }} />}
              </ListItemButton>
            </Tooltip>
          )
        })()}

        {/* Lang toggle */}
        {open ? (
          <Box sx={{ mx: 1.5, my: '4px', px: 2, display: 'flex', gap: 0.5 }}>
            {['bg', 'en'].map(l => (
              <Button key={l} onClick={() => setLang(l)} size="small" sx={{
                flex: 1, py: '5px', minWidth: 0, fontSize: '11px', fontWeight: 700,
                borderRadius: '8px',
                background: lang === l ? C.accentSoft : 'transparent',
                color:      lang === l ? C.purple    : C.muted,
                border:     `1px solid ${lang === l ? C.primaryA20 : C.border}`,
                '&:hover':  { background: C.accentSoft, color: C.purple, borderColor: C.primaryA20 },
              }}>
                {l.toUpperCase()}
              </Button>
            ))}
          </Box>
        ) : (
          <Tooltip title={lang === 'bg' ? 'English' : 'Български'} placement="right" arrow>
            <ListItemButton onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
              sx={{ justifyContent: 'center', px: 0, mx: 1, my: '1px', minHeight: 36 }}>
              <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted }}>
                {lang === 'bg' ? 'EN' : 'BG'}
              </Typography>
            </ListItemButton>
          </Tooltip>
        )}

        {/* Logout */}
        <Tooltip title={!open ? t('navLogout') : ''} placement="right" arrow>
          <ListItemButton onClick={logout} sx={{
            justifyContent: open ? 'flex-start' : 'center',
            px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44,
            color: C.danger,
            '&:hover': { backgroundColor: 'rgba(255,107,157,0.08)' },
          }}>
            <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: 'inherit' }}>
              <LogoutIcon sx={{ fontSize: '18px' }} />
            </ListItemIcon>
            {open && <ListItemText primary={t('navLogout')} sx={{ '& .MuiListItemText-primary': { color: C.danger, fontWeight: 600 } }} />}
          </ListItemButton>
        </Tooltip>
      </List>

      {/* Notifications panel removed — now uses dedicated page */}

      {/* Spacer to push content up */}
      <Box sx={{ flex: 1 }} />

    </Drawer>
  )
}
