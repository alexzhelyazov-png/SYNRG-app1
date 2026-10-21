import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useApp } from '../context/AppContext'
import { useBooking } from '../context/BookingContext'
import { C } from '../theme'

export default function ConfirmDeleteModal() {
  const { confirmDelete, setConfirmDelete, deleteClient, t } = useApp()
  const { allPlans } = useBooking()

  if (!confirmDelete) return null

  // Deleting a client hard-deletes their client_plans rows too — if one of
  // those was paid and never refunded, that revenue silently vanishes from
  // Finance. Warn so the admin can use "Възстанови сума" on the plan first
  // instead, but don't block the delete — sometimes it really is a duplicate
  // or test entry with nothing to reconcile.
  const hasUnresolvedPaidPlan = allPlans.some(p =>
    p.client_id === confirmDelete.id && p.is_paid && Number(p.price) > 0 && p.status !== 'refunded'
  )

  async function handleConfirm() {
    await deleteClient(confirmDelete.id)
    setConfirmDelete(null)
  }

  return (
    <Dialog open={!!confirmDelete} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ textAlign: 'center', pb: 0.5 }}>
        <WarningAmberIcon sx={{ fontSize: 36, color: C.orange, display: 'block', mx: 'auto', mb: 1 }} />
        {t('deleteTitle')}
      </DialogTitle>

      <DialogContent>
        <Typography sx={{ color: C.muted, fontSize: '14px', textAlign: 'center', lineHeight: 1.6 }}>
          {t('deleteDesc1')}{' '}
          <span style={{ color: C.danger, fontWeight: 700 }}>{confirmDelete.name}</span>
          {' '}{t('deleteDesc2')}
        </Typography>
        {hasUnresolvedPaidPlan && (
          <Typography sx={{ color: '#F87171', fontSize: '13px', textAlign: 'center', lineHeight: 1.6, mt: 1.5, fontWeight: 600 }}>
            {t('deleteUnrefundedWarning') ||
              'Този клиент има платен план, който не е маркиран като възстановен — изтриването ще заличи тази сума от Финанси. Ако трябва да върнеш пари, използвай "Възстанови сума" на плана вместо директно изтриване.'}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1 }}>
        <Button onClick={() => setConfirmDelete(null)} variant="outlined" fullWidth>
          {t('cancelLbl')}
        </Button>
        <Button onClick={handleConfirm} variant="contained" color="error" fullWidth>
          {t('deleteBtnLbl')}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
