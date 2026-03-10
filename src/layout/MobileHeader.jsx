import { AppBar, Toolbar, Box, Typography, IconButton, Button } from '@mui/material'
import LogoutIcon        from '@mui/icons-material/Logout'
import FitnessCenterIcon from '@mui/icons-material/FitnessCenter'
import DirectionsRunIcon from '@mui/icons-material/DirectionsRun'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'

export default function MobileHeader() {
  const { auth, logout, client, lang, setLang, t } = useApp()

  return (
    <AppBar position="sticky" sx={{ top: 0, zIndex: 40 }}>
      <Toolbar sx={{ paddingTop: 'env(safe-area-inset-top)', gap: 1 }}>

        {/* ── Leading: avatar + name ──────────────────────── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1, minWidth: 0 }}>
          {/* Role avatar */}
          <Box sx={{
            width:          40,
            height:         40,
            borderRadius:   '12px',
            background:     auth.role === 'coach' ? C.primaryContainer : C.purpleSoft,
            border:         `1px solid ${auth.role === 'coach' ? 'rgba(196,233,191,0.2)' : 'rgba(200,197,255,0.2)'}`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            flexShrink:     0,
          }}>
            {auth.role === 'coach'
              ? <FitnessCenterIcon sx={{ fontSize: '20px', color: C.primary }} />
              : <DirectionsRunIcon sx={{ fontSize: '20px', color: C.purple }} />
            }
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '15px', lineHeight: 1.2, color: C.text }}>
              {auth.name}
            </Typography>
            {auth.role === 'coach' && client?.name ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography variant="overline" sx={{ color: C.primary, lineHeight: 1 }}>
                  {t('coachRole')}
                </Typography>
                <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>·</Typography>
                <Typography variant="overline" sx={{ color: C.muted, lineHeight: 1 }}>
                  {client.name}
                </Typography>
              </Box>
            ) : (
              <Typography variant="overline" sx={{
                color:      auth.role === 'coach' ? C.primary : C.purple,
                lineHeight: 1,
              }}>
                {auth.role === 'coach' ? t('coachRole') : t('clientRole')}
              </Typography>
            )}
          </Box>
        </Box>

        {/* ── Language toggle ───────────────────────────────── */}
        <Button
          onClick={() => setLang(lang === 'bg' ? 'en' : 'bg')}
          size="small"
          sx={{
            minWidth:     '36px',
            py:           '5px',
            px:           1,
            fontSize:     '11px',
            fontWeight:   700,
            letterSpacing:'0.5px',
            borderRadius: '8px',
            color:        C.muted,
            border:       `1px solid ${C.border}`,
            flexShrink:   0,
            transition:   `all 0.18s ${EASE.standard}`,
            '&:hover':    { color: C.primary, borderColor: 'rgba(196,233,191,0.3)' },
          }}
        >
          {lang === 'bg' ? 'EN' : 'BG'}
        </Button>

        {/* ── Trailing: logout icon button ────────────────── */}
        <IconButton
          onClick={logout}
          size="medium"
          aria-label={t('navLogout')}
          sx={{
            color:   C.muted,
            flexShrink: 0,
            '&:hover': { color: C.danger, bgcolor: 'rgba(255,107,157,0.08)' },
          }}
        >
          <LogoutIcon sx={{ fontSize: 22 }} />
        </IconButton>

      </Toolbar>
    </AppBar>
  )
}
