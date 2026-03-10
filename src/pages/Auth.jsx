import { useState } from 'react'
import { Box, Paper, Typography, TextField, Button, Alert } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'
import SynrgLogomark from '../layout/SynrgLogomark'

export default function Auth() {
  const { handleLogin, t, lang, setLang, isDark, setIsDark } = useApp()

  const [name,    setName]    = useState('')
  const [pass,    setPass]    = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setError('')
    if (!name.trim()) { setError(t('errName')); return }
    if (!pass)        { setError(t('errPassShort')); return }
    setLoading(true)
    const err = await handleLogin(name.trim(), pass)
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
        <Typography variant="h2" sx={{ mb: 2.5, textAlign: 'center', letterSpacing: '-0.2px' }}>
          {t('loginBtn').replace(' →', '')}
        </Typography>

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
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            inputProps={{ style: { fontSize: '15px', padding: '13px 14px' } }}
            autoComplete="current-password"
          />

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
            {loading ? t('saving') : t('loginBtn')}
          </Button>
        </Box>
      </Paper>

      <Typography variant="body2" sx={{ color: C.muted, mt: 2.5, letterSpacing: '0.3px', fontSize: '12.5px' }}>
        {t('tagline')}
      </Typography>
    </Box>
  )
}
