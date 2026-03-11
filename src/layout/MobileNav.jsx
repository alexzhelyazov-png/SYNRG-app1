import { useState, useMemo } from 'react'
import {
  Box, BottomNavigation, BottomNavigationAction,
  Typography, IconButton, Badge,
} from '@mui/material'
import DashboardIcon          from '@mui/icons-material/Dashboard'
import RestaurantIcon         from '@mui/icons-material/Restaurant'
import MonitorWeightIcon      from '@mui/icons-material/MonitorWeight'
import LeaderboardIcon        from '@mui/icons-material/Leaderboard'
import EventIcon              from '@mui/icons-material/Event'
import CalendarMonthIcon      from '@mui/icons-material/CalendarMonth'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import GroupIcon              from '@mui/icons-material/Group'
import PersonIcon            from '@mui/icons-material/Person'
import AssignmentIcon         from '@mui/icons-material/Assignment'
import DeleteOutlineIcon      from '@mui/icons-material/DeleteOutline'
import { useApp }             from '../context/AppContext'
import { isAdmin }            from '../lib/bookingUtils'
import { C, EASE }            from '../theme'

// Base nav items shared by all roles
const BASE_NAV = [
  { view: 'dashboard', Icon: DashboardIcon,     labelKey: 'navDashboard' },
  { view: 'food',      Icon: RestaurantIcon,    labelKey: 'navFood'      },
  { view: 'weight',    Icon: MonitorWeightIcon, labelKey: 'navWeight'    },
  { view: 'ranking',   Icon: LeaderboardIcon,   labelKey: 'navRanking'   },
]

// Build role-specific nav item list
function getNavItems(auth, admin) {
  if (auth.role === 'client') {
    return [
      ...BASE_NAV,
      { view: 'booking', Icon: EventIcon, labelKey: 'navBooking' },
    ]
  }
  // Coach / Admin — dashboard, schedule, tasks [, admin]
  const items = [
    { view: 'dashboard', Icon: DashboardIcon,     labelKey: 'navDashboard' },
    { view: 'schedule',  Icon: CalendarMonthIcon, labelKey: 'navSchedule'  },
    { view: 'tasks',     Icon: AssignmentIcon,    labelKey: 'navTasks'     },
  ]
  if (admin) {
    items.push({ view: 'admin', Icon: AdminPanelSettingsIcon, labelKey: 'navAdmin' })
  }
  return items
}

// ── Shared pill-style nav button ─────────────────────────────
function NavAction({ value, Icon, label, isSelected, onClick, ...rest }) {
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
            <Icon sx={{ fontSize: '20px', color: isSelected ? C.primary : C.muted }} />
          </Box>
        </Box>
      }
      sx={{
        '& .MuiBottomNavigationAction-label': {
          fontSize: '10px !important',
          fontWeight: isSelected ? '700 !important' : '500 !important',
          color: isSelected ? `${C.primary} !important` : `${C.muted} !important`,
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
    auth, view, setView,
    showClientMenu, setShowClientMenu,
    clients, visibleClients, realClients, actualIdx, setSelIdx, setCurrentWorkout,
    client, t, setConfirmDelete,
    viewingCoach, setViewingCoach,
    coachClientMode, setCoachClientMode,
    unreadNotifCount, notifications,
  } = useApp()

  const admin = isAdmin(auth)
  const navItems = getNavItems(auth, admin)

  // Selected client always at top of list
  const sortedClients = useMemo(() => {
    const sel = realClients[actualIdx]
    if (!sel) return visibleClients
    return [sel, ...visibleClients.filter(c => c.name !== sel.name)]
  }, [visibleClients, actualIdx, realClients])

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
            setView(newView)
            setShowClientMenu(false)
            setViewingCoach(null)
            setCoachClientMode(false)
          }}
          sx={{ height: '64px', background: 'transparent', borderTop: 'none' }}
        >
          {/* Role-specific nav items */}
          {navItems.map(({ view: v, Icon, labelKey }) => (
            <NavAction
              key={v}
              value={v}
              Icon={Icon}
              label={t(labelKey)}
              isSelected={view === v && !viewingCoach}
            />
          ))}

          {/* Моят тракер (coach only) */}
          {auth.role === 'coach' && (
            <NavAction
              value="__tracker__"
              Icon={PersonIcon}
              label={t('myTrackerTitle')}
              isSelected={view === 'dashboard' && viewingCoach === auth.name}
              onClick={() => {
                setViewingCoach(auth.name)
                setView('dashboard')
                setShowClientMenu(false)
              }}
            />
          )}

          {/* Clients sheet — all coaches (including admins) */}
          {auth.role === 'coach' && (
            <BottomNavigationAction
              value="__clients__"
              onClick={e => {
                e.stopPropagation()
                setShowClientMenu(p => !p)
              }}
              label={!viewingCoach ? (client?.name || t('navClients')) : t('navClients')}
              icon={
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{
                    position: 'absolute', width: '48px', height: '28px', borderRadius: '14px',
                    background: showClientMenu ? C.primaryContainer : 'transparent',
                    transition: `background 0.2s ${EASE.standard}`,
                  }} />
                  <Badge badgeContent={unreadNotifCount} color="error" max={9}
                    sx={{ '& .MuiBadge-badge': { fontSize: '9px', minWidth: '16px', height: '16px' } }}>
                    <Box sx={{
                      position: 'relative', zIndex: 1, display: 'flex',
                      transform: showClientMenu ? 'scale(1.08)' : 'scale(1)',
                      transition: `transform 0.2s ${EASE.spring}`,
                    }}>
                      <GroupIcon sx={{ fontSize: '20px', color: showClientMenu ? C.primary : C.muted }} />
                    </Box>
                  </Badge>
                </Box>
              }
              sx={{
                minWidth: 0, px: 0.25,
                '& .MuiBottomNavigationAction-label': {
                  fontSize: '10px !important', fontWeight: '700 !important',
                  color: showClientMenu ? `${C.primary} !important` : `${C.muted} !important`,
                  opacity: '1 !important', maxWidth: '60px',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                },
              }}
            />
          )}
        </BottomNavigation>
      </Box>


      {/* ── Client selector — bottom sheet ───────────── */}
      {showClientMenu && auth.role === 'coach' && (
        <Box sx={{
          position: 'fixed', bottom: '64px', left: 0, right: 0,
          maxHeight: '65vh', background: C.sidebar,
          borderTop: `1px solid ${C.border}`, borderRadius: '24px 24px 0 0',
          zIndex: 49, overflowY: 'auto', p: '16px 16px 24px',
          animation: 'fadeInUp 0.22s ease both',
        }}>
          <Box onClick={() => setShowClientMenu(false)} sx={{ position: 'fixed', inset: 0, zIndex: -1 }} />
          <Box sx={{ width: 36, height: 4, borderRadius: '2px', background: 'rgba(255,255,255,0.18)', mx: 'auto', mb: 2 }} />

          {/* Notifications in client menu header */}
          {unreadNotifCount > 0 && (
            <Box sx={{ mb: 1.5, p: 1.25, background: C.accentSoft, borderRadius: '12px', border: `1px solid ${C.primaryA20}` }}>
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.primary, mb: 0.5 }}>
                {unreadNotifCount} {t('newNotifications')}
              </Typography>
              {notifications.filter(n => n.from_coach !== auth.name).slice(0, 3).map((n, i) => (
                <Typography key={i} sx={{ fontSize: '11px', color: C.text }}>
                  {n.from_coach} → {n.client_name}: {n.content}
                </Typography>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
            <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>{t('selectClient')}</Typography>
            <Typography variant="caption" sx={{ color: C.muted }}>{visibleClients.length} {t('ofClients')}</Typography>
          </Box>

          {sortedClients.map((c, i) => {
            const ri    = clients.findIndex(x => x.name === c.name)
            const isSel = !viewingCoach && actualIdx === ri
            return (
              <Box component="div" key={c.name} onClick={() => {
                setSelIdx(ri)
                setCurrentWorkout([])
                setShowClientMenu(false)
                setViewingCoach(null)
                setView('dashboard')
                setCoachClientMode(true)
              }} sx={{
                width: '100%', textAlign: 'left',
                background: isSel
                  ? 'linear-gradient(135deg, rgba(196,233,191,0.14) 0%, rgba(196,233,191,0.08) 100%)'
                  : 'rgba(255,255,255,0.04)',
                color: isSel ? C.primary : C.text,
                border: `1px solid ${isSel ? 'rgba(196,233,191,0.3)' : 'rgba(255,255,255,0.06)'}`,
                borderRadius: '14px', px: 1.75, py: 1.4, cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif", mb: 0.75,
                display: 'flex', alignItems: 'center', gap: '12px',
                animation: `slideInLeft 0.2s ${EASE.standard} both`,
                animationDelay: `${i * 0.05}s`,
              }}>
                <Box sx={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: isSel ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '15px', fontWeight: 800, color: isSel ? C.primary : C.muted, flexShrink: 0,
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ fontWeight: 700, fontSize: '14.5px', lineHeight: 1.3, color: isSel ? C.primary : C.text }}>
                    {c.name}
                    {isSel && (
                      <Box component="span" sx={{
                        ml: 1, fontSize: '10px', background: C.primaryContainer, color: C.primary,
                        px: 0.75, py: '2px', borderRadius: '99px', fontWeight: 700, verticalAlign: 'middle',
                      }}>
                        {t('activeLabel')}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ fontSize: '12px', color: C.muted, mt: 0.2 }}>
                    {c.calorieTarget} kcal · {c.proteinTarget}{t('gUnit')} {t('proteinShortLbl')}
                  </Box>
                </Box>
                {isSel && <Box sx={{ fontSize: '16px', flexShrink: 0, color: C.primary }}>✓</Box>}
                <IconButton size="small" onClick={e => {
                  e.stopPropagation()
                  setShowClientMenu(false)
                  setConfirmDelete({ id: c.id, name: c.name })
                }} sx={{ flexShrink: 0, color: C.muted, '&:hover': { color: C.danger, bgcolor: 'rgba(255,107,157,0.1)' } }}>
                  <DeleteOutlineIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            )
          })}
        </Box>
      )}
    </>
  )
}
