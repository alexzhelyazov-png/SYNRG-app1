import { useState, useEffect } from 'react'
import { Box, Typography } from '@mui/material'
import { useApp } from '../context/AppContext'
import { useBooking } from '../context/BookingContext'
import { C } from '../theme'
import { DB } from '../lib/db'

const PLAN_LABELS = { '8': 'FLEX', '12': 'PROGRESS', 'unlimited': 'PLUS' }
const PLAN_COLORS = { '8': C.logan, '12': C.primary, 'unlimited': '#c4e9bf' }

export default function SubscriptionsTab({ t, lang }) {
  const { realClients } = useApp()
  const [allPlans, setAllPlans] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    DB.selectAll('client_plans').then(plans => {
      setAllPlans(plans.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
      setLoading(false)
    })
  }, [])

  const getName = (clientId) => {
    const c = realClients.find(c => c.id === clientId)
    return c ? c.name : clientId?.slice(0, 8)
  }

  const formatDate = (d) => {
    if (!d) return '-'
    return new Date(d).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  const timeSince = (d) => {
    if (!d) return ''
    const diff = Date.now() - new Date(d).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 60) return `${mins} ${lang === 'en' ? 'min ago' : 'мин'}`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs} ${lang === 'en' ? 'hr ago' : 'ч'}`
    const days = Math.floor(hrs / 24)
    return `${days} ${lang === 'en' ? 'd ago' : 'д'}`
  }

  // Find duplicates: clients with more than 1 active plan
  const activePlans = allPlans.filter(p => p.status === 'active')
  const clientPlanCount = {}
  activePlans.forEach(p => {
    clientPlanCount[p.client_id] = (clientPlanCount[p.client_id] || 0) + 1
  })
  const duplicateClientIds = Object.entries(clientPlanCount)
    .filter(([, count]) => count > 1)
    .map(([id]) => id)

  if (loading) return <Typography sx={{ color: C.muted, py: 4, textAlign: 'center' }}>...</Typography>

  return (
    <Box>
      {/* Duplicate warnings */}
      {duplicateClientIds.length > 0 && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '12px',
          background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)',
        }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#e05252', mb: 1 }}>
            {lang === 'en' ? 'Duplicate active plans detected:' : 'Открити дублирани активни планове:'}
          </Typography>
          {duplicateClientIds.map(id => {
            const plans = activePlans.filter(p => p.client_id === id)
            return (
              <Box key={id} sx={{ mb: 1 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                  {getName(id)} — {plans.length} {lang === 'en' ? 'active plans' : 'активни плана'}
                </Typography>
                {plans.map(p => (
                  <Typography key={p.id} sx={{ fontSize: '12px', color: C.muted, pl: 2 }}>
                    {PLAN_LABELS[p.plan_type] || p.plan_type} | {formatDate(p.valid_from)} - {formatDate(p.valid_to)} | {p.credits_used}/{p.credits_total} {lang === 'en' ? 'used' : 'изп.'}
                  </Typography>
                ))}
              </Box>
            )
          })}
        </Box>
      )}

      {/* All plans - newest first */}
      <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px', mb: 1.5 }}>
        {lang === 'en' ? `All subscriptions (${allPlans.length})` : `Всички абонаменти (${allPlans.length})`}
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {allPlans.map(p => {
          const isActive = p.status === 'active'
          const isDuplicate = duplicateClientIds.includes(p.client_id) && isActive
          const remaining = p.plan_type === 'unlimited' ? null : p.credits_total - p.credits_used
          const planColor = PLAN_COLORS[p.plan_type] || C.muted

          return (
            <Box key={p.id} sx={{
              display: 'flex', alignItems: 'center', gap: 1.5,
              px: 2, py: 1.2, borderRadius: '10px',
              background: isDuplicate ? 'rgba(224,82,82,0.06)' : isActive ? 'rgba(255,255,255,0.02)' : 'transparent',
              border: `1px solid ${isDuplicate ? 'rgba(224,82,82,0.25)' : isActive ? C.border : 'rgba(255,255,255,0.03)'}`,
              opacity: isActive ? 1 : 0.5,
            }}>
              {/* Status dot */}
              <Box sx={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: isActive ? '#4ade80' : C.muted,
              }} />

              {/* Plan badge */}
              <Box sx={{
                px: 1, py: 0.25, borderRadius: '6px', fontSize: '11px', fontWeight: 800,
                background: `${planColor}18`, color: planColor, minWidth: 55, textAlign: 'center',
              }}>
                {PLAN_LABELS[p.plan_type] || p.plan_type}
              </Box>

              {/* Client name */}
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text, flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getName(p.client_id)}
              </Typography>

              {/* Credits */}
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, whiteSpace: 'nowrap' }}>
                {remaining !== null
                  ? `${remaining}/${p.credits_total}`
                  : (lang === 'en' ? 'unlim' : 'безл.')
                }
              </Typography>

              {/* Paid indicator */}
              <Box sx={{
                fontSize: '10px', fontWeight: 700, px: 0.75, py: 0.15, borderRadius: '4px',
                background: p.is_paid ? 'rgba(74,222,128,0.12)' : 'rgba(224,82,82,0.12)',
                color: p.is_paid ? '#4ade80' : '#e05252',
              }}>
                {p.is_paid ? (lang === 'en' ? 'PAID' : 'ПЛ.') : (lang === 'en' ? 'UNPAID' : 'НЕПЛ.')}
              </Box>

              {/* Date */}
              <Typography sx={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>
                {formatDate(p.valid_from)} - {formatDate(p.valid_to)}
              </Typography>

              {/* Time since created */}
              <Typography sx={{ fontSize: '10px', color: C.muted, whiteSpace: 'nowrap', minWidth: 40 }}>
                {timeSince(p.created_at)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
