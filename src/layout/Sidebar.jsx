import { useState } from 'react'
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Divider, Tooltip, Button, Badge, Collapse,
} from '@mui/material'
import ChevronRightIcon      from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon       from '@mui/icons-material/ChevronLeft'
import DeleteOutlineIcon     from '@mui/icons-material/DeleteOutline'
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
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
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
    if (admin) coachItems.push({ view: 'admin', labelKey: 'navAdmin', Icon: AdminPanelSettingsIcon })
    return coachItems
  }
  // Client nav — module-aware
  const modules = auth.modules || []
  const items = [{ view: 'dashboard', labelKey: 'navDashboard', Icon: DashboardIcon }]
  if (hasModule(modules, 'nutrition_tracking') || hasModule(modules, 'weight_tracking'))
    items.push({ view: 'progress', labelKey: 'navProgress', Icon: TrendingUpIcon })
  if (hasModule(modules, 'weight_tracking') || hasModule(modules, 'nutrition_tracking'))
    items.push({ view: 'ranking', labelKey: 'navRanking', Icon: LeaderboardIcon })
  if (hasModule(modules, 'program_access'))       items.push({ view: 'programs', labelKey: 'navPrograms', Icon: PlayCircleOutlineIcon })
  if (hasModule(modules, 'booking_access'))      items.push({ view: 'schedule', labelKey: 'navBookSlot', Icon: EventIcon })
  if (modules.length > 0)                        items.push({ view: 'tasks', labelKey: 'navTasks', Icon: AssignmentIcon })
  return items
}

export default function Sidebar() {
  const {
    auth, view, setView, logout,
    clients, realClients, visibleClients, actualIdx, setSelIdx, setCurrentWorkout,
    sidebarOpen, setSidebarOpen,
    setConfirmDelete,
    coaches, coachProfiles,
    viewingCoach, setViewingCoach,
    coachClientMode, setCoachClientMode,
    notifications, unreadNotifCount,
    lang, setLang, t,
  } = useApp()

  const admin = isAdmin(auth)

  const [recentIds,  setRecentIds]  = useState([])
  const [showNotifs, setShowNotifs] = useState(false)

  const open    = sidebarOpen
  const navItems = getNavItems(auth, admin)

  function selectClient(ri, clientId) {
    setRecentIds(prev => [clientId, ...prev.filter(id => id !== clientId)])
    setSelIdx(ri)
    setCurrentWorkout([])
    setViewingCoach(null)
    setCoachClientMode(true)
  }

  function selectCoachTracker(coachName) {
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
            ? 'linear-gradient(135deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(200,197,255,0.1) 0%, rgba(200,197,255,0.06) 100%)',
          borderRadius: '14px',
          border: `1px solid ${auth.role === 'coach' ? 'rgba(196,233,191,0.15)' : 'rgba(200,197,255,0.15)'}`,
          flexShrink: 0, animation: 'fadeIn 0.2s ease',
        }}>
          <Typography variant="overline" sx={{
            color: auth.role === 'coach' ? C.primary : C.purple,
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
        {navItems.map(({ view: v, labelKey, Icon }) => {
          const isActive = view === v && !viewingCoach
          return (
            <Tooltip key={v} title={!open ? t(labelKey) : ''} placement="right" arrow>
              <ListItemButton
                selected={isActive}
                onClick={() => { setView(v); setViewingCoach(null); setCoachClientMode(false) }}
                sx={{
                  justifyContent: open ? 'flex-start' : 'center',
                  px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44,
                }}
              >
                <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: isActive ? C.primary : C.muted }}>
                  <Icon sx={{ fontSize: '20px' }} />
                </ListItemIcon>
                {open && (
                  <ListItemText primary={t(labelKey)} sx={{
                    '& .MuiListItemText-primary': {
                      color:      isActive ? C.primary : C.text,
                      fontWeight: isActive ? 700 : 500,
                      fontSize:   '14px',
                    }
                  }} />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })}

        {/* Моят тракер (coach + admin) */}
        {(auth.role === 'coach' || auth.role === 'admin') && (() => {
          const isTrackerActive = view === 'dashboard' && viewingCoach === auth.name
          return (
            <Tooltip title={!open ? t('myTrackerTitle') : ''} placement="right" arrow>
              <ListItemButton
                selected={isTrackerActive}
                onClick={() => selectCoachTracker(auth.name)}
                sx={{
                  justifyContent: open ? 'flex-start' : 'center',
                  px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44,
                }}
              >
                <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: isTrackerActive ? C.primary : C.muted }}>
                  <PersonIcon sx={{ fontSize: '20px' }} />
                </ListItemIcon>
                {open && (
                  <ListItemText primary={t('myTrackerTitle')} sx={{
                    '& .MuiListItemText-primary': {
                      color:      isTrackerActive ? C.primary : C.text,
                      fontWeight: isTrackerActive ? 700 : 500,
                      fontSize:   '14px',
                    }
                  }} />
                )}
              </ListItemButton>
            </Tooltip>
          )
        })()}

        {/* Notifications (coach only) */}
        {auth.role === 'coach' && (
          <Tooltip title={!open ? t('navNotifications') : ''} placement="right" arrow>
            <ListItemButton
              onClick={() => setShowNotifs(p => !p)}
              sx={{ justifyContent: open ? 'flex-start' : 'center', px: open ? 2 : 0, mx: open ? 1.5 : 1, my: '2px', minHeight: 44 }}
            >
              <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center', color: unreadNotifCount > 0 ? C.primary : C.muted }}>
                <Badge badgeContent={unreadNotifCount} color="error" max={9}>
                  <NotificationsNoneIcon sx={{ fontSize: '20px' }} />
                </Badge>
              </ListItemIcon>
              {open && <ListItemText primary={t('navNotifications')} sx={{ '& .MuiListItemText-primary': { color: unreadNotifCount > 0 ? C.primary : C.text, fontWeight: unreadNotifCount > 0 ? 700 : 500, fontSize: '14px' } }} />}
            </ListItemButton>
          </Tooltip>
        )}

        {/* Lang + Theme */}
        {open ? (
          <Box sx={{ mx: 1.5, my: '4px', px: 2, display: 'flex', gap: 0.5 }}>
            {['bg', 'en'].map(l => (
              <Button key={l} onClick={() => setLang(l)} size="small" sx={{
                flex: 1, py: '5px', minWidth: 0, fontSize: '11px', fontWeight: 700,
                borderRadius: '8px',
                background: lang === l ? C.accentSoft : 'transparent',
                color:      lang === l ? C.primary    : C.muted,
                border:     `1px solid ${lang === l ? C.primaryA20 : C.border}`,
                '&:hover':  { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
              }}>
                {l.toUpperCase()}
              </Button>
            ))}
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Tooltip title={lang === 'bg' ? 'English' : 'Български'} placement="right" arrow>
              <ListItemButton onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
                sx={{ justifyContent: 'center', px: 0, mx: 1, my: '1px', minHeight: 36 }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted }}>
                  {lang === 'bg' ? 'EN' : 'BG'}
                </Typography>
              </ListItemButton>
            </Tooltip>
          </Box>
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

      {/* ── Notifications panel (coach only) ────────────── */}
      {open && auth.role === 'coach' && showNotifs && (
        <Box sx={{ mx: 1.5, mb: 1, maxHeight: '200px', overflowY: 'auto', flexShrink: 0 }}>
          <Divider sx={{ borderColor: C.border, mb: 1 }} />
          {notifications.length === 0 ? (
            <Typography sx={{ color: C.muted, fontSize: '12px', px: 1, pb: 1 }}>{t('noNotifications')}</Typography>
          ) : notifications.slice(0, 10).map((n, i) => (
            <Box key={n.id || i} sx={{
              px: 1.5, py: 0.75, mb: 0.5,
              background: n.from_coach !== auth.name ? C.accentSoft : 'rgba(255,255,255,0.03)',
              borderRadius: '10px', border: `1px solid ${n.from_coach !== auth.name ? C.primaryA20 : C.border}`,
            }}>
              <Typography sx={{ fontSize: '11.5px', fontWeight: 700, color: n.from_coach !== auth.name ? C.primary : C.muted }}>
                {n.from_coach}
                <Box component="span" sx={{ fontWeight: 400, color: C.muted, ml: 0.5 }}>→ {n.client_name}</Box>
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.text, mt: 0.25 }}>
                {n.action_type === 'task' && `${t('taskNotifLbl')}: `}
                {n.action_type === 'reaction' && `${t('reactionNotifLbl')}: `}
                {n.action_type === 'registration' && `${t('registrationNotifLbl')}: `}
                {n.content}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* ── CLIENTS section (coach only) — NOW ABOVE COACHES ── */}
      {open && auth.role === 'coach' && (
        <>
          <Divider sx={{ mx: 2, borderColor: C.border, mt: 0.5, mb: 1, flexShrink: 0 }} />
          <Typography variant="overline" sx={{ px: 2.5, color: C.muted, flexShrink: 0, mb: 0.5 }}>
            {t('clientsHeader')}
          </Typography>

          <Box sx={{ overflowY: 'auto', flex: 1, pb: 1 }}>
            {[...visibleClients]
              .sort((a, b) => {
                const ai = recentIds.indexOf(a.id), bi = recentIds.indexOf(b.id)
                if (ai === -1 && bi === -1) return 0
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })
              .map(c => {
                const ri    = realClients.findIndex(x => x.name === c.name)
                const isSel = !viewingCoach && actualIdx === ri
                return (
                  <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', mx: 1.5, mb: '2px' }}>
                    <ListItemButton
                      selected={isSel}
                      onClick={() => selectClient(ri, c.id)}
                      sx={{ flex: 1, flexDirection: 'column', alignItems: 'flex-start', py: 0.9, gap: 0 }}
                    >
                      <Typography sx={{
                        fontWeight: 600, fontSize: '13.5px', lineHeight: 1.35,
                        color: isSel ? C.primary : C.text,
                      }}>
                        {c.name}
                      </Typography>
                      <Typography variant="caption" sx={{ color: isSel ? 'rgba(196,233,191,0.65)' : C.muted }}>
                        {c.calorieTarget} kcal · {c.proteinTarget}{t('gUnit')}
                      </Typography>
                    </ListItemButton>
                    <Tooltip title={t('deleteClientTip')} arrow>
                      <IconButton
                        onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                        size="small"
                        sx={{
                          flexShrink: 0, color: 'transparent', width: 26, height: 26,
                          '&:hover': { color: C.danger, bgcolor: 'rgba(255,107,157,0.1)' },
                          '.MuiBox-root:hover &': { color: C.muted },
                        }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 15 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                )
              })}
          </Box>
        </>
      )}

    </Drawer>
  )
}
