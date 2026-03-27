import { useState, useEffect } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert, Dialog, useMediaQuery, useTheme, InputAdornment, IconButton } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import GetAppIcon from '@mui/icons-material/GetApp'
import VisibilityIcon from '@mui/icons-material/Visibility'
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff'
import { useApp } from '../context/AppContext'
import { DB, isUsingSupabase } from '../lib/db'
import { C, EASE } from '../theme'
import SynrgLogomark from '../layout/SynrgLogomark'

const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
const SITE_BASE = '../'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export default function Auth() {
  const { handleLogin, handleRegisterClient, t, lang, setLang } = useApp()
  const theme    = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  const [mode,    setMode]    = useState('login')   // 'login' | 'register' | 'forgot' | 'forgot_code'
  const [name,    setName]    = useState('')
  const [email,   setEmail]   = useState('')
  const [pass,    setPass]    = useState('')
  const [pass2,   setPass2]   = useState('')
  const [showPass, setShowPass] = useState(false)
  const [resetCode, setResetCode] = useState('')
  const [resetEmail, setResetEmail] = useState('')
  const [error,   setError]   = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)
  const [showInstall, setShowInstall] = useState(false)

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
    setSuccess('')
    setName('')
    setEmail('')
    setPass('')
    setPass2('')
    setResetCode('')
    setResetEmail('')
  }

  async function handleSubmit() {
    setError('')
    if (!name.trim()) { setError(t('errName')); return }
    if (!pass)        { setError(t('errPassShort')); return }

    if (mode === 'register') {
      if (pass.length < 3)   { setError(t('errPassShort')); return }
      if (pass !== pass2)    { setError(t('errPassMismatch')); return }
      const trimmedEmail = email.trim()
      if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        setError(t('errEmailInvalid')); return
      }
      setLoading(true)
      const err = await handleRegisterClient(name.trim(), pass, trimmedEmail || null)
      setLoading(false)
      if (err) setError(err)
    } else {
      setLoading(true)
      const err = await handleLogin(name.trim(), pass)
      setLoading(false)
      if (err) setError(err)
    }
  }

  async function handleForgotRequest() {
    setError('')
    const em = resetEmail.trim()
    if (!em || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) {
      setError(t('errEmailInvalid')); return
    }
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/password-reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'request', email: em }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'no_account' ? t('errNoAccount') : (data.error || 'Error'))
      } else {
        setMode('forgot_code')
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  async function handleForgotVerify() {
    setError('')
    if (!resetCode.trim()) { setError(t('errCodeRequired')); return }
    if (!pass || pass.length < 3) { setError(t('errPassShort')); return }
    setLoading(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/password-reset`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify', email: resetEmail.trim(), code: resetCode.trim(), new_password: pass }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error === 'invalid_code' ? t('errInvalidCode') : (data.error || 'Error'))
      } else {
        setSuccess(t('resetSuccess'))
        setTimeout(() => switchMode('login'), 2000)
      }
    } catch { setError('Network error') }
    setLoading(false)
  }

  const isRegister = mode === 'register'
  const isForgot = mode === 'forgot' || mode === 'forgot_code'

  return (
    <Box sx={{
      flex:           1,
      minHeight:      0,
      background:     `radial-gradient(ellipse at 50% 0%, rgba(170,169,205,0.05) 0%, ${C.bg} 60%)`,
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
        mb:     1.5,
        filter: 'drop-shadow(0 0 28px rgba(170,169,205,0.18))',
      }}>
        <SynrgLogomark size={120} />
      </Box>

      {/* ── Install button (below logo) ───────────────── */}
      {!isStandalone && (
        <Button
          startIcon={<GetAppIcon sx={{ fontSize: '18px' }} />}
          onClick={() => setShowInstall(true)}
          sx={{
            mb: 2.5,
            color: C.muted,
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'none',
            borderRadius: '99px',
            border: `1px solid ${C.border}`,
            px: 2,
            py: 0.75,
            transition: `all 0.18s ${EASE.standard}`,
            '&:hover': { color: C.purple, borderColor: C.primaryA20, background: C.accentSoft },
          }}
        >
          {t('installOnPhone')}
        </Button>
      )}

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
              color:       lang === l ? C.purple    : C.muted,
              border:      `1px solid ${lang === l ? C.primaryA20 : C.border}`,
              '&:hover':   { background: C.accentSoft, color: C.purple },
            }}
          >
            {l.toUpperCase()}
          </Button>
        ))}
      </Box>

      {/* ── Card ─────────────────────────────────────────── */}
      <Paper sx={{
        width:        '100%',
        maxWidth:     '380px',
        p:            3,
        borderRadius: '24px',
        animation:    `fadeInUp 0.28s ${EASE.decelerate} 0.05s both`,
      }}>

        {/* Mode tabs — hidden during forgot password */}
        {!isForgot && (
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
                  color:          mode === key ? C.purple    : C.muted,
                  borderRight:    key === 'login' ? `1px solid ${C.border}` : 'none',
                  transition:     `all 0.18s ${EASE.standard}`,
                  userSelect:     'none',
                  '&:hover':      { color: C.purple },
                }}
              >
                {label}
              </Box>
            ))}
          </Box>
        )}

        {/* ── Forgot password: enter email ── */}
        {mode === 'forgot' && (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '16px', color: C.text, mb: 0.5 }}>
              {t('forgotTitle')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: C.muted, mb: 0.5 }}>
              {t('enterEmailReset')}
            </Typography>
            <TextField
              fullWidth type="email"
              placeholder={t('emailPlaceholder')}
              value={resetEmail}
              onChange={e => setResetEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleForgotRequest()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
              autoComplete="email"
            />
            {error && <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>{error}</Alert>}
            <Button variant="contained" color="primary" fullWidth disabled={loading}
              onClick={handleForgotRequest}
              sx={{ py: 1.625, mt: 0.5, fontWeight: 800, fontSize: '15px' }}>
              {loading ? t('saving') : t('sendCode')}
            </Button>
            <Button size="small" onClick={() => switchMode('login')}
              sx={{ color: C.muted, fontSize: '12px', fontWeight: 600, mt: 0.5 }}>
              {t('backToLogin')}
            </Button>
          </Box>
        )}

        {/* ── Forgot password: enter code + new password ── */}
        {mode === 'forgot_code' && (
          <Box sx={{ display: 'grid', gap: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '16px', color: C.text, mb: 0.5 }}>
              {t('forgotTitle')}
            </Typography>
            <Typography sx={{ fontSize: '13px', color: C.muted, mb: 0.5 }}>
              {t('enterCode')}
            </Typography>
            <TextField
              fullWidth
              placeholder={t('codePlaceholder')}
              value={resetCode}
              onChange={e => setResetCode(e.target.value)}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px', letterSpacing: '4px', textAlign: 'center' } }}
            />
            <TextField
              fullWidth type={showPass ? 'text' : 'password'}
              placeholder={t('newPassPlaceholder')}
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleForgotVerify()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
              InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(p => !p)} edge="end" sx={{ color: C.muted }}>{showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment> }}
              autoComplete="new-password"
            />
            {error && <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>{success}</Alert>}
            <Button variant="contained" color="primary" fullWidth disabled={loading || !!success}
              onClick={handleForgotVerify}
              sx={{ py: 1.625, mt: 0.5, fontWeight: 800, fontSize: '15px' }}>
              {loading ? t('saving') : t('resetPassword')}
            </Button>
            <Button size="small" onClick={() => switchMode('login')}
              sx={{ color: C.muted, fontSize: '12px', fontWeight: 600, mt: 0.5 }}>
              {t('backToLogin')}
            </Button>
          </Box>
        )}

        {/* ── Normal login / register form ── */}
        {!isForgot && (
          <Box
            component="form"
            autoComplete="on"
            onSubmit={e => { e.preventDefault(); handleSubmit() }}
            sx={{ display: 'grid', gap: 1.25 }}
          >
            <TextField
              fullWidth
              placeholder={t('namePlaceholder')}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
              autoComplete="username"
            />
            {isRegister && (
              <TextField
                fullWidth
                type="email"
                placeholder={`${t('emailPlaceholder')} ${t('emailOptional')}`}
                value={email}
                onChange={e => setEmail(e.target.value)}
                inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
                autoComplete="email"
              />
            )}
            <TextField
              fullWidth
              type={showPass ? 'text' : 'password'}
              placeholder={t('passPlaceholder')}
              value={pass}
              onChange={e => setPass(e.target.value)}
              onKeyDown={e => !isRegister && e.key === 'Enter' && handleSubmit()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
              InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(p => !p)} edge="end" sx={{ color: C.muted }}>{showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment> }}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
            />
            {isRegister && (
              <TextField
                fullWidth
                type={showPass ? 'text' : 'password'}
                placeholder={t('repeatPass')}
                value={pass2}
                onChange={e => setPass2(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSubmit()}
                inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
                InputProps={{ endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPass(p => !p)} edge="end" sx={{ color: C.muted }}>{showPass ? <VisibilityOffIcon /> : <VisibilityIcon />}</IconButton></InputAdornment> }}
                autoComplete="new-password"
              />
            )}

            {error && (
              <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>
                {error}
              </Alert>
            )}

            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              disabled={loading}
              sx={{ py: 1.625, mt: 0.5, fontWeight: 800, fontSize: '15px', letterSpacing: '0.2px' }}
            >
              {loading ? t('saving') : (isRegister ? t('createProfile') : t('loginBtn'))}
            </Button>

            {!isRegister && (
              <Button size="small" onClick={() => switchMode('forgot')}
                sx={{ color: C.muted, fontSize: '12px', fontWeight: 600, mt: 0.5, textTransform: 'none' }}>
                {t('forgotPassword')}
              </Button>
            )}
          </Box>
        )}
      </Paper>

      {/* Install guide dialog */}
      <Dialog
        open={showInstall}
        onClose={() => setShowInstall(false)}
        PaperProps={{ sx: { borderRadius: '20px', maxWidth: '380px', width: '100%', p: 3 } }}
      >
        <Typography sx={{ fontWeight: 800, fontSize: '18px', color: C.text, mb: 0.5 }}>
          {isIOS ? t('installTitleIOS') : t('installTitle')}
        </Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted, mb: 2.5, lineHeight: 1.5 }}>
          {t('installDesc')}
        </Typography>

        {isIOS ? (
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            {/* Step 1: Tap Share */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>1</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, flex: 1 }}>
                {t('installStep1IOS')}
              </Typography>
              {/* iOS Share icon — exact replica */}
              <Box sx={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #3478F6', borderRadius: '8px', background: 'rgba(52,120,246,0.1)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3L12 16" stroke="#3478F6" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M8 7L12 3L16 7" stroke="#3478F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M4 14V19C4 20.1 4.9 21 6 21H18C19.1 21 20 20.1 20 19V14" stroke="#3478F6" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </Box>
            </Box>
            {/* Step 2: Add to Home Screen */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>2</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, flex: 1 }}>
                {t('installStep2IOS')}
              </Typography>
              {/* iOS Add to Home Screen icon — plus in square */}
              <Box sx={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #999', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="#999" strokeWidth="1.5"/>
                  <path d="M12 8V16M8 12H16" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </Box>
            </Box>
            {/* Step 3: Done */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>3</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, fontWeight: 700 }}>
                {t('installStep3IOS')}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'grid', gap: 2.5 }}>
            {/* Step 1: Tap menu */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>1</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, flex: 1 }}>
                {t('installStep1Android')}
              </Typography>
              <Box sx={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${C.border}`, borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="5" r="2" fill="#999"/>
                  <circle cx="12" cy="12" r="2" fill="#999"/>
                  <circle cx="12" cy="19" r="2" fill="#999"/>
                </svg>
              </Box>
            </Box>
            {/* Step 2: Add to Home Screen */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>2</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, flex: 1 }}>
                {t('installStep2Android')}
              </Typography>
              <Box sx={{ minWidth: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: `1px solid ${C.border}`, borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="4" stroke="#999" strokeWidth="1.5"/>
                  <path d="M12 8V16M8 12H16" stroke="#999" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </Box>
            </Box>
            {/* Step 3: Install */}
            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
              <Box sx={{ minWidth: 28, height: 28, borderRadius: '50%', background: C.accentSoft, color: C.text,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800 }}>3</Box>
              <Typography sx={{ fontSize: '14px', color: C.text, fontWeight: 700 }}>
                {t('installStep3Android')}
              </Typography>
            </Box>
            {deferredPrompt && (
              <Button variant="contained" color="primary" fullWidth
                onClick={async () => { deferredPrompt.prompt(); await deferredPrompt.userChoice; setDeferredPrompt(null); setShowInstall(false) }}
                sx={{ py: 1.5, fontWeight: 800, fontSize: '15px' }}>
                {t('installBtn')}
              </Button>
            )}
          </Box>
        )}

        <Button fullWidth onClick={() => setShowInstall(false)}
          sx={{ mt: 2, color: C.muted, fontSize: '13px', fontWeight: 600 }}>
          {t('closeBtn')}
        </Button>
      </Dialog>
    </Box>
  )
}
