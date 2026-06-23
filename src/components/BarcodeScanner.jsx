import { useEffect, useRef, useState } from 'react'
import { Box, Typography, Button, CircularProgress } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { BrowserMultiFormatReader } from '@zxing/browser'
import { DecodeHintType, BarcodeFormat } from '@zxing/library'
import { C } from '../theme'

// Full-screen live camera barcode scanner. Calls onDetected(barcode) once a
// product barcode (EAN/UPC) is read, then stops the camera. onClose dismisses.
export default function BarcodeScanner({ onDetected, onClose, t }) {
  const videoRef   = useRef(null)
  const controlsRef = useRef(null)
  const doneRef    = useRef(false)
  const [error, setError] = useState('')
  const [starting, setStarting] = useState(true)

  useEffect(() => {
    const hints = new Map()
    hints.set(DecodeHintType.POSSIBLE_FORMATS, [
      BarcodeFormat.EAN_13,
      BarcodeFormat.EAN_8,
      BarcodeFormat.UPC_A,
      BarcodeFormat.UPC_E,
      BarcodeFormat.CODE_128,
    ])
    const reader = new BrowserMultiFormatReader(hints)
    let cancelled = false

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, err, controls) => {
        if (controls && !controlsRef.current) {
          controlsRef.current = controls
          setStarting(false)
        }
        if (result && !doneRef.current) {
          doneRef.current = true
          try { controls?.stop() } catch { /* noop */ }
          onDetected(result.getText())
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(t('barcodeCamError'))
          setStarting(false)
        }
      })

    return () => {
      cancelled = true
      try { controlsRef.current?.stop() } catch { /* noop */ }
    }
  }, [onDetected, t])

  return (
    <Box sx={{
      position: 'fixed', inset: 0, zIndex: 2000,
      background: '#000',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {/* Aiming frame */}
      {!error && (
        <Box sx={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
          width: 'min(80vw, 320px)', height: 160,
          border: `3px solid ${C.primary}`, borderRadius: '14px',
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.45)',
          pointerEvents: 'none',
        }} />
      )}

      {/* Hint / status text */}
      <Box sx={{
        position: 'absolute', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 110px)',
        left: 0, right: 0, textAlign: 'center', px: 3,
      }}>
        {error
          ? <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{error}</Typography>
          : starting
            ? <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', justifyContent: 'center' }}>
                <CircularProgress size={18} sx={{ color: C.primary }} />
                <Typography sx={{ color: '#fff', fontSize: '14px' }}>{t('barcodeStarting')}</Typography>
              </Box>
            : <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>{t('barcodeHint')}</Typography>
        }
      </Box>

      {/* Close */}
      <Button
        onClick={onClose}
        startIcon={<CloseIcon />}
        sx={{
          position: 'absolute',
          bottom: 'calc(env(safe-area-inset-bottom, 0px) + 36px)',
          left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(255,255,255,0.14)', color: '#fff',
          borderRadius: '999px', px: 3, py: 1, fontWeight: 700,
          '&:hover': { background: 'rgba(255,255,255,0.24)' },
        }}
      >
        {t('cancelLbl')}
      </Button>
    </Box>
  )
}
