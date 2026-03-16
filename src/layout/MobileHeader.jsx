import { useState } from 'react'
import {
  AppBar, Toolbar, Box, Typography, IconButton, Button,
  Drawer, List, ListItemButton, ListItemIcon, ListItemText, Divider,
} from '@mui/material'
import MenuIcon             from '@mui/icons-material/Menu'
import CloseIcon            from '@mui/icons-material/Close'
import LogoutIcon           from '@mui/icons-material/Logout'
import FitnessCenterIcon    from '@mui/icons-material/FitnessCenter'
import DirectionsRunIcon    from '@mui/icons-material/DirectionsRun'
import HomeIcon             from '@mui/icons-material/Home'
import StorefrontIcon       from '@mui/icons-material/Storefront'
import OndemandVideoIcon    from '@mui/icons-material/OndemandVideo'
import AttachMoneyIcon      from '@mui/icons-material/AttachMoney'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogo from './SynrgLogo'

// Relative links from /synrg-website/app/ back to /synrg-website/
const SITE_BASE = '../'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches

function getSiteLinks(t) {
  return [
    { href: `${SITE_BASE}index.html`,      label: t('siteHome'),     Icon: HomeIcon },
    { href: `${SITE_BASE}studio.html`,      label: t('siteStudio'),   Icon: StorefrontIcon },
    { href: `${SITE_BASE}remote.html`,      label: t('siteRemote'),   Icon: OndemandVideoIcon },
    { href: `${SITE_BASE}pricing.html`,     label: t('sitePricing'),  Icon: AttachMoneyIcon },
  ]
}

export default function MobileHeader() {
  const { auth, logout, client, lang, setLang, t } = useApp()
  const [siteMenuOpen, setSiteMenuOpen] = useState(false)

  const siteLinks = getSiteLinks(t)

  return (
    <>
      <AppBar position="sticky" sx={{ top: 0, zIndex: 40 }}>
        <Toolbar sx={{ paddingTop: 'env(safe-area-inset-top)', gap: 1 }}>

          {/* ── Hamburger: site navigation (hidden in standalone PWA) ── */}
          {!isStandalone && (
            <IconButton
              onClick={() => setSiteMenuOpen(true)}
              size="small"
              aria-label={t('siteMenu')}
              sx={{
                color:      C.muted,
                flexShrink: 0,
                mr:         0.5,
                transition: `color 0.18s ${EASE.standard}`,
                '&:hover':  { color: C.text },
              }}
            >
              <MenuIcon sx={{ fontSize: 22 }} />
            </IconButton>
          )}

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

      {/* ── Site navigation drawer ──────────────────────────── */}
      {!isStandalone && (
        <Drawer
          anchor="left"
          open={siteMenuOpen}
          onClose={() => setSiteMenuOpen(false)}
          sx={{
            '& .MuiDrawer-paper': {
              width:       '280px',
              background:  C.sidebar,
              borderRight: `1px solid ${C.border}`,
            },
          }}
        >
          <Box sx={{ p: 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>

            {/* Header: logo + close */}
            <Box sx={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              mb:             3,
            }}>
              <Box component="a" href={`${SITE_BASE}index.html`} sx={{ display: 'flex', alignItems: 'center' }}>
                <SynrgLogo width={120} />
              </Box>
              <IconButton
                onClick={() => setSiteMenuOpen(false)}
                size="small"
                sx={{ color: C.muted, '&:hover': { color: C.text } }}
              >
                <CloseIcon sx={{ fontSize: 22 }} />
              </IconButton>
            </Box>

            {/* Site links */}
            <List sx={{ flex: 1 }}>
              {siteLinks.map(link => (
                <ListItemButton
                  key={link.href}
                  component="a"
                  href={link.href}
                  sx={{ borderRadius: '12px', mb: 0.5, py: 1.5 }}
                >
                  <ListItemIcon sx={{ minWidth: 36, color: C.muted }}>
                    <link.Icon sx={{ fontSize: 20 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={link.label}
                    sx={{
                      '& .MuiListItemText-primary': {
                        fontStyle:  'italic',
                        fontWeight: 700,
                        fontSize:   '15px',
                      },
                    }}
                  />
                </ListItemButton>
              ))}
            </List>

          </Box>
        </Drawer>
      )}
    </>
  )
}
