import { useState, useEffect } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert, useMediaQuery, useTheme } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import GetAppIcon from '@mui/icons-material/GetApp'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogomark from '../layout/SynrgLogomark'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches
const SITE_BASE = '../'

export default function Auth() {
  const { handleLogin, handleRegisterClient, t, lang, setLang, isDark, setIsDark } = useApp()
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [mode,    setMode]    = useState('login')   // 'login' | 'register'
  const [name,    setName]    = useState('')
  const [pass,    setPass]    = useState('')
  const [pass2,   setPass2]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  // PWA install prompt
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function switchMode(m) {
    setMode(m)
    setError('')
    setName('')
    setPass('')
    setPass2('')
  }

  async function handleSubmit() {
    setError('')
    if (!name.trim()) { setError(t('errName')); return }
    if (!pass)        { setError(t('errPassShort')); return }

    if (mode === 'register') {
      if (pass.length < 3)   { setError(t('errPassShort')); return }
      if (pass !== pass2)    { setError(t('errPassMismatch')); return }
      setLoading(true)
      const err = await handleRegisterClient(name.trim(), pass)
      setLoading(false)
      if (err) setError(err)
    } else {
      setLoading(true)
      const err = await handleLogin(name.trim(), pass)
      setLoading(false)
      if (err) setError(err)
    }
  }

  const isRegister = mode === 'register'

  return (
    <Box sx={{
      flex:           1,
      minHeight:      0,
      background:     `radial-gradient(ellipse at 50% 0%, rgba(196,233,191,0.05) 0%, ${C.bg} 60%)`,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      p:              2.5,
      color:          C.text,
      animation:      'fadeIn 0.3s ease',
    }}>

      {/* ── Back to site (mobile only, not in standalone PWA) ── */}
      {isMobile && !isStandalone && (
        <Box
          component="a"
          href={`${SITE_BASE}index.html`}
          sx={{
            position:       'absolute',
            top:            'calc(12px + env(safe-area-inset-top, 0px))',
            left:           16,
            display:        'flex',
            alignItems:     'center',
            gap:            0.5,
            color:          C.muted,
            textDecoration: 'none',
            fontSize:       '13px',
            fontWeight:     700,
            transition:     `color 0.18s ${EASE.standard}`,
            '&:hover':      { color: C.text },
          }}
        >
          <ArrowBackIcon sx={{ fontSize: 18 }} />
          {t('siteHome')}
        </Box>
      )}

      {/* ── Logo ────────────────────────────────────────── */}
      <Box sx={{
        mb:     3,
        filter: isDark
          ? 'drop-shadow(0 0 28px rgba(196,233,191,0.18))'
          : 'drop-shadow(0 0 12px rgba(42,125,56,0.15))',
      }}>
        <SynrgLogomark size={120} isDark={isDark} />
      </Box>

      {/* ── Lang + theme row ─────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
        {['bg', 'en'].map(l => (
          <Button
            key={l}
            onClick={() => setLang(l)}
            size="small"
            sx={{
              minWidth:    '46px',
              py:          '4px',
              fontSize:    '12px',
              fontWeight:  700,
              borderRadius:'99px',
              background:  lang === l ? C.accentSoft : 'transparent',
              color:       lang === l ? C.primary    : C.muted,
              border:      `1px solid ${lang === l ? C.primaryA20 : C.border}`,
              '&:hover':   { background: C.accentSoft, color: C.primary },
            }}
          >
            {l.toUpperCase()}
          </Button>
        ))}
        <Button
          onClick={() => setIsDark(!isDark)}
          size="small"
          sx={{
            minWidth:    '46px',
            py:          '4px',
            fontSize:    '12px',
            fontWeight:  700,
            borderRadius:'99px',
            background:  'transparent',
            color:       C.muted,
            border:      `1px solid ${C.border}`,
            '&:hover':   { background: C.accentSoft, color: C.primary },
          }}
        >
          {isDark ? t('lightMode') : t('darkMode')}
        </Button>
      </Box>

      {/* ── Card ─────────────────────────────────────────── */}
      <Paper sx={{
        width:        '100%',
        maxWidth:     '380px',
        p:            3,
        borderRadius: '24px',
        animation:    `fadeInUp 0.28s ${EASE.decelerate} 0.05s both`,
      }}>

        {/* Mode tabs */}
        <Box sx={{
          display:      'flex',
          borderRadius: '12px',
          border:       `1px solid ${C.border}`,
          overflow:     'hidden',
          mb:           2.5,
        }}>
          {[
            { key: 'login',    label: t('loginTab') },
            { key: 'register', label: t('registerClientTab').split(' - ')[1] || t('registerTitle') },
          ].map(({ key, label }) => (
            <Box
              key={key}
              onClick={() => switchMode(key)}
              sx={{
                flex:           1,
                py:             1.1,
                textAlign:      'center',
                cursor:         'pointer',
                fontSize:       '13px',
                fontWeight:     700,
                background:     mode === key ? C.accentSoft : 'transparent',
                color:          mode === key ? C.primary    : C.muted,
                borderRight:    key === 'login' ? `1px solid ${C.border}` : 'none',
                transition:     `all 0.18s ${EASE.standard}`,
                userSelect:     'none',
                '&:hover':      { color: C.primary },
              }}
            >
              {label}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <TextField
            fullWidth
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
            autoComplete="username"
          />
          <TextField
            fullWidth
            type="password"
            placeholder={t('passPlaceholder')}
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => !isRegister && e.key === 'Enter' && handleSubmit()}
            inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
            autoComplete={isRegister ? 'new-password' : 'current-password'}
          />
          {isRegister && (
            <TextField
              fullWidth
              type="password"
              placeholder={t('repeatPass')}
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
              autoComplete="new-password"
            />
          )}

          {error && (
            <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            fullWidth
            disabled={loading}
            onClick={handleSubmit}
            sx={{ py: 1.625, mt: 0.5, fontWeight: 800, fontSize: '15px', letterSpacing: '0.2px' }}
          >
            {loading ? t('saving') : (isRegister ? t('createProfile') : t('loginBtn'))}
          </Button>
        </Box>
      </Paper>

      <Typography variant="body2" sx={{ color: C.muted, mt: 2.5, letterSpacing: '0.3px', fontSize: '12.5px' }}>
        {t('tagline')}
      </Typography>

      {/* Install on phone button — only in browser, not standalone */}
      {!isStandalone && (
        <Button
          startIcon={<GetAppIcon sx={{ fontSize: '18px' }} />}
          onClick={async () => {
            if (deferredPrompt) {
              deferredPrompt.prompt()
              await deferredPrompt.userChoice
              setDeferredPrompt(null)
            }
          }}
          sx={{
            mt: 2,
            color: C.muted,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '99px',
            border: `1px solid ${C.border}`,
            px: 2,
            py: 0.75,
            transition: `all 0.18s ${EASE.standard}`,
            '&:hover': { color: C.primary, borderColor: C.primaryA20, background: C.accentSoft },
          }}
        >
          {t('installOnPhone')}
        </Button>
      )}
    </Box>
  )
}
