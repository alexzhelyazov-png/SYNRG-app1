import { Box, Paper, Typography } from '@mui/material'
import CreditCardIcon from '@mui/icons-material/CreditCard'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

/**
 * Red-tinted banner shown when the current client has no active plan.
 * `cta` selects which contact-us message to show: 'booking' | 'programs'.
 */
export default function NoPlanBanner({ cta = 'booking', sx = {} }) {
  const { t } = useApp()
  const ctaKey = cta === 'programs' ? 'noPlanContactPrograms' : 'noPlanContactBooking'
  return (
    <Paper sx={{
      p: 2.5, mb: 2, borderRadius: '16px',
      border: '1px solid rgba(248,113,113,0.3)',
      background: 'rgba(248,113,113,0.06)',
      ...sx,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <CreditCardIcon sx={{ fontSize: 18, color: '#F87171' }} />
        <Typography sx={{ fontWeight: 800, fontSize: '14px', color: '#F87171' }}>
          {t('noPlan')}
        </Typography>
      </Box>
      <Typography sx={{ fontSize: '13px', color: C.muted, lineHeight: 1.5 }}>
        {t(ctaKey)}
      </Typography>
    </Paper>
  )
}
