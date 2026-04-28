// GDPR-compliant cookie consent banner.
// Required by EU Cookie Directive 2002/58/EC + ЗЕС.
// Stores consent in localStorage as { necessary: true, analytics: bool, marketing: bool, ts }
// Only show analytics/marketing trackers (GA4, Meta Pixel) AFTER user accepts.

import { useEffect, useState } from 'react'
import { Box, Button, Typography, Dialog, DialogContent, DialogTitle, IconButton, Switch, FormControlLabel } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { C } from '../theme'

const CONSENT_KEY = 'synrg_cookie_consent_v1'

function readConsent() {
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function writeConsent(consent) {
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...consent, ts: Date.now() }))
    // Dispatch event so analytics scripts can react
    window.dispatchEvent(new CustomEvent('synrg_consent', { detail: consent }))
  } catch { /* ignore */ }
}

export default function CookieBanner() {
  const [show, setShow] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const [marketing, setMarketing] = useState(false)

  useEffect(() => {
    const consent = readConsent()
    if (!consent) {
      // First visit — show banner after small delay (so it's not first thing user sees)
      const t = setTimeout(() => setShow(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const acceptAll = () => {
    writeConsent({ necessary: true, analytics: true, marketing: true })
    setShow(false)
  }

  const rejectAll = () => {
    writeConsent({ necessary: true, analytics: false, marketing: false })
    setShow(false)
  }

  const saveCustom = () => {
    writeConsent({ necessary: true, analytics, marketing })
    setShowSettings(false)
    setShow(false)
  }

  if (!show) return null

  return (
    <>
      <Box sx={{
        position: 'fixed',
        bottom: 16,
        left: 16,
        right: 16,
        maxWidth: 520,
        margin: '0 auto',
        zIndex: 9999,
        background: '#0d1510',
        border: '1px solid rgba(196,233,191,0.3)',
        borderRadius: '14px',
        padding: '16px 18px',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
      }}>
        <Typography sx={{ fontSize: '13px', color: '#e0e0e0', lineHeight: 1.5, mb: 1.5 }}>
          Използваме бисквитки за функционирането на сайта и (по избор) за анализ и маркетинг.
          Технически необходимите винаги са активни — без тях сайтът не работи.{' '}
          <Box
            component="a"
            href="#privacy"
            onClick={(e) => { e.preventDefault(); setShowSettings(true) }}
            sx={{ color: '#c4e9bf', textDecoration: 'underline', cursor: 'pointer' }}
          >
            Настройки
          </Box>
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Button
            onClick={acceptAll}
            variant="contained"
            size="small"
            sx={{
              background: '#c4e9bf', color: '#0d1510',
              fontSize: '12px', fontWeight: 800, textTransform: 'none',
              '&:hover': { background: '#aedba9' },
            }}
          >
            Приемам всички
          </Button>
          <Button
            onClick={rejectAll}
            variant="outlined"
            size="small"
            sx={{
              borderColor: 'rgba(255,255,255,0.2)', color: '#999',
              fontSize: '12px', fontWeight: 700, textTransform: 'none',
              '&:hover': { borderColor: '#999', background: 'transparent' },
            }}
          >
            Само необходими
          </Button>
        </Box>
      </Box>

      <Dialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px', background: '#0d1510', color: '#e0e0e0' } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 800, fontSize: '17px' }}>
          Настройки на бисквитки
          <IconButton onClick={() => setShowSettings(false)} size="small" sx={{ color: '#999' }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <FormControlLabel
              control={<Switch checked={true} disabled />}
              label="Технически (винаги активни)"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', color: '#e0e0e0' } }}
            />
            <Typography sx={{ fontSize: '11px', color: '#888', ml: 5, mb: 1.5 }}>
              За login сесия, защита от спам, основна функционалност.
            </Typography>

            <FormControlLabel
              control={<Switch checked={analytics} onChange={e => setAnalytics(e.target.checked)} />}
              label="Анализ"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', color: '#e0e0e0' } }}
            />
            <Typography sx={{ fontSize: '11px', color: '#888', ml: 5, mb: 1.5 }}>
              Google Analytics — анонимизирани данни за подобряване на сайта.
            </Typography>

            <FormControlLabel
              control={<Switch checked={marketing} onChange={e => setMarketing(e.target.checked)} />}
              label="Маркетинг"
              sx={{ '& .MuiFormControlLabel-label': { fontSize: '13px', color: '#e0e0e0' } }}
            />
            <Typography sx={{ fontSize: '11px', color: '#888', ml: 5 }}>
              Meta Pixel за персонализирани реклами (Facebook/Instagram).
            </Typography>
          </Box>

          <Button
            onClick={saveCustom}
            variant="contained"
            fullWidth
            sx={{ background: '#c4e9bf', color: '#0d1510', fontWeight: 800, fontSize: '13px', textTransform: 'none', mt: 1, '&:hover': { background: '#aedba9' } }}
          >
            Запази избора
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}

// Helper for analytics scripts to check current consent
export function hasConsent(category) {
  const c = readConsent()
  if (!c) return false
  return Boolean(c[category])
}
