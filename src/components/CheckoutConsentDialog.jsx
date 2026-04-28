// ── Checkout Consent Dialog ──────────────────────────────────────
// Задължителен gating modal ПРЕДИ Stripe checkout.
// Без 3-те checkbox-а покупката не може да продължи.
//
// Юридическо основание:
//   • Checkbox 1 — чл. 57, т. 12 ЗЗП (изключение от 14-дневно право на отказ)
//   • Checkbox 2 — приемане на ОУ + Privacy Policy
//   • Checkbox 3 — медицинска самодекларация (прехвърля отговорност)
//
// Без checkbox 1 клиент може да си иска парите за 14 дни.

import { useState } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography, Box, IconButton, Checkbox, FormControlLabel, Link,
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import LockIcon from '@mui/icons-material/Lock'
import { C } from '../theme'
import TermsDialog from './TermsDialog'
import PrivacyPolicyDialog from './PrivacyPolicyDialog'

export default function CheckoutConsentDialog({ open, onClose, onConfirm, programName, price, loading }) {
  const [consentWithdrawal, setConsentWithdrawal] = useState(false)
  const [consentTerms,      setConsentTerms]      = useState(false)
  const [consentHealth,     setConsentHealth]     = useState(false)
  const [showTerms,         setShowTerms]         = useState(false)
  const [showPrivacy,       setShowPrivacy]       = useState(false)

  const allChecked = consentWithdrawal && consentTerms && consentHealth

  const handleConfirm = () => {
    if (!allChecked || loading) return
    onConfirm()
  }

  const handleClose = () => {
    if (loading) return
    setConsentWithdrawal(false)
    setConsentTerms(false)
    setConsentHealth(false)
    onClose()
  }

  return (
    <>
      <Dialog
        open={open}
        onClose={handleClose}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          pb: 1, fontWeight: 800, fontSize: '17px',
        }}>
          Преди да продължиш
          <IconButton onClick={handleClose} size="small" disabled={loading} sx={{ color: C.muted }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ pt: 0.5 }}>
          {programName && (
            <Box sx={{
              mb: 2,
              p: 1.5,
              borderRadius: '12px',
              background: C.primaryA3,
              border: `1px solid ${C.border}`,
            }}>
              <Typography sx={{ fontSize: '12px', color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', mb: 0.25 }}>
                Купуваш
              </Typography>
              <Typography sx={{ fontSize: '15px', color: C.text, fontWeight: 800 }}>
                {programName}
              </Typography>
              {price && (
                <Typography sx={{ fontSize: '13px', color: C.purple, fontWeight: 700, mt: 0.25 }}>
                  {price}
                </Typography>
              )}
            </Box>
          )}

          <Typography sx={{ fontSize: '13px', color: C.muted, mb: 2, lineHeight: 1.5 }}>
            За да продължим към плащане, моля потвърди следните три неща:
          </Typography>

          {/* Checkbox 1 — Withdrawal exclusion (Чл. 57, т. 12 ЗЗП) */}
          <FormControlLabel
            sx={{ alignItems: 'flex-start', mb: 1.5, mr: 0 }}
            control={
              <Checkbox
                checked={consentWithdrawal}
                onChange={(e) => setConsentWithdrawal(e.target.checked)}
                sx={{ pt: 0, color: C.muted, '&.Mui-checked': { color: C.purple } }}
              />
            }
            label={
              <Typography sx={{ fontSize: '12.5px', color: C.text, lineHeight: 1.5 }}>
                Изрично се съгласявам изпълнението на договора да започне{' '}
                <strong>незабавно след заплащането</strong> и потвърждавам, че по този
                начин <strong>губя правото си на 14-дневен отказ</strong> съгласно
                чл. 57, т. 12 от Закона за защита на потребителите.
              </Typography>
            }
          />

          {/* Checkbox 2 — Terms + Privacy */}
          <FormControlLabel
            sx={{ alignItems: 'flex-start', mb: 1.5, mr: 0 }}
            control={
              <Checkbox
                checked={consentTerms}
                onChange={(e) => setConsentTerms(e.target.checked)}
                sx={{ pt: 0, color: C.muted, '&.Mui-checked': { color: C.purple } }}
              />
            }
            label={
              <Typography sx={{ fontSize: '12.5px', color: C.text, lineHeight: 1.5 }}>
                Прочетох и приемам{' '}
                <Link
                  component="button"
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowTerms(true) }}
                  sx={{ color: C.purple, fontWeight: 700, textDecoration: 'underline' }}
                >
                  Общите условия
                </Link>
                {' '}и{' '}
                <Link
                  component="button"
                  type="button"
                  onClick={(e) => { e.preventDefault(); setShowPrivacy(true) }}
                  sx={{ color: C.purple, fontWeight: 700, textDecoration: 'underline' }}
                >
                  Политиката за поверителност
                </Link>
                .
              </Typography>
            }
          />

          {/* Checkbox 3 — Health self-declaration */}
          <FormControlLabel
            sx={{ alignItems: 'flex-start', mb: 2, mr: 0 }}
            control={
              <Checkbox
                checked={consentHealth}
                onChange={(e) => setConsentHealth(e.target.checked)}
                sx={{ pt: 0, color: C.muted, '&.Mui-checked': { color: C.purple } }}
              />
            }
            label={
              <Typography sx={{ fontSize: '12.5px', color: C.text, lineHeight: 1.5 }}>
                Декларирам, че <strong>нямам медицински противопоказания</strong> за
                участие във фитнес и хранителен план и при необходимост съм
                консултирал/а лекар. Разбирам, че SYNRG не предоставя медицински
                услуги.
              </Typography>
            }
          />

          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            p: 1.25, borderRadius: '10px',
            background: C.primaryA3, border: `1px solid ${C.border}`,
          }}>
            <LockIcon sx={{ fontSize: 14, color: C.muted }} />
            <Typography sx={{ fontSize: '11px', color: C.muted, lineHeight: 1.4 }}>
              Плащането се обработва сигурно от Stripe. Не съхраняваме данни на твоята карта.
            </Typography>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 0, flexDirection: 'column', gap: 1 }}>
          <Button
            onClick={handleConfirm}
            variant="contained"
            color="primary"
            fullWidth
            disabled={!allChecked || loading}
            sx={{
              fontWeight: 800,
              py: 1.5,
              background: allChecked ? `linear-gradient(135deg, ${C.purple} 0%, ${C.primary} 100%)` : undefined,
            }}
          >
            {loading ? 'Подготовка...' : 'Към плащането'}
          </Button>
          <Button
            onClick={handleClose}
            disabled={loading}
            sx={{ color: C.muted, fontWeight: 600, fontSize: '13px' }}
          >
            Отказ
          </Button>
        </DialogActions>
      </Dialog>

      <TermsDialog open={showTerms} onClose={() => setShowTerms(false)} />
      <PrivacyPolicyDialog open={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </>
  )
}
