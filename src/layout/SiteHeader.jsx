import { Box, Typography, Button } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogo from './SynrgLogo'

// All links are relative from /synrg-website/app/ back to /synrg-website/
const SITE_BASE = '../'

const SITE_LINKS = [
  { href: `${SITE_BASE}studio.html`,  labelKey: 'siteStudio' },
  { href: `${SITE_BASE}remote.html`,  labelKey: 'siteRemote' },
  { href: `${SITE_BASE}pricing.html`, labelKey: 'sitePricing' },
]

const CTA_HREF  = `${SITE_BASE}index.html#cta`
const HOME_HREF = `${SITE_BASE}index.html`

/* Website palette — hardcoded to match the static site exactly */
const WEB = {
  muted: '#5a6e5a',
  cream: '#f0eded',
  bg:    '#0d1510',
  mint:  '#c4e9bf',
  mintHover: '#d4f0cf',
  mintOn: '#0d1510',
  logan: '#AAA9CD',
  loganBorder: 'rgba(170,169,205,0.26)',
  loganDeep: 'rgba(170,169,205,0.06)',
  border: 'rgba(255,255,255,0.07)',
}

export default function SiteHeader() {
  const { auth, lang, setLang, t } = useApp()

  return (
    <Box
      component="header"
      sx={{
        height:         76,
        display:        'flex',
        alignItems:     'center',
        px:             4,
        background:     'rgba(13,21,16,0.9)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom:   `1px solid ${WEB.border}`,
        flexShrink:     0,
        position:       'sticky',
        top:            0,
        zIndex:         1100,
      }}
    >
      <Box sx={{
        width:          '100%',
        maxWidth:       1160,
        mx:             'auto',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'space-between',
      }}>

        {/* ── Logo ── */}
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
          <SynrgLogo width={164} />
        </Box>

        {/* ── Center nav links ── */}
        <Box
          component="nav"
          sx={{
            display:    'flex',
            alignItems: 'center',
            gap:        5,
          }}
        >
          {SITE_LINKS.map(link => (
            <Typography
              key={link.labelKey}
              component="a"
              href={link.href}
              sx={{
                fontFamily:     "'MontBlanc', sans-serif",
                fontSize:       '14px',
                fontWeight:     700,
                fontStyle:      'italic',
                color:          WEB.muted,
                textDecoration: 'none',
                transition:     `color 0.2s ${EASE.standard}`,
                '&:hover':      { color: WEB.cream },
              }}
            >
              {t(link.labelKey)}
            </Typography>
          ))}
        </Box>

        {/* ── Right side ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, flexShrink: 0 }}>

          {/* Language toggle */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px', mr: 0.5 }}>
            <Box
              component="button"
              onClick={() => setLang('bg')}
              sx={{
                background:    'none',
                border:        'none',
                cursor:        'pointer',
                color:         lang === 'bg' ? WEB.cream : WEB.muted,
                fontFamily:    "'MontBlanc', sans-serif",
                fontSize:      '11px',
                fontWeight:    700,
                fontStyle:     'italic',
                letterSpacing: '0.1em',
                p:             '4px 5px',
                borderRadius:  '4px',
                transition:    `color 0.2s`,
                '&:hover':     { color: WEB.cream },
              }}
            >
              BG
            </Box>
            <Typography sx={{ color: WEB.muted, fontSize: '11px', fontWeight: 700, userSelect: 'none', lineHeight: 1 }}>
              |
            </Typography>
            <Box
              component="button"
              onClick={() => setLang('en')}
              sx={{
                background:    'none',
                border:        'none',
                cursor:        'pointer',
                color:         lang === 'en' ? WEB.cream : WEB.muted,
                fontFamily:    "'MontBlanc', sans-serif",
                fontSize:      '11px',
                fontWeight:    700,
                fontStyle:     'italic',
                letterSpacing: '0.1em',
                p:             '4px 5px',
                borderRadius:  '4px',
                transition:    `color 0.2s`,
                '&:hover':     { color: WEB.cream },
              }}
            >
              EN
            </Box>
          </Box>

          {/* Account name or "Влез" ghost button */}
          {auth.isLoggedIn ? (
            <Typography sx={{
              fontFamily:     "'MontBlanc', sans-serif",
              fontSize:       '14px',
              fontWeight:     700,
              fontStyle:      'italic',
              color:          WEB.cream,
              letterSpacing:  '0.02em',
              px:             1,
            }}>
              {auth.name}
            </Typography>
          ) : (
            <Button
              component="a"
              href="./index.html"
              size="small"
              sx={{
                fontFamily:    "'MontBlanc', sans-serif",
                fontSize:      '13px',
                fontWeight:    700,
                fontStyle:     'normal',
                color:         WEB.cream,
                border:        `1px solid ${WEB.loganBorder}`,
                background:    'transparent',
                borderRadius:  '100px',
                textTransform: 'none',
                py:            '10px',
                px:            '20px',
                minHeight:     0,
                lineHeight:    1,
                transition:    `all 0.2s ${EASE.standard}`,
                '&:hover': {
                  borderColor: WEB.logan,
                  background:  WEB.loganDeep,
                  transform:   'translateY(-2px)',
                },
              }}
            >
              {t('siteLogin')}
            </Button>
          )}

          {/* CTA button — matching website */}
          <Button
            component="a"
            href={CTA_HREF}
            size="small"
            sx={{
              fontFamily:    "'MontBlanc', sans-serif",
              fontSize:      '13px',
              fontWeight:    700,
              fontStyle:     'normal',
              background:    WEB.mint,
              color:         WEB.mintOn,
              borderRadius:  '100px',
              textTransform: 'none',
              py:            '10px',
              px:            '20px',
              minHeight:     0,
              lineHeight:    1,
              border:        'none',
              boxShadow:     'none',
              transition:    `all 0.2s ${EASE.standard}`,
              '&:hover': {
                background: WEB.mintHover,
                boxShadow:  '0 8px 32px rgba(196,233,191,0.28)',
                transform:  'translateY(-2px)',
              },
            }}
          >
            {t('siteCTA')}
          </Button>
        </Box>
      </Box>
    </Box>
  )
}
