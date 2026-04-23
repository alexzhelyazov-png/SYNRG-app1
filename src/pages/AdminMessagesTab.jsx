import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box, Typography, TextField, IconButton, Paper, Button, Divider, Chip,
} from '@mui/material'
import SendIcon from '@mui/icons-material/Send'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import { useApp } from '../context/AppContext'
import { isAdmin, isFullAdmin } from '../lib/bookingUtils'
import { C } from '../theme'

// ── Admin Messages Tab ────────────────────────────────────────
// For coach (shows only their assigned clients) and admin (shows all).
// Admin can filter by coach; messages from admin get a distinct gold badge.
export default function AdminMessagesTab() {
  const {
    auth, clients, coaches,
    coachMessages, coachMsgsLoaded,
    sendCoachMessage, markCoachMessagesRead,
  } = useApp()

  // Admin status is determined by name (role is 'coach' for everyone in coaches table)
  const isAdminUser = isAdmin(auth) || isFullAdmin(auth) || auth.role === 'admin'
  const [selectedClientId, setSelectedClientId] = useState(null)
  const [coachFilter, setCoachFilter] = useState('all') // admin only
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef(null)

  // Real (non-shadow) clients with at least some chat context:
  //   - Coach (non-admin): only their assigned
  //   - Admin: all (respecting coachFilter)
  const eligibleClients = useMemo(() => {
    const real = clients.filter(c => !c.is_coach && c.id)
    if (!isAdminUser) {
      return real.filter(c => c.assigned_coach_id === auth.id)
    }
    if (coachFilter === 'all')         return real
    if (coachFilter === 'unassigned')  return real.filter(c => !c.assigned_coach_id)
    return real.filter(c => c.assigned_coach_id === coachFilter)
  }, [clients, isAdminUser, auth.id, coachFilter])

  // Compute per-client chat summary
  const clientRows = useMemo(() => {
    return eligibleClients.map(c => {
      const msgs = coachMessages.filter(m => m.client_id === c.id)
      const last = msgs.length ? msgs[msgs.length - 1] : null
      const unread = msgs.filter(m => m.sender_role === 'client' && !m.read_at).length
      return { client: c, last, unread, hasMessages: msgs.length > 0 }
    }).sort((a, b) => {
      // Unread first, then most recent message, then name
      if (a.unread !== b.unread) return b.unread - a.unread
      const ta = a.last?.created_at || ''
      const tb = b.last?.created_at || ''
      if (ta !== tb) return tb.localeCompare(ta)
      return (a.client.name || '').localeCompare(b.client.name || '', 'bg')
    })
  }, [eligibleClients, coachMessages])

  const selected = selectedClientId ? clients.find(c => c.id === selectedClientId) : null
  const thread = selected
    ? coachMessages.filter(m => m.client_id === selected.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    : []

  // Scroll to bottom when thread updates
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [thread.length, selectedClientId])

  // Mark as read when opening a thread
  useEffect(() => {
    if (selectedClientId) markCoachMessagesRead(selectedClientId)
  }, [selectedClientId, thread.length, markCoachMessagesRead])

  async function handleSend() {
    const text = draft.trim()
    if (!text || !selected || sending) return
    // For admin sending on behalf: use the assigned_coach_id, else fallback to current user.
    const coachId = selected.assigned_coach_id || (!isAdminUser ? auth.id : null)
    if (!coachId) {
      alert('Клиентът няма назначен треньор. Първо му назначи треньор.')
      return
    }
    setSending(true)
    setDraft('')
    try {
      await sendCoachMessage({
        clientId: selected.id,
        coachId,
        text,
      })
    } finally {
      setSending(false)
    }
  }

  // ── Detail view ─────────────────────────────────────────────
  if (selected) {
    const assignedCoach = selected.assigned_coach_id ? coaches.find(c => c.id === selected.assigned_coach_id) : null
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 220px)', minHeight: 420 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.5, borderBottom: `1px solid ${C.border}` }}>
          <IconButton onClick={() => setSelectedClientId(null)} size="small" sx={{ color: C.muted }}>
            <ArrowBackIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: 15, fontWeight: 700, color: C.text }}>{selected.name}</Typography>
            <Typography sx={{ fontSize: 11, color: C.muted }}>
              Треньор: {assignedCoach?.name || <span style={{ color: '#ff6b6b' }}>не е назначен</span>}
            </Typography>
          </Box>
        </Box>

        {/* Messages */}
        <Box
          ref={scrollRef}
          sx={{ flex: 1, overflowY: 'auto', px: 2, py: 2, display: 'flex', flexDirection: 'column', gap: 1 }}
        >
          {thread.length === 0 && (
            <Typography sx={{ fontSize: 13, color: C.muted, textAlign: 'center', mt: 3 }}>
              Няма съобщения с този клиент.
            </Typography>
          )}
          {thread.map(m => {
            const isClient = m.sender_role === 'client'
            const isAdminMsg = m.sender_role === 'admin'
            return (
              <Box key={m.id} sx={{ alignSelf: isClient ? 'flex-start' : 'flex-end', maxWidth: '78%' }}>
                <Paper elevation={0} sx={{
                  px: 1.5, py: 1,
                  borderRadius: isClient ? '14px 14px 14px 4px' : '14px 14px 4px 14px',
                  background: isClient ? C.surface : (isAdminMsg ? '#3b2a1f' : C.purple),
                  color: isClient ? C.text : '#fff',
                  border: isClient ? `1px solid ${C.border}` : 'none',
                }}>
                  {isAdminMsg && (
                    <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#fbbf24', mb: 0.25, letterSpacing: '0.04em' }}>
                      {m.sender_name || 'Собственик'}
                    </Typography>
                  )}
                  <Typography sx={{ fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text}
                  </Typography>
                </Paper>
                <Typography sx={{ fontSize: 10, color: C.muted, mt: 0.25, textAlign: isClient ? 'left' : 'right' }}>
                  {new Date(m.created_at).toLocaleString('bg-BG', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                </Typography>
              </Box>
            )
          })}
        </Box>

        {/* Composer */}
        <Box sx={{ display: 'flex', gap: 1, px: 1.5, py: 1, borderTop: `1px solid ${C.border}` }}>
          <TextField
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder={isAdminUser ?'Пишеш като собственик (жълто)...' : 'Съобщение…'}
            multiline
            maxRows={4}
            size="small"
            fullWidth
            disabled={sending}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: '14px', fontSize: 14 } }}
          />
          <IconButton
            onClick={handleSend}
            disabled={!draft.trim() || sending}
            sx={{
              color: '#fff',
              background: isAdminUser ?'#d97706' : C.purple,
              borderRadius: '12px',
              width: 44, height: 44,
              alignSelf: 'flex-end',
              '&:hover': { background: isAdminUser ?'#d97706' : C.purple, opacity: 0.9 },
              '&:disabled': { background: C.border, color: C.muted },
            }}
          >
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    )
  }

  // ── List view ───────────────────────────────────────────────
  return (
    <Box>
      <Typography sx={{ fontSize: 18, fontWeight: 800, color: C.text, mb: 2 }}>
        Съобщения
      </Typography>

      {/* Admin coach filter */}
      {isAdmin && (
        <Box sx={{ display: 'flex', gap: 0.75, mb: 2, flexWrap: 'wrap' }}>
          <FilterChip active={coachFilter === 'all'} onClick={() => setCoachFilter('all')}>
            Всички
          </FilterChip>
          {coaches.filter(c => !/^Админ/i.test(c.name)).map(c => {
            const count = clients.filter(cl => !cl.is_coach && cl.assigned_coach_id === c.id).length
            return (
              <FilterChip key={c.id} active={coachFilter === c.id} onClick={() => setCoachFilter(c.id)}>
                {c.name} ({count})
              </FilterChip>
            )
          })}
          <FilterChip active={coachFilter === 'unassigned'} onClick={() => setCoachFilter('unassigned')}>
            Без треньор
          </FilterChip>
        </Box>
      )}

      {!coachMsgsLoaded && (
        <Typography sx={{ color: C.muted, fontSize: 13, py: 2 }}>Зареждане…</Typography>
      )}

      <Paper sx={{ overflow: 'hidden' }}>
        {clientRows.length === 0 && coachMsgsLoaded && (
          <Typography sx={{ p: 2, color: C.muted, fontSize: 13 }}>
            Няма клиенти в този филтър.
          </Typography>
        )}
        {clientRows.map((row, i) => {
          const { client: c, last, unread } = row
          const assigned = c.assigned_coach_id ? coaches.find(k => k.id === c.assigned_coach_id) : null
          return (
            <Box key={c.id}>
              <Box
                onClick={() => setSelectedClientId(c.id)}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5,
                  px: 2, py: 1.5, cursor: 'pointer',
                  '&:hover': { background: 'rgba(255,255,255,0.03)' },
                }}
              >
                <Box sx={{
                  width: 38, height: 38, borderRadius: '50%',
                  background: unread > 0 ? C.purple : C.purpleSoft,
                  border: `1px solid ${unread > 0 ? C.purple : 'rgba(200,197,255,0.2)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Typography sx={{ color: unread > 0 ? '#fff' : C.purple, fontWeight: 800, fontSize: 14 }}>
                    {c.name?.[0] || '?'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: C.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.name}
                    </Typography>
                    {assigned && (
                      <Chip label={assigned.name} size="small" sx={{ height: 18, fontSize: 10, background: C.surface, color: C.muted }} />
                    )}
                    {!assigned && (
                      <Chip label="без треньор" size="small" sx={{ height: 18, fontSize: 10, background: '#3b1f1f', color: '#ff9999' }} />
                    )}
                  </Box>
                  <Typography sx={{ fontSize: 12, color: C.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', mt: 0.25 }}>
                    {last ? (
                      <>
                        <span style={{ fontWeight: 700, color: last.sender_role === 'client' ? C.text : C.muted }}>
                          {last.sender_role === 'client' ? c.name?.split(' ')[0] : 'Ти'}:
                        </span>{' '}
                        {last.text}
                      </>
                    ) : (
                      <span style={{ fontStyle: 'italic' }}>Няма съобщения</span>
                    )}
                  </Typography>
                </Box>
                {unread > 0 && (
                  <Box sx={{
                    minWidth: 22, height: 22, px: 0.75,
                    borderRadius: '11px', background: '#ef4444',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <Typography sx={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>{unread}</Typography>
                  </Box>
                )}
              </Box>
              {i < clientRows.length - 1 && <Divider sx={{ borderColor: C.border, mx: 2 }} />}
            </Box>
          )
        })}
      </Paper>
    </Box>
  )
}

function FilterChip({ active, onClick, children }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        px: 1.25, py: 0.5, borderRadius: '100px', cursor: 'pointer',
        fontSize: 12, fontWeight: 700,
        background: active ? C.purple : 'transparent',
        color:      active ? '#fff' : C.muted,
        border:     `1px solid ${active ? C.purple : C.border}`,
        transition: 'all 0.18s',
        '&:hover':  active ? {} : { color: C.text, borderColor: C.muted },
      }}
    >
      {children}
    </Box>
  )
}
