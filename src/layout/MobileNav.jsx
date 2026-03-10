import { Box, BottomNavigation, BottomNavigationAction, Typography, IconButton } from '@mui/material'
import GroupIcon from '@mui/icons-material/Group'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import { useApp } from '../context/AppContext'
import { NAV_ITEMS } from '../lib/constants'
import { C, EASE } from '../theme'

// ── MD3 NavigationBar action with pill indicator ────────────────
function NavAction({ value, icon, label, isSelected, onClick, ...rest }) {
  return (
    <BottomNavigationAction
      value={value}
      label={label}
      onClick={onClick}
      {...rest}
      icon={
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {/* MD3 active indicator — pill shape */}
          <Box sx={{
            position:     'absolute',
            width:        '56px',
            height:       '28px',
            borderRadius: '14px',
            background:   isSelected ? C.primaryContainer : 'transparent',
            transition:   `background 0.2s ${EASE.standard}`,
          }} />
          <Box sx={{
            position:   'relative',
            zIndex:     1,
            fontSize:   '20px',
            lineHeight: 1,
            display:    'flex',
            transform:  isSelected ? 'scale(1.08)' : 'scale(1)',
            transition: `transform 0.2s ${EASE.spring}`,
          }}>
            {icon}
          </Box>
        </Box>
      }
      sx={{
        '& .MuiBottomNavigationAction-label': {
          fontSize:   '10.5px !important',
          fontWeight: isSelected ? '700 !important' : '500 !important',
          color:      isSelected ? `${C.primary} !important` : `${C.muted} !important`,
          opacity:    '1 !important',       // always show label
          transition: `color 0.2s ${EASE.standard}`,
        },
        minWidth: 0,
        px: 0.5,
      }}
    />
  )
}

export default function MobileNav() {
  const {
    auth, view, setView,
    showClientMenu, setShowClientMenu,
    clients, visibleClients, actualIdx, setSelIdx, setCurrentWorkout,
    client, t, setConfirmDelete,
  } = useApp()

  return (
    <>
      {/* ── MD3 NavigationBar ───────────────────────── */}
      <Box sx={{
        position:      'fixed',
        bottom:        0,
        left:          0,
        right:         0,
        zIndex:        50,
        background:    C.sidebar,
        borderTop:     `1px solid ${C.border}`,
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <BottomNavigation
          value={view}
          showLabels
          onChange={(_, newView) => {
            if (newView === '__clients__') return // handled by its own onClick
            setView(newView)
            setShowClientMenu(false)
          }}
          sx={{
            height:     '64px',
            background: 'transparent',
            borderTop:  'none',
          }}
        >
          {NAV_ITEMS.map(({ view: v, icon, labelKey }) => (
            <NavAction
              key={v}
              value={v}
              icon={<span>{icon}</span>}
              label={t(labelKey)}
              isSelected={view === v}
            />
          ))}

          {/* Clients switcher — shows current client name */}
          {auth.role === 'coach' && (
            <BottomNavigationAction
              value="__clients__"
              onClick={e => { e.stopPropagation(); setShowClientMenu(p => !p) }}
              label={client?.name || t('navClients')}
              icon={
                <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box sx={{
                    position:     'absolute',
                    width:        '56px',
                    height:       '28px',
                    borderRadius: '14px',
                    background:   showClientMenu ? C.primaryContainer : 'transparent',
                    transition:   `background 0.2s ${EASE.standard}`,
                  }} />
                  <Box sx={{
                    position:   'relative',
                    zIndex:     1,
                    display:    'flex',
                    transform:  showClientMenu ? 'scale(1.08)' : 'scale(1)',
                    transition: `transform 0.2s ${EASE.spring}`,
                  }}>
                    <GroupIcon sx={{
                      fontSize: '20px',
                      color:    showClientMenu ? C.primary : C.muted,
                      transition: `color 0.2s ${EASE.standard}`,
                    }} />
                  </Box>
                </Box>
              }
              sx={{
                minWidth: 0,
                px: 0.5,
                '& .MuiBottomNavigationAction-label': {
                  fontSize:      '10px !important',
                  fontWeight:    '700 !important',
                  color:         showClientMenu ? `${C.primary} !important` : `${C.muted} !important`,
                  opacity:       '1 !important',
                  maxWidth:      '64px',
                  overflow:      'hidden',
                  textOverflow:  'ellipsis',
                  whiteSpace:    'nowrap',
                  transition:    `color 0.2s ${EASE.standard}`,
                },
              }}
            />
          )}
        </BottomNavigation>
      </Box>

      {/* ── Client selector — bottom sheet ─────────── */}
      {showClientMenu && auth.role === 'coach' && (
        <Box
          sx={{
            position:     'fixed',
            bottom:       '64px',
            left:         0,
            right:        0,
            maxHeight:    '65vh',
            background:   C.sidebar,
            borderTop:    `1px solid ${C.border}`,
            borderRadius: '24px 24px 0 0',
            zIndex:       49,
            overflowY:    'auto',
            p:            '16px 16px 24px',
            animation:    'fadeInUp 0.22s ease both',
          }}
        >
          {/* Backdrop */}
          <Box
            onClick={() => setShowClientMenu(false)}
            sx={{ position: 'fixed', inset: 0, zIndex: -1 }}
          />

          {/* Drag handle */}
          <Box sx={{
            width:        36,
            height:       4,
            borderRadius: '2px',
            background:   'rgba(255,255,255,0.18)',
            mx:           'auto',
            mb:           2,
          }} />

          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, px: 0.5 }}>
            <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>
              {t('selectClient')}
            </Typography>
            <Typography variant="caption" sx={{ color: C.muted }}>
              {visibleClients.length} {t('ofClients')}
            </Typography>
          </Box>

          {/* Client list */}
          {visibleClients.map((c, i) => {
            const ri    = clients.findIndex(x => x.name === c.name)
            const isSel = actualIdx === ri
            return (
              <Box
                component="div"
                key={c.name}
                onClick={() => {
                  setSelIdx(ri)
                  setCurrentWorkout([])
                  setShowClientMenu(false)
                  setView('dashboard')   // always land on dashboard for the new client
                }}
                sx={{
                  width:        '100%',
                  textAlign:    'left',
                  background:   isSel
                    ? 'linear-gradient(135deg, rgba(196,233,191,0.14) 0%, rgba(196,233,191,0.08) 100%)'
                    : 'rgba(255,255,255,0.04)',
                  color:        isSel ? C.primary : C.text,
                  border:       `1px solid ${isSel ? 'rgba(196,233,191,0.3)' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: '14px',
                  px:           1.75,
                  py:           1.4,
                  cursor:       'pointer',
                  fontFamily:   "'DM Sans', sans-serif",
                  mb:           0.75,
                  display:      'flex',
                  alignItems:   'center',
                  gap:          '12px',
                  transition:   `background 0.15s ${EASE.standard}, border-color 0.15s ${EASE.standard}`,
                  animation:    `slideInLeft 0.2s ${EASE.standard} both`,
                  animationDelay: `${i * 0.05}s`,
                }}
              >
                {/* Avatar circle */}
                <Box sx={{
                  width:          36,
                  height:         36,
                  borderRadius:   '50%',
                  background:     isSel ? C.primaryContainer : 'rgba(255,255,255,0.08)',
                  display:        'flex',
                  alignItems:     'center',
                  justifyContent: 'center',
                  fontSize:       '15px',
                  fontWeight:     800,
                  color:          isSel ? C.primary : C.muted,
                  flexShrink:     0,
                  letterSpacing:  '-0.3px',
                }}>
                  {c.name.charAt(0).toUpperCase()}
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{
                    fontWeight:   700,
                    fontSize:     '14.5px',
                    lineHeight:   1.3,
                    color:        isSel ? C.primary : C.text,
                    letterSpacing:'-0.05px',
                  }}>
                    {c.name}
                    {isSel && (
                      <Box component="span" sx={{
                        ml:           1,
                        fontSize:     '10px',
                        background:   C.primaryContainer,
                        color:        C.primary,
                        px:           0.75,
                        py:           '2px',
                        borderRadius: '99px',
                        fontWeight:   700,
                        verticalAlign:'middle',
                      }}>
                        {t('activeLabel')}
                      </Box>
                    )}
                  </Box>
                  <Box sx={{ fontSize: '12px', color: C.muted, mt: 0.2 }}>
                    {c.calorieTarget} kcal · {c.proteinTarget}{t('gUnit')} {t('proteinShortLbl')}
                  </Box>
                </Box>

                {isSel && (
                  <Box sx={{ fontSize: '16px', flexShrink: 0 }}>✓</Box>
                )}

                <IconButton
                  size="small"
                  onClick={e => {
                    e.stopPropagation()
                    setShowClientMenu(false)
                    setConfirmDelete({ id: c.id, name: c.name })
                  }}
                  sx={{
                    flexShrink: 0,
                    color: C.muted,
                    '&:hover': { color: C.danger, bgcolor: 'rgba(255,107,157,0.1)' },
                  }}
                >
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
