import { Box, Typography, Button } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogo from './SynrgLogo'

// All links are relative from /synrg-website/app/ back to /synrg-website/
const SITE_BASE = '../'

const SITE_LINKS = [
  { href: `${SITE_BASE}studio.html`,    labelKey: 'siteStudio' },
  { href: `${SITE_BASE}remote.html`,    labelKey: 'sitePrograms' },
  { href: `${SITE_BASE}index.html#cta`, labelKey: 'siteContact' },
]

const CTA_HREF = `${SITE_BASE}index.html#cta`
const HOME_HREF = `${SITE_BASE}index.html`

export default function SiteHeader() {
  const { auth, t } = useApp()

  return (
    <Box
      component="header"
      sx={{
        height:       48,
        display:      'flex',
        alignItems:   'center',
        px:           3,
        background:   C.sidebar,
        borderBottom: `1px solid ${C.border}`,
        flexShrink:   0,
        position:     'sticky',
        top:          0,
        zIndex:       1100,
        gap:          3.5,
      }}
    >
      {/* Logo — links back to website home */}
      <Box
        component="a"
        href={HOME_HREF}
        sx={{
          display:    'flex',
          alignItems: 'center',
          flexShrink: 0,
          transition: `opacity 0.18s ${EASE.standard}`,
          '&:hover':  { opacity: 0.8 },
        }}
      >
        <SynrgLogo width={80} />
      </Box>

      {/* Separator dot */}
      <Typography sx={{ color: C.border, fontSize: '8px', lineHeight: 1, userSelect: 'none' }}>
        |
      </Typography>

      {/* Site navigation links */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flex: 1 }}>
        {SITE_LINKS.map(link => (
          <Typography
            key={link.labelKey}
            component="a"
            href={link.href}
            sx={{
              fontSize:       '13px',
              fontWeight:     700,
              fontStyle:      'italic',
              color:          C.muted,
              textDecoration: 'none',
              letterSpacing:  '0.02em',
              transition:     `color 0.18s ${EASE.standard}`,
              '&:hover':      { color: C.text },
            }}
          >
            {t(link.labelKey)}
          </Typography>
        ))}
      </Box>

      {/* Right side: account + CTA */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <Typography sx={{
          fontSize:       '13px',
          fontWeight:     700,
          fontStyle:      'italic',
          color:          C.text,
          letterSpacing:  '0.02em',
        }}>
          {auth.isLoggedIn ? auth.name : t('siteAccount')}
        </Typography>

        {!auth.isLoggedIn && (
          <Button
            component="a"
            href={CTA_HREF}
            size="small"
            variant="contained"
            sx={{
              fontSize:      '11px',
              fontWeight:    700,
              fontStyle:     'normal',
              py:            '4px',
              px:            1.5,
              borderRadius:  '99px',
              textTransform: 'none',
              minHeight:     0,
              lineHeight:    1.4,
              letterSpacing: '0.02em',
            }}
          >
            {t('siteCTA')}
          </Button>
        )}
      </Box>
    </Box>
  )
}
