import { Dialog, DialogContent, Box, Typography, Button, IconButton } from '@mui/material'
import CloseIcon  from '@mui/icons-material/Close'
import GroupsIcon from '@mui/icons-material/Groups'
import { VIBER_GROUP_URL } from '../lib/constants'
import { C } from '../theme'

export default function ViberInvitePopup({ open, onClose, t }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth
      PaperProps={{ sx: {
        borderRadius: '20px', background: C.cardHigh, border: `1px solid ${C.border}`,
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      } }}
    >
      <DialogContent sx={{ p: 3, pt: 4, textAlign: 'center', position: 'relative' }}>
        <IconButton onClick={onClose} size="small"
          sx={{ position: 'absolute', top: 8, right: 8, color: C.muted }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>

        <Box sx={{
          width: 56, height: 56, borderRadius: '50%', background: C.accentSoft,
          display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2,
        }}>
          <GroupsIcon sx={{ fontSize: 28, color: C.primary }} />
        </Box>

        <Typography variant="h3" sx={{ mb: 1 }}>{t('viberJoinTitle')}</Typography>
        <Typography sx={{ fontSize: '13px', color: C.muted, mb: 2.5, lineHeight: 1.6 }}>
          {t('viberJoinBody')}
        </Typography>

        <Button
          fullWidth variant="contained"
          component="a" href={VIBER_GROUP_URL} target="_blank" rel="noopener"
          onClick={onClose}
          sx={{ py: 1.4, fontWeight: 700, fontSize: '14px' }}
        >
          {t('viberJoinBtn')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
