import { useEffect } from 'react'
import { Box, Typography, Paper } from '@mui/material'
import NotificationsNoneIcon from '@mui/icons-material/NotificationsNone'
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1'
import AssignmentIcon from '@mui/icons-material/Assignment'
import ThumbUpAltIcon from '@mui/icons-material/ThumbUpAlt'
import { useApp } from '../context/AppContext'
import { C, EASE } from '../theme'

const ACTION_ICONS = {
  task:         AssignmentIcon,
  reaction:     ThumbUpAltIcon,
  registration: PersonAddAlt1Icon,
}

function timeAgo(dateStr, t) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins  = Math.floor(diff / 60000)
  if (mins < 1)  return t('justNow')
  if (mins < 60) return `${mins} ${t('minutesAgo')}`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} ${t('hoursAgo')}`
  const days = Math.floor(hrs / 24)
  return `${days} ${t('daysAgo')}`
}

export default function Notifications() {
  const { auth, notifications, markNotifsRead, t } = useApp()

  useEffect(() => { markNotifsRead() }, [])

  return (
    <Box sx={{ maxWidth: '640px', mx: 'auto' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 3 }}>
        <NotificationsNoneIcon sx={{ fontSize: '28px', color: C.primary }} />
        <Typography variant="h2">{t('navNotifications')}</Typography>
      </Box>

      {notifications.length === 0 ? (
        <Paper sx={{
          p: 4, textAlign: 'center',
          border: `1px solid ${C.border}`, borderRadius: '16px',
        }}>
          <NotificationsNoneIcon sx={{ fontSize: '48px', color: C.muted, mb: 1 }} />
          <Typography sx={{ color: C.muted, fontSize: '14px' }}>
            {t('noNotifications')}
          </Typography>
        </Paper>
      ) : (
        <Box sx={{ display: 'grid', gap: 1 }}>
          {notifications.map((n, i) => {
            const isOwn   = n.from_coach === auth.name
            const Icon    = ACTION_ICONS[n.action_type] || NotificationsNoneIcon
            const isNew   = !isOwn

            return (
              <Paper key={n.id || i} sx={{
                p: 2, display: 'flex', gap: 1.75, alignItems: 'flex-start',
                border: `1px solid ${isNew ? C.primaryA20 : C.border}`,
                borderRadius: '14px',
                background: isNew ? C.accentSoft : 'transparent',
                transition: `all 0.18s ${EASE.standard}`,
              }}>
                {/* Icon */}
                <Box sx={{
                  width: 40, height: 40, borderRadius: '12px', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: n.action_type === 'registration'
                    ? 'rgba(196,233,191,0.12)'
                    : n.action_type === 'task'
                      ? 'rgba(200,197,255,0.12)'
                      : 'rgba(255,255,255,0.05)',
                  border: `1px solid ${
                    n.action_type === 'registration' ? 'rgba(196,233,191,0.2)'
                    : n.action_type === 'task' ? 'rgba(200,197,255,0.2)'
                    : C.border
                  }`,
                }}>
                  <Icon sx={{
                    fontSize: '20px',
                    color: n.action_type === 'registration' ? C.primary
                         : n.action_type === 'task' ? C.purple
                         : C.muted,
                  }} />
                </Box>

                {/* Content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 700, color: isNew ? C.primary : C.text }}>
                      {n.from_coach}
                    </Typography>
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>
                      → {n.client_name}
                    </Typography>
                  </Box>
                  <Typography sx={{ fontSize: '13px', color: C.text, mb: 0.5 }}>
                    {n.action_type === 'task' && <Box component="span" sx={{ color: C.purple, fontWeight: 600 }}>{t('taskNotifLbl')}: </Box>}
                    {n.action_type === 'reaction' && <Box component="span" sx={{ color: C.muted, fontWeight: 600 }}>{t('reactionNotifLbl')}: </Box>}
                    {n.action_type === 'registration' && <Box component="span" sx={{ color: C.primary, fontWeight: 600 }}>{t('registrationNotifLbl')}: </Box>}
                    {n.content}
                  </Typography>
                  {n.created_at && (
                    <Typography sx={{ fontSize: '11px', color: C.muted }}>
                      {timeAgo(n.created_at, t)}
                    </Typography>
                  )}
                </Box>
              </Paper>
            )
          })}
        </Box>
      )}
    </Box>
  )
}
