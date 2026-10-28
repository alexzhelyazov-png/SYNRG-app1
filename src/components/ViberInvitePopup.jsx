import { Dialog, DialogContent, Box, Typography, Button } from '@mui/material'
import GroupsIcon from '@mui/icons-material/Groups'
import { VIBER_GROUP_URL } from '../lib/constants'
import { C } from '../theme'

// Forces an explicit answer — no X, no backdrop/escape dismiss. Either button
// marks the invite as permanently seen (see Dashboard.jsx), so this is the
// client's one and only chance to react to it; there's no persistent nav
// button as a fallback, by design.
export default function ViberInvitePopup({ open, onAlreadyIn, onJoin, t }) {
  return (
    <Dialog open={open} disableEscapeKeyDown onClose={() => {}} maxWidth="xs" fullWidth
      PaperProps={{ sx: {
        borderRadius: '20px', background: C.cardHigh, border: `1px solid ${C.border}`,
        boxShadow: '0 24px 60px rgba(0,0,0,0.4)',
      } }}
    >
      <DialogContent sx={{ p: 3, pt: 4, textAlign: 'center' }}>
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Button
            fullWidth variant="contained"
            component="a" href={VIBER_GROUP_URL} target="_blank" rel="noopener"
            onClick={onJoin}
            sx={{ py: 1.4, fontWeight: 700, fontSize: '14px' }}
          >
            {t('viberJoinBtn')}
          </Button>
          <Button fullWidth variant="outlined" onClick={onAlreadyIn}
            sx={{ py: 1.2, fontWeight: 600, fontSize: '13.5px', color: C.muted, borderColor: C.border }}
          >
            {t('viberAlreadyInBtn')}
          </Button>
        </Box>
      </DialogContent>
    </Dialog>
  )
}
