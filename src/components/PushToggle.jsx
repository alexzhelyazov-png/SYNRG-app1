import { useState, useEffect } from 'react'
import { Box, Typography, Switch, Paper } from '@mui/material'
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import { getPushState, getExistingSubscription, subscribeToPush, unsubscribeFromPush, isStandalone } from '../lib/push'

/**
 * Phone-notification opt-in.
 *
 * `card` renders it as a standalone Paper (the Notifications page); otherwise
 * it's a bare row meant to sit inside an existing settings panel.
 *
 * The subscription binds to the LOGGED-IN account, never to a client record a
 * coach happens to be viewing — otherwise a coach reading someone's tracker
 * would point their own phone at that client's notifications.
 */
export default function PushToggle({ card = false }) {
  const { auth, t } = useApp()
  const [state, setState] = useState('default')
  const [on,    setOn]    = useState(false)
  const [busy,  setBusy]  = useState(false)
  const [msg,   setMsg]   = useState(null)

  const [diag, setDiag] = useState('')

  useEffect(() => {
    setState(getPushState())
    getExistingSubscription().then(sub => setOn(!!sub))
    // Which capability is actually missing — so an "unsupported" report can be
    // diagnosed from a screenshot instead of a round of guessing.
    setDiag([
      'serviceWorker' in navigator ? 'sw' : 'no-sw',
      'PushManager'   in window    ? 'pm' : 'no-pm',
      'Notification'  in window    ? 'n'  : 'no-n',
      isStandalone() ? 'standalone' : 'browser',
    ].join(' '))
  }, [])

  async function toggle(next) {
    setBusy(true); setMsg(null)
    if (next) {
      const r = await subscribeToPush(auth.id)
      setState(getPushState())
      if (r.ok) { setOn(true);  setMsg(t('pushEnabled')) }
      else      { setOn(false); setMsg(r.reason === 'denied' ? null : t('pushFailed')) }
    } else {
      await unsubscribeFromPush()
      setOn(false)
    }
    setBusy(false)
  }

  // Never disappear silently. A missing card is indistinguishable from a stale
  // bundle or a broken build, and on iOS the interesting cases (no Home Screen
  // install, pre-16.4 Safari) are exactly the ones worth explaining.
  const hint = state === 'needs-install' ? t('pushNeedsInstall')
    : state === 'denied'                 ? t('pushDeniedHint')
    : state === 'unsupported'            ? `${t('pushUnsupported')} (${diag})`
    : msg

  const body = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.75, gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
          {card && <NotificationsActiveIcon sx={{ fontSize: '20px', color: on ? C.primary : C.muted, flexShrink: 0 }} />}
          <Typography sx={{ fontSize: card ? '14.5px' : '13.5px', fontWeight: 700 }}>
            {t('pushToggleLbl')}
          </Typography>
        </Box>
        <Switch
          size="small"
          checked={on}
          disabled={busy || state === 'denied' || state === 'needs-install' || state === 'unsupported'}
          onChange={e => toggle(e.target.checked)}
          sx={{
            '& .MuiSwitch-switchBase.Mui-checked': { color: C.primary },
            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { background: C.primary },
          }}
        />
      </Box>
      {hint && (
        <Typography sx={{ fontSize: '11.5px', color: C.muted, lineHeight: 1.5 }}>{hint}</Typography>
      )}
    </>
  )

  if (!card) return <Box sx={{ pb: 1, mb: 1, borderBottom: `1px solid ${C.border}` }}>{body}</Box>

  return (
    <Paper sx={{ p: 2, mb: 2.5, border: `1px solid ${C.border}`, borderRadius: '16px' }}>{body}</Paper>
  )
}
