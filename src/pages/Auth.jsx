import { useState } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogomark from '../layout/SynrgLogomark'

export default function Auth() {
  const {
    clients, coaches,
    handleLoginCoach, handleLoginClient,
    handleRegisterCoach, handleRegisterClient,
    t, lang, setLang, isDark, setIsDark,
  } = useApp()

  const [role,    setRole]    = useState('coach')   // 'coach' | 'client'
  const [mode,    setMode]    = useState('login')   // 'login' | 'register'
  const [name,    setName]    = useState('')
  const [pass,    setPass]    = useState('')
  const [pass2,   setPass2]   = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const isCoach = role === 'coach'
  const accent  = isCoach ? C.primary    : C.purple
  const soft    = isCoach ? C.accentSoft : C.purpleSoft
  const bdr     = isCoach ? 'var(--c-primaryA20)' : 'rgba(200,197,255,0.25)'

  function switchRole(r) { setRole(r); setError('') }
  function switchMode(m) { setMode(m); setError(''); setName(''); setPass(''); setPass2('') }

  async function handleSubmit() {
    setError('')
    const trimName = name.trim()
    if (!trimName)        { setError(t('errName'));        return }
    if (pass.length < 3)  { setError(t('errPassShort'));   return }

    if (mode === 'register') {
      if (pass !== pass2) { setError(t('errPassMismatch')); return }
      if (isCoach && coaches.find(c => c.name.toLowerCase() === trimName.toLowerCase())) {
        setError(t('errCoachExists')); return
      }
      if (!isCoach && clients.find(c => c.name.toLowerCase() === trimName.toLowerCase())) {
        setError(t('errClientExists')); return
      }
    }

    setLoading(true)
    let err
    if (mode === 'login') {
      err = await (isCoach ? handleLoginCoach : handleLoginClient)(trimName, pass)
    } else {
      err = await (isCoach ? handleRegisterCoach : handleRegisterClient)(trimName, pass)
      if (!err) { switchMode('login'); return }
    }
    setLoading(false)
    if (err) setError(err)
  }

  return (
    <Box sx={{
      minHeight:      '100vh',
      background:     `radial-gradient(ellipse at 50% 0%, rgba(196,233,191,0.05) 0%, ${C.bg} 60%)`,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      p:              2.5,
      color:          C.text,
      animation:      'fadeIn 0.3s ease',
    }}>

      {/* ── Logo ──────────────────────────────────────── */}
      <Box sx={{
        mb:     3,
        filter: isDark
          ? 'drop-shadow(0 0 28px rgba(196,233,191,0.18))'
          : 'drop-shadow(0 0 12px rgba(42,125,56,0.15))',
      }}>
        <SynrgLogomark size={120} isDark={isDark} />
      </Box>

      {/* ── Lang + theme row ──────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
        {['bg', 'en'].map(l => (
          <Button
            key={l}
            onClick={() => setLang(l)}
            size="small"
            sx={{
              minWidth:   '46px',
              py:         '4px',
              fontSize:   '12px',
              fontWeight: 700,
              borderRadius:'99px',
              background: lang === l ? C.accentSoft : 'transparent',
              color:      lang === l ? C.primary    : C.muted,
              border:     `1px solid ${lang === l ? C.primaryA20 : C.border}`,
              '&:hover':  { background: C.accentSoft, color: C.primary },
            }}
          >
            {l.toUpperCase()}
          </Button>
        ))}
        <Button
          onClick={() => setIsDark(!isDark)}
          size="small"
          sx={{
            minWidth: '40px',
            py:       '4px',
            fontSize: '14px',
            borderRadius:'99px',
            background:'transparent',
            color:    C.muted,
            border:   `1px solid ${C.border}`,
            '&:hover':{ background: C.accentSoft, color: C.primary },
          }}
        >
          {isDark ? '☀️' : '🌙'}
        </Button>
      </Box>

      {/* ── Main card ─────────────────────────────────── */}
      <Paper sx={{
        width:        '100%',
        maxWidth:     '420px',
        p:            3,
        borderRadius: '24px',
        animation:    `fadeInUp 0.28s ${EASE.decelerate} 0.05s both`,
      }}>

        {/* Role toggle */}
        <Box sx={{
          display:      'flex',
          background:   'rgba(0,0,0,0.12)',
          borderRadius: '14px',
          p:            '4px',
          mb:           2.5,
        }}>
          {[['coach', t('coachRole')], ['client', t('clientRole')]].map(([r, label]) => (
            <Button
              key={r}
              onClick={() => switchRole(r)}
              fullWidth
              sx={{
                py:           '8px',
                borderRadius: '11px',
                fontWeight:   700,
                fontSize:     '13.5px',
                background:   role === r ? soft : 'transparent',
                color:        role === r ? accent : C.muted,
                border:       role === r ? `1px solid ${bdr}` : '1px solid transparent',
                transition:   `all 0.18s ${EASE.spring}`,
                '&:hover':    { background: soft, color: accent },
              }}
            >
              {r === 'coach' ? '💪' : '🏃'} {label}
            </Button>
          ))}
        </Box>

        {/* Mode toggle */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2.5 }}>
          {[['login', t('loginBtn').replace(' →', '')], ['register', t('createProfile').replace(' →', '')]].map(([m, label]) => (
            <Button
              key={m}
              onClick={() => switchMode(m)}
              size="small"
              sx={{
                px:         2,
                py:         '6px',
                borderRadius:'99px',
                fontWeight: 600,
                fontSize:   '13px',
                background: mode === m ? soft : 'transparent',
                color:      mode === m ? accent : C.muted,
                border:     `1px solid ${mode === m ? bdr : C.border}`,
                transition: `all 0.15s ${EASE.standard}`,
                '&:hover':  { background: soft, color: accent },
              }}
            >
              {label}
            </Button>
          ))}
        </Box>

        {/* Form fields */}
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <TextField
            fullWidth
            placeholder={t('namePlaceholder')}
            value={name}
            onChange={e => setName(e.target.value)}
            inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
          />
          <TextField
            fullWidth
            type="password"
            placeholder={t('passPlaceholder')}
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && mode === 'login' && handleSubmit()}
            inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
          />
          {mode === 'register' && (
            <TextField
              fullWidth
              type="password"
              placeholder={t('repeatPass')}
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
            />
          )}

          {error && (
            <Alert severity="error" sx={{ borderRadius: '12px', fontSize: '13px', py: 0.75 }}>
              {error}
            </Alert>
          )}

          <Button
            variant="contained"
            color={isCoach ? 'primary' : 'secondary'}
            fullWidth
            disabled={loading}
            onClick={handleSubmit}
            sx={{ py: 1.625, mt: 0.5, fontWeight: 800, fontSize: '15px', letterSpacing: '0.2px' }}
          >
            {loading
              ? t('saving')
              : mode === 'login'
                ? t('loginBtn')
                : t('createProfile')}
          </Button>
        </Box>
      </Paper>

      {/* Tagline */}
      <Typography variant="body2" sx={{ color: C.muted, mt: 2.5, letterSpacing: '0.3px', fontSize: '12.5px' }}>
        {t('tagline')}
      </Typography>
    </Box>
  )
}
