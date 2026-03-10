import { useState } from 'react'
import {
  Drawer, Box, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, IconButton, Divider, Tooltip, Button,
} from '@mui/material'
import ChevronRightIcon  from '@mui/icons-material/ChevronRight'
import ChevronLeftIcon   from '@mui/icons-material/ChevronLeft'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import LogoutIcon        from '@mui/icons-material/Logout'
import { useApp } from '../context/AppContext'
import { NAV_ITEMS } from '../lib/constants'
import { C, EASE } from '../theme'
import SynrgLogo from './SynrgLogo'

const DRAWER_WIDTH = 272
const RAIL_WIDTH   = 72

export default function Sidebar() {
  const {
    auth, view, setView, logout,
    clients, visibleClients, actualIdx, setSelIdx, setCurrentWorkout,
    sidebarOpen, setSidebarOpen,
    setConfirmDelete,
    lang, setLang, t,
    isDark, setIsDark,
  } = useApp()

  const [recentIds, setRecentIds] = useState([])

  const open = sidebarOpen

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
        },
      }}
    >
      {/* ── Header: logo + toggle ────────────────────── */}
      <Box sx={{
        display:        'flex',
        alignItems:     'center',
        justifyContent: open ? 'space-between' : 'center',
        px:             open ? 2.5 : 1,
        minHeight:      64,
        flexShrink:     0,
      }}>
        {open && (
          <Box sx={{ animation: 'fadeIn 0.2s ease', opacity: 1 }}>
            <SynrgLogo width={96} />
          </Box>
        )}
        <Tooltip title={open ? t('navHide') : t('navExpand')} placement="right" arrow>
          <IconButton
            onClick={() => setSidebarOpen(p => !p)}
            size="small"
            sx={{
              color:     C.muted,
              width:     32, height: 32,
              '&:hover': { color: C.text },
            }}
          >
            {open ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {/* ── Role badge ──────────────────────────────── */}
      {open && (
        <Box sx={{
          mx:           1.5,
          mb:           1,
          px:           1.75,
          py:           1.25,
          background:   auth.role === 'coach'
            ? 'linear-gradient(135deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.06) 100%)'
            : 'linear-gradient(135deg, rgba(200,197,255,0.1) 0%, rgba(200,197,255,0.06) 100%)',
          borderRadius: '14px',
          border:       `1px solid ${auth.role === 'coach' ? 'rgba(196,233,191,0.15)' : 'rgba(200,197,255,0.15)'}`,
          flexShrink:   0,
          animation:    'fadeIn 0.2s ease',
        }}>
          <Typography variant="overline" sx={{
            color:      auth.role === 'coach' ? C.primary : C.purple,
            display:    'block',
            lineHeight: 1,
            mb:         0.5,
          }}>
            {auth.role === 'coach' ? t('coachRole') : t('clientRole')}
          </Typography>
          <Typography sx={{ fontWeight: 700, fontSize: '14px', color: C.text, letterSpacing: '-0.1px' }}>
            {auth.name}
          </Typography>
        </Box>
      )}

      {/* ── Nav items ───────────────────────────────── */}
      <List sx={{ px: 0, py: 0.5, flexShrink: 0 }}>
        {NAV_ITEMS.map(({ view: v, icon, labelKey }) => (
          <Tooltip key={v} title={!open ? t(labelKey) : ''} placement="right" arrow>
            <ListItemButton
              selected={view === v}
              onClick={() => setView(v)}
              sx={{
                justifyContent: open ? 'flex-start' : 'center',
                px:             open ? 2 : 0,
                mx:             open ? 1.5 : 1,
                my:             '2px',
                minHeight:      48,
              }}
            >
              <ListItemIcon sx={{
                minWidth:       open ? 38 : 'unset',
                justifyContent: 'center',
                fontSize:       '18px',
                transition:     `transform 0.15s ${EASE.spring}`,
                ...(view === v && { transform: 'scale(1.08)' }),
              }}>
                <span>{icon}</span>
              </ListItemIcon>
              {open && (
                <ListItemText
                  primary={t(labelKey)}
                  sx={{ '& .MuiListItemText-primary': {
                    color:      view === v ? C.primary : C.text,
                    fontWeight: view === v ? 700 : 500,
                    transition: `color 0.15s ${EASE.standard}`,
                  }}}
                />
              )}
            </ListItemButton>
          </Tooltip>
        ))}

        {/* Language + theme toggles */}
        {open ? (
          <Box sx={{ mx: 1.5, my: '4px', px: 2, display: 'flex', gap: 0.5 }}>
            {['bg', 'en'].map(l => (
              <Button
                key={l}
                onClick={() => setLang(l)}
                size="small"
                sx={{
                  flex:         1,
                  py:           '5px',
                  minWidth:     0,
                  fontSize:     '11px',
                  fontWeight:   700,
                  letterSpacing:'0.5px',
                  borderRadius: '8px',
                  background:   lang === l ? C.accentSoft : 'transparent',
                  color:        lang === l ? C.primary : C.muted,
                  border:       `1px solid ${lang === l ? C.primaryA20 : C.border}`,
                  transition:   `all 0.18s ${EASE.standard}`,
                  '&:hover':    { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
                }}
              >
                {l.toUpperCase()}
              </Button>
            ))}
            <Tooltip title={isDark ? t('lightMode') : t('darkMode')} placement="right" arrow>
              <Button
                onClick={() => setIsDark(!isDark)}
                size="small"
                sx={{
                  minWidth:     '36px',
                  px:           0,
                  py:           '5px',
                  fontSize:     '14px',
                  borderRadius: '8px',
                  background:   'transparent',
                  color:        C.muted,
                  border:       `1px solid ${C.border}`,
                  transition:   `all 0.18s ${EASE.standard}`,
                  '&:hover':    { background: C.accentSoft, color: C.primary, borderColor: C.primaryA20 },
                }}
              >
                {isDark ? '☀️' : '🌙'}
              </Button>
            </Tooltip>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <Tooltip title={lang === 'bg' ? 'English' : 'Български'} placement="right" arrow>
              <ListItemButton
                onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
                sx={{ justifyContent: 'center', px: 0, mx: 1, my: '1px', minHeight: 36 }}
              >
                <Typography sx={{ fontSize: '10px', fontWeight: 700, color: C.muted }}>
                  {lang === 'bg' ? 'EN' : 'BG'}
                </Typography>
              </ListItemButton>
            </Tooltip>
            <Tooltip title={isDark ? t('lightMode') : t('darkMode')} placement="right" arrow>
              <ListItemButton
                onClick={() => setIsDark(!isDark)}
                sx={{ justifyContent: 'center', px: 0, mx: 1, my: '1px', minHeight: 36 }}
              >
                <Typography sx={{ fontSize: '14px' }}>{isDark ? '☀️' : '🌙'}</Typography>
              </ListItemButton>
            </Tooltip>
          </Box>
        )}

        {/* Tasks (coach + client) */}
        <Tooltip title={!open ? t('navTasks') : ''} placement="right" arrow>
          <ListItemButton
            selected={view === 'tasks'}
            onClick={() => setView('tasks')}
            sx={{
              justifyContent: open ? 'flex-start' : 'center',
              px:             open ? 2 : 0,
              mx:             open ? 1.5 : 1,
              my:             '2px',
              minHeight:      48,
              borderRadius:   '28px',
            }}
          >
            <ListItemIcon sx={{ minWidth: open ? 38 : 'unset', justifyContent: 'center' }}>
              <Typography sx={{ fontSize: '18px' }}>📋</Typography>
            </ListItemIcon>
            {open && <ListItemText primary={t('navTasks')} />}
          </ListItemButton>
        </Tooltip>

        {/* Logout */}
        <Tooltip title={!open ? t('navLogout') : ''} placement="right" arrow>
          <ListItemButton
            onClick={logout}
            sx={{
              justifyContent:  open ? 'flex-start' : 'center',
              px:              open ? 2 : 0,
              mx:              open ? 1.5 : 1,
              my:              '2px',
              minHeight:       48,
              color:           C.danger,
              borderRadius:    '28px',
              '&:hover':       { backgroundColor: 'rgba(255,107,157,0.08)', transform: 'translateX(2px)' },
            }}
          >
            <ListItemIcon sx={{
              minWidth:       open ? 38 : 'unset',
              justifyContent: 'center',
              color:          'inherit',
            }}>
              <LogoutIcon sx={{ fontSize: '18px' }} />
            </ListItemIcon>
            {open && (
              <ListItemText
                primary={t('navLogout')}
                sx={{ '& .MuiListItemText-primary': { color: C.danger, fontWeight: 600 } }}
              />
            )}
          </ListItemButton>
        </Tooltip>
      </List>

      {/* ── Clients section (coach only, open only) ──── */}
      {open && auth.role === 'coach' && (
        <>
          <Divider sx={{ mx: 2, borderColor: C.border, mt: 0.5, mb: 1.5, flexShrink: 0 }} />
          <Typography variant="overline" sx={{ px: 2.5, color: C.muted, flexShrink: 0, mb: 0.5 }}>
            {t('clientsHeader')}
          </Typography>

          <Box sx={{ overflowY: 'auto', flex: 1, pb: 1 }}>
            {[...visibleClients]
              .sort((a, b) => {
                const ai = recentIds.indexOf(a.id)
                const bi = recentIds.indexOf(b.id)
                if (ai === -1 && bi === -1) return 0
                if (ai === -1) return 1
                if (bi === -1) return -1
                return ai - bi
              })
              .map((c, i) => {
                const ri    = clients.findIndex(x => x.name === c.name)
                const isSel = actualIdx === ri
                return (
                  <Box
                    key={c.name}
                    sx={{
                      display:   'flex',
                      alignItems:'center',
                      mx:        1.5,
                      mb:        '2px',
                    }}
                  >
                    <ListItemButton
                      selected={isSel}
                      onClick={() => {
                        setRecentIds(prev => [c.id, ...prev.filter(id => id !== c.id)])
                        setSelIdx(ri)
                        setCurrentWorkout([])
                      }}
                      sx={{
                        flex:          1,
                        flexDirection: 'column',
                        alignItems:    'flex-start',
                        py:            0.9,
                        gap:           0,
                      }}
                    >
                      <Typography sx={{
                        fontWeight:    600,
                        fontSize:      '13.5px',
                        lineHeight:    1.35,
                        color:         isSel ? C.primary : C.text,
                        letterSpacing: '-0.05px',
                        transition:    `color 0.15s ${EASE.standard}`,
                      }}>
                        {c.name}
                      </Typography>
                      <Typography variant="caption" sx={{
                        color:      isSel ? 'rgba(196,233,191,0.65)' : C.muted,
                        transition: `color 0.15s ${EASE.standard}`,
                      }}>
                        {c.calorieTarget} kcal · {c.proteinTarget}{t('gUnit')}
                      </Typography>
                    </ListItemButton>

                    <Tooltip title={t('deleteClientTip')} arrow>
                      <IconButton
                        onClick={() => setConfirmDelete({ id: c.id, name: c.name })}
                        size="small"
                        sx={{
                          flexShrink: 0,
                          color:      'transparent',
                          width:      26, height: 26,
                          transition: `color 0.15s ${EASE.standard}, background-color 0.15s ${EASE.standard}`,
                          '&:hover':  {
                            color:   C.danger,
                            bgcolor: 'rgba(255,107,157,0.1)',
                          },
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
