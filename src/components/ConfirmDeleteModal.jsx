import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, Typography,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

export default function ConfirmDeleteModal() {
  const { confirmDelete, setConfirmDelete, deleteClient, t } = useApp()

  if (!confirmDelete) return null

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
