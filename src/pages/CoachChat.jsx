import { useEffect, useRef, useState } from 'react'
import {
  Box, Typography, TextField, IconButton, Paper, Button, CircularProgress,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import { hasModule } from '../lib/modules'

export default function CoachChat() {
  const {
    auth, client, coaches, setView,
    coachMessages, coachMsgsLoaded, sendCoachMessage, markCoachMessagesRead, t,
  } = useApp()

  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  const assignedCoachId = client?.assigned_coach_id || null
  const assignedCoach   = assignedCoachId
    ? coaches.find(c => c.id === assignedCoachId)
    : null

  // Only for this client (safety filter — context polls just this client's rows, but double-check)
  const thread = (coachMessages || []).filter(m => m.client_id === auth.id)

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.length])

  // Mark as read on mount + whenever new unread appears
  useEffect(() => {
    if (!auth.id) return
    markCoachMessagesRead(auth.id)
  }, [auth.id, thread.length, markCoachMessagesRead])

  // ─── Access gate ────────────────────────────────────────────
  if (!hasModule(auth.modules, 'synrg_method')) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography sx={{ fontSize: 16, color: C.muted }}>
          Чатът с треньор е достъпен само в SYNRG Метод.
        </Typography>
        <Button
          variant="contained"
          onClick={() => setView('programs')}
          sx={{ mt: 2, bgcolor: C.purple, '&:hover': { bgcolor: C.purple } }}
        >
          Виж SYNRG Метод
        </Button>
      </Box>
    )
  }

  // ─── No coach assigned yet ──────────────────────────────────
  if (!assignedCoach) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <IconButton onClick={() => setView('dashboard')} sx={{ position: 'absolute', left: 8, top: 8, color: C.muted }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ mt: 8 }}>
          <Typography sx={{ fontSize: 18, fontWeight: 700, color: C.text, mb: 1 }}>
            Твоят треньор предстои да ти бъде назначен
          </Typography>
          <Typography sx={{ fontSize: 14, color: C.muted }}>
            До 24 часа ще получиш съобщение от личния си ментор с план за стартиране.
          </Typography>
        </Box>
      </Box>
    )
  }

  async function handleSend() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setDraft('')
    try {
      await sendCoachMessage({
        clientId: auth.id,
        coachId:  assignedCoachId,
        text,
      })
    } finally {
      setSending(false)
    }
  }

  return (
    <Box sx={{
      display: 'flex', flexDirection: 'column',
      height: 'calc(100vh - var(--app-header-h, 96px))',
      maxHeight: '100%',
    }}>
      {/* ─── Header ──────────────────────────────── */}
      <Box sx={{
        display: 'flex', alignItems: 'center', gap: 1.5,
        px: 2, py: 1.5,
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}>
        <IconButton onClick={() => setView('dashboard')} size="small" sx={{ color: C.muted }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{
          width: 40, height: 40, borderRadius: '50%',
          background: C.purpleSoft, border: `1px solid rgba(200,197,255,0.2)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Typography sx={{ color: C.purple, fontWeight: 800, fontSize: 16 }}>
            {assignedCoach.name?.[0] || '?'}
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.text, lineHeight: 1.2 }}>
            {assignedCoach.name}
          </Typography>
          <Typography sx={{ fontSize: 11, color: C.muted, letterSpacing: '0.04em' }}>
            Твоят ментор
          </Typography>
        </Box>
      </Box>

      {/* ─── Messages ────────────────────────────── */}
      <Box
        ref={scrollRef}
        sx={{
          flex: 1, overflowY: 'auto', px: 2, py: 2,
          display: 'flex', flexDirection: 'column', gap: 1,
        }}
      >
        {!coachMsgsLoaded && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
            <CircularProgress size={22} sx={{ color: C.purple }} />
          </Box>
        )}
        {coachMsgsLoaded && thread.length === 0 && (
          <Typography sx={{ fontSize: 13, color: C.muted, textAlign: 'center', mt: 4 }}>
            Все още няма съобщения. Напиши нещо на {assignedCoach.name}.
          </Typography>
        )}
        {thread.map(m => {
          const isMe = m.sender_role === 'client'
          const isAdmin = m.sender_role === 'admin'
          return (
            <Box
              key={m.id}
              sx={{
                alignSelf: isMe ? 'flex-end' : 'flex-start',
                maxWidth: '78%',
              }}
            >
              <Paper elevation={0} sx={{
                px: 1.5, py: 1,
                borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                background: isMe ? C.purple : (isAdmin ? '#3b2a1f' : C.surface),
                color: isMe ? '#fff' : C.text,
                border: isMe ? 'none' : `1px solid ${C.border}`,
              }}>
                {isAdmin && (
                  <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', mb: 0.25, letterSpacing: '0.04em' }}>
                    {m.sender_name || 'Собственик'}
                  </Typography>
                )}
                <Typography sx={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.text}
                </Typography>
              </Paper>
              <Typography sx={{ fontSize: 10, color: C.muted, mt: 0.25, textAlign: isMe ? 'right' : 'left' }}>
                {new Date(m.created_at).toLocaleString('bg-BG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
              </Typography>
            </Box>
          )
        })}
      </Box>

      {/* ─── Composer ────────────────────────────── */}
      <Box sx={{
        display: 'flex', gap: 1, px: 1.5, py: 1,
        borderTop: `1px solid ${C.border}`,
        background: C.surface,
        paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
      }}>
        <TextField
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
          placeholder="Съобщение…"
          multiline
          maxRows={4}
          size="small"
          fullWidth
          disabled={sending}
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: '14px',
              background: C.background,
              fontSize: 14,
            },
          }}
        />
        <IconButton
          onClick={handleSend}
          disabled={!draft.trim() || sending}
          sx={{
            color: '#fff',
            background: C.purple,
            borderRadius: '12px',
            width: 44, height: 44,
            alignSelf: 'flex-end',
            '&:hover': { background: C.purple, opacity: 0.9 },
            '&:disabled': { background: C.border, color: C.muted },
          }}
        >
          {sending ? <CircularProgress size={18} sx={{ color: '#fff' }} /> : <SendIcon fontSize="small" />}
        </IconButton>
      </Box>
    </Box>
  )
}
