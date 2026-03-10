import { useState, useEffect } from 'react'
import { Button, Box, Typography } from '@mui/material'
import { C } from '../theme'
import SynrgLogo from './SynrgLogo'
import { useApp } from '../context/AppContext'

const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)

export default function InstallScreen({ onSkip }) {
  const { t } = useApp()
  const [deferredPrompt, setDeferredPrompt] = useState(null)

  useEffect(() => {
    const handler = e => { e.preventDefault(); setDeferredPrompt(e) }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const { outcome } = await deferredPrompt.userChoice
      setDeferredPrompt(null)
      if (outcome === 'accepted') { onSkip(); return }
    }
    onSkip()
  }

  return (
    <Box sx={{
      minHeight:      '100vh',
      background:     C.bg,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      padding:        '32px 24px',
      gap:            0,
      fontFamily:     "'DM Sans', sans-serif",
      color:          C.text,
    }}>
      <Box sx={{ mb: 1 }}>
        <SynrgLogo width={180} />
      </Box>
      <Typography sx={{ color: C.muted, fontSize: '15px', mb: 6, textAlign: 'center' }}>
        beyond fitness
      </Typography>

      <Box sx={{
        width:        '100%',
        maxWidth:     '360px',
        background:   '#1E1C1B',
        border:       `1px solid ${C.border}`,
        borderRadius: '20px',
        padding:      '28px 24px',
        mb:           2,
      }}>
        <Typography sx={{ fontSize: '18px', fontWeight: 800, mb: 0.75 }}>
          {isIOS ? t('installTitleIOS') : t('installTitle')}
        </Typography>
        <Typography sx={{ color: C.muted, fontSize: '13px', lineHeight: 1.6, mb: 2.5 }}>
          {t('installDesc')}
        </Typography>

        {!isIOS && (
          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleInstall}
            sx={{ py: 1.75, fontSize: '16px', fontWeight: 800 }}
          >
            {t('installBtn')}
          </Button>
        )}

        {isIOS && (
          <Box sx={{
            background:   'rgba(196,233,191,0.1)',
            border:       '1px solid rgba(196,233,191,0.2)',
            borderRadius: '12px',
            p:            1.75,
            fontSize:     '13px',
            color:        C.primary,
            lineHeight:   1.6,
            textAlign:    'center',
          }}>
            {t('installIOSHint')} <strong>Share</strong> {t('installIOSHint2')}<br />
            <strong>{t('installIOSHint3')}</strong>
          </Box>
        )}
      </Box>

      <button
        onClick={onSkip}
        style={{
          background:     'transparent',
          border:         'none',
          color:          C.muted,
          fontFamily:     "'DM Sans', sans-serif",
          fontSize:       '14px',
          fontWeight:     600,
          cursor:         'pointer',
          padding:        '12px',
          textDecoration: 'underline',
        }}
      >
        {t('installSkip')}
      </button>
    </Box>
  )
}
