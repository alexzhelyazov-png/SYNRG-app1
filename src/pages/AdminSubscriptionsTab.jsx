import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import { DB } from '../lib/db'
import { FREE_MODULES } from '../lib/modules'

const PLAN_LABELS = { '8': 'FLEX', '12': 'PROGRESS', 'unlimited': 'PLUS' }
const PLAN_COLORS = { '8': C.logan, '12': C.primary, 'unlimited': '#c4e9bf' }

export default function SubscriptionsTab({ t, lang }) {
  const { realClients, showSnackbar, updateClientModules } = useApp()
  const [allPlans, setAllPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [programPurchases, setProgramPurchases] = useState([])
  const [invoices, setInvoices] = useState([])

  const reload = useCallback(() => {
    Promise.all([
      DB.selectAll('client_plans'),
      DB.selectAll('program_purchases').catch(() => []),
      DB.selectAll('invoices', '&order=invoice_number.desc&limit=200').catch(() => []),
    ]).then(([plans, purchases, invs]) => {
      setAllPlans(plans.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || '')))
      setProgramPurchases(purchases.sort((a, b) => (b.purchased_at || b.created_at || '').localeCompare(a.purchased_at || a.created_at || '')))
      setInvoices(invs)
      setLoading(false)
    })
  }, [])

  // CSV export of all invoices for accountant
  const exportInvoicesCSV = () => {
    if (!invoices.length) return
    const lines = ['\uFEFF' + ['Номер', 'Дата', 'Купувач', 'Email', 'Описание', 'Валута', 'Нето', 'ДДС%', 'ДДС', 'Бруто', 'Статус']
      .map(s => `"${s}"`).join(',')]
    for (const inv of invoices) {
      const d = inv.issued_at?.slice(0, 10) || ''
      const net = ((inv.amount_cents - (inv.vat_amount_cents || 0)) / 100).toFixed(2)
      const vat = ((inv.vat_amount_cents || 0) / 100).toFixed(2)
      const gross = (inv.amount_cents / 100).toFixed(2)
      const row = [
        String(inv.invoice_number).padStart(10, '0'),
        d,
        inv.buyer_name || '',
        inv.buyer_email || '',
        inv.description || '',
        inv.currency || 'EUR',
        net, inv.vat_rate || 0, vat, gross,
        inv.status || 'issued',
      ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',')
      lines.push(row)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `synrg-invoices-${new Date().toISOString().slice(0, 10)}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const triggerNapReport = async () => {
    if (!confirm('Изпрати месечния НАП отчет за миналия месец на счетоводителя?')) return
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/monthly-nap-report`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.success) showSnackbar(`НАП отчет: ${data.invoices} фактури · изпратен на счетоводителя`, 'success')
      else showSnackbar('Грешка при генериране на НАП отчет', 'error')
    } catch { showSnackbar('Мрежова грешка', 'error') }
  }

  const openInvoice = async (invoiceId) => {
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/invoices?select=html_content&id=eq.${invoiceId}&limit=1`, {
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
      })
      const data = await res.json()
      const html = data?.[0]?.html_content
      if (!html) return
      const win = window.open('', '_blank')
      win.document.write(html); win.document.close()
    } catch (e) { console.error(e) }
  }

  useEffect(() => { reload() }, [reload])

  // Purchases needing admin attention
  const flaggedPurchases = programPurchases.filter(p =>
    p.status === 'needs_coach' || p.status === 'disputed' || p.status === 'refunded'
  )
  const flagLabel = (s) => ({
    needs_coach: 'Без тренер',
    disputed: 'Chargeback',
    refunded: 'Възстановена',
    expired: 'Изтекла',
  })[s] || s
  const flagColor = (s) => ({
    needs_coach: '#FB923C',
    disputed: '#F87171',
    refunded: '#999',
    expired: '#666',
  })[s] || C.muted

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

  async function handleDeactivate(planId) {
    const plan = allPlans.find(p => p.id === planId)
    await DB.update('client_plans', planId, { status: 'expired' })
    // If client has no other active plan, drop them down to the freemium view.
    if (plan?.client_id) {
      const other = await DB.getClientActivePlan(plan.client_id)
      if (!other) {
        try { await updateClientModules(plan.client_id, [...FREE_MODULES]) } catch { /* non-fatal */ }
      }
    }
    showSnackbar(lang === 'en' ? 'Plan deactivated' : 'Планът е деактивиран')
    reload()
  }

  async function handleDelete(planId) {
    await DB.deleteById('client_plans', planId)
    showSnackbar(lang === 'en' ? 'Plan deleted' : 'Планът е изтрит')
    reload()
  }

  async function handleTogglePaid(planId, currentValue) {
    await DB.update('client_plans', planId, { is_paid: !currentValue })
    reload()
  }

  // Find duplicates
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
      {/* Invoices section — admin tools (CSV export, NAP report) */}
      <Box sx={{
        mb: 2, p: 2, borderRadius: '12px',
        background: 'rgba(196,233,191,0.06)', border: '1px solid rgba(196,233,191,0.2)',
      }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
            Фактури ({invoices.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <button
              onClick={exportInvoicesCSV}
              disabled={!invoices.length}
              style={{
                background: 'rgba(196,233,191,0.15)', border: '1px solid rgba(196,233,191,0.4)',
                color: '#c4e9bf', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                cursor: invoices.length ? 'pointer' : 'not-allowed', opacity: invoices.length ? 1 : 0.4,
              }}
            >
              CSV
            </button>
            <button
              onClick={triggerNapReport}
              style={{
                background: 'rgba(170,169,205,0.15)', border: '1px solid rgba(170,169,205,0.4)',
                color: '#aaa9cd', padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
              }}
            >
              НАП отчет
            </button>
          </Box>
        </Box>
        {invoices.length === 0 ? (
          <Typography sx={{ fontSize: '11px', color: C.muted }}>Няма издадени фактури.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gap: 0.5, maxHeight: 280, overflow: 'auto' }}>
            {invoices.slice(0, 20).map(inv => (
              <Box key={inv.id} sx={{
                display: 'flex', alignItems: 'center', gap: 1, py: 0.5, px: 1,
                borderBottom: `1px solid ${C.border}`, fontSize: '11px',
              }}>
                <Typography sx={{ fontSize: '11px', color: C.muted, fontFamily: 'monospace', minWidth: 90 }}>
                  №{String(inv.invoice_number).padStart(10, '0')}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: C.text, flex: 1 }} noWrap>
                  {inv.buyer_name || 'Физическо лице'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: C.muted }}>
                  {(inv.amount_cents / 100).toFixed(2)} {inv.currency}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: C.muted, minWidth: 70 }}>
                  {inv.issued_at?.slice(0, 10)}
                </Typography>
                <button
                  onClick={() => openInvoice(inv.id)}
                  style={{
                    background: 'transparent', border: '1px solid ' + C.border,
                    color: C.purple, padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Виж
                </button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {/* Program purchases needing attention */}
      {flaggedPurchases.length > 0 && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '12px',
          background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.3)',
        }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#FB923C', mb: 1 }}>
            Покупки изискващи внимание ({flaggedPurchases.length})
          </Typography>
          {flaggedPurchases.map(p => (
            <Box key={p.id} sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Box sx={{
                px: 1, py: 0.25, borderRadius: '8px',
                background: `${flagColor(p.status)}22`,
                border: `1px solid ${flagColor(p.status)}55`,
              }}>
                <Typography sx={{ fontSize: '10px', fontWeight: 800, color: flagColor(p.status), letterSpacing: 0.5, textTransform: 'uppercase' }}>
                  {flagLabel(p.status)}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text }}>
                {getName(p.client_id)}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted }}>
                {(p.amount_cents / 100).toFixed(0)} {p.currency || 'EUR'} · {formatDate(p.purchased_at || p.created_at)}
                {p.status === 'needs_coach' && ' · Auto-assign не успя'}
                {p.status === 'disputed' && ` · Stripe alert ${formatDate(p.disputed_at)}`}
                {p.status === 'refunded' && ` · Refunded ${formatDate(p.refunded_at)}`}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {/* Duplicate warnings */}
      {duplicateClientIds.length > 0 && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '12px',
          background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.3)',
        }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#e05252', mb: 1 }}>
            {lang === 'en' ? 'Duplicate active plans detected:' : 'Дублирани активни планове:'}
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

      {/* All plans */}
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
              display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap',
              px: 2, py: 1, borderRadius: '10px',
              background: isDuplicate ? 'rgba(224,82,82,0.06)' : isActive ? 'rgba(255,255,255,0.02)' : 'transparent',
              border: `1px solid ${isDuplicate ? 'rgba(224,82,82,0.25)' : isActive ? C.border : 'rgba(255,255,255,0.03)'}`,
              opacity: isActive ? 1 : 0.45,
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
              <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.text, flex: 1, minWidth: 80,
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

              {/* Paid - clickable toggle */}
              <Tooltip title={lang === 'en' ? 'Toggle paid status' : 'Смени статус платено'} arrow>
                <Box onClick={() => handleTogglePaid(p.id, p.is_paid)} sx={{
                  fontSize: '10px', fontWeight: 700, px: 0.75, py: 0.15, borderRadius: '4px', cursor: 'pointer',
                  background: p.is_paid ? 'rgba(74,222,128,0.12)' : 'rgba(224,82,82,0.12)',
                  color: p.is_paid ? '#4ade80' : '#e05252',
                  '&:hover': { opacity: 0.7 },
                }}>
                  {p.is_paid ? (lang === 'en' ? 'PAID' : 'ПЛ.') : (lang === 'en' ? 'UNPAID' : 'НЕПЛ.')}
                </Box>
              </Tooltip>

              {/* Date */}
              <Typography sx={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>
                {formatDate(p.valid_from)}
              </Typography>

              {/* Time since */}
              <Typography sx={{ fontSize: '10px', color: C.muted, whiteSpace: 'nowrap', minWidth: 35 }}>
                {timeSince(p.created_at)}
              </Typography>

              {/* Actions */}
              {isActive && (
                <Tooltip title={lang === 'en' ? 'Deactivate' : 'Деактивирай'} arrow>
                  <IconButton size="small" onClick={() => handleDeactivate(p.id)}
                    sx={{ color: '#FB923C', p: 0.4, fontSize: '14px' }}>
                    &#x23F8;
                  </IconButton>
                </Tooltip>
              )}
              <Tooltip title={lang === 'en' ? 'Delete' : 'Изтрий'} arrow>
                <IconButton size="small" onClick={() => {
                  if (window.confirm(lang === 'en'
                    ? `Delete plan for ${getName(p.client_id)}?`
                    : `Изтрий план на ${getName(p.client_id)}?`
                  )) handleDelete(p.id)
                }}
                  sx={{ color: '#e05252', p: 0.4, fontSize: '14px' }}>
                  &#x2715;
                </IconButton>
              </Tooltip>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
}
