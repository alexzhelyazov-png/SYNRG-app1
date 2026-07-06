import { Box, Typography } from '@mui/material'
import EmojiEventsOutlinedIcon from '@mui/icons-material/EmojiEventsOutlined'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

// Small info banner shown on the trackers (weight / steps / food) explaining
// that logging data earns XP toward the monthly ranking, where the top three
// win a prize each month.
export default function RankingHint({ messageBg, messageEn }) {
  const { lang } = useApp()
  const text = lang === 'en'
    ? (messageEn || 'Every entry you log earns points in the ranking. Each month the top three win a prize.')
    : (messageBg || 'Всяко записване ти носи точки в класацията. Всеки месец първите трима печелят награда.')
  return (
    <Box sx={{
      display: 'flex', alignItems: 'center', gap: 1,
      mb: 2, px: 1.5, py: 1, borderRadius: '10px',
      background: 'rgba(255,208,112,0.08)',
      border: '1px solid rgba(255,208,112,0.25)',
    }}>
      <EmojiEventsOutlinedIcon sx={{ fontSize: 18, color: '#FFD070', flexShrink: 0 }} />
      <Typography sx={{ fontSize: '12px', color: C.text, lineHeight: 1.4, flex: 1 }}>
        {text}
      </Typography>
    </Box>
  )
}
