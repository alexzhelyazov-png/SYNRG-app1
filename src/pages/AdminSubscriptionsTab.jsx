import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, IconButton, Tooltip } from '@mui/material'
import { useApp } from '../context/AppContext'
import { C } from '../theme'
import { DB } from '../lib/db'
import { FREE_MODULES } from '../lib/modules'

const PLAN_LABELS = {
  '8': 'FLEX', '12': 'PROGRESS', 'unlimited': 'PLUS',
  '4': '4 посещения', '8_new': '8 посещения (нов)', '12_new': '12 посещения (нов)',
}
const PLAN_COLORS = {
  '8': C.logan, '12': C.primary, 'unlimited': '#c4e9bf',
  '4': C.logan, '8_new': C.primary, '12_new': '#c4e9bf',
}

export default function SubscriptionsTab({ t, lang }) {
  const { realClients, showSnackbar, updateClientModules, auth } = useApp()
  const [allPlans, setAllPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [programPurchases, setProgramPurchases] = useState([])
  const [invoices, setInvoices] = useState([])
  const [pendingReviews, setPendingReviews] = useState([])
  const [planFilter, setPlanFilter] = useState('active') // active | unpaid
  const [showHistory, setShowHistory] = useState(false)

  // Last FINANCIAL event on this plan — paid or refunded — not just when the
  // row was first created. Sorting and the "X ago" badge both use this, so
  // marking a plan paid (even days after it was created) brings it to the
  // top instead of staying buried under its stale creation date.
  // Deliberately excludes `updated_at`: that column also gets touched by
  // unrelated things (e.g. credits_used ticking down on a session check-in),
  // which made an old, long-unpaid plan jump to the top just because someone
  // trained — "recent activity" has to mean money, not any DB write.
  const lastActivity = (p) =>
    [p.paid_at, p.refunded_at, p.created_at]
      .filter(Boolean)
      .reduce((max, d) => Math.max(max, new Date(d).getTime()), 0)

  const reload = useCallback(() => {
    Promise.all([
      DB.selectAll('client_plans'),
      DB.selectAll('program_purchases').catch(() => []),
      DB.selectAll('invoices', '&order=invoice_number.desc&limit=200').catch(() => []),
      DB.selectAll('program_reviews', '&status=eq.pending&order=created_at.desc&limit=50').catch(() => []),
    ]).then(([plans, purchases, invs, reviews]) => {
      setAllPlans(plans.sort((a, b) => lastActivity(b) - lastActivity(a)))
      setProgramPurchases(purchases.sort((a, b) => (b.purchased_at || b.created_at || '').localeCompare(a.purchased_at || a.created_at || '')))
      setInvoices(invs)
      setPendingReviews(reviews || [])
      setLoading(false)
    })
  }, [])

  const moderateReview = async (id, newStatus) => {
    // RLS only allows the service role to UPDATE program_reviews, so the
    // direct DB.update from the admin browser fails silently.  We proxy
    // through the moderate-review Edge Function which uses the service
    // key + a shared admin secret for authorization.
    try {
      const SB_URL = import.meta.env.VITE_SUPABASE_URL
      const ADMIN_SECRET = '43513671f56530f3a1c9f2affd33d041a112c3e850f9de78'
      const res = await fetch(`${SB_URL}/functions/v1/moderate-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus, admin_secret: ADMIN_SECRET }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.ok) {
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      showSnackbar(newStatus === 'approved' ? 'Ревюто е одобрено' : 'Ревюто е отхвърлено', 'success')
      reload()
    } catch (err) {
      console.error('moderateReview failed:', err)
      showSnackbar('Грешка при модерация', 'error')
    }
  }

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
    // Guard against the exact mistake that double-counted real revenue twice
    // in production (Мария Славкова, Християн Роев): marking a SECOND plan
    // paid for the same client within a short window, when it's really the
    // same cash handover. Doesn't block it — some clients genuinely buy twice
    // same day — just makes the admin confirm.
    if (!currentValue) {
      const plan = allPlans.find(p => p.id === planId)
      const recentOther = plan && allPlans.find(p =>
        p.id !== planId && p.client_id === plan.client_id && p.is_paid && p.paid_at &&
        (Date.now() - new Date(p.paid_at).getTime()) < 24 * 60 * 60 * 1000
      )
      if (recentOther) {
        const msg = lang === 'en'
          ? `${getName(plan.client_id)} already has another plan marked paid in the last 24h. Mark this one as paid too?`
          : `${getName(plan.client_id)} вече има друг план, маркиран платен през последните 24ч. Да маркирам и този като платен?`
        if (!window.confirm(msg)) return
      }
    }
    // paid_at is what Finance buckets revenue by (see AnalyticsTab) — it must
    // be set here too, not just in the dedicated "mark paid" flow, or a plan
    // toggled paid days after it was created silently falls back to
    // created_at and counts as revenue in the wrong month.
    const patch = !currentValue
      ? { is_paid: true, paid_at: new Date().toISOString(), paid_by: auth.name }
      : { is_paid: false, paid_at: null, paid_by: null }
    await DB.update('client_plans', planId, patch)
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

  // Two states, not five: what's live (default), and what needs a follow-up
  // call (unpaid). Everything else — expired, refunded — is history, tucked
  // under its own toggle below instead of competing for attention here.
  const FILTERS = [
    { key: 'active', label: lang === 'en' ? 'Active' : 'Активни' },
    { key: 'unpaid', label: lang === 'en' ? 'Unpaid'  : 'Неплатени' },
  ]
  const visiblePlans = planFilter === 'unpaid'
    ? activePlans.filter(p => !p.is_paid)
    : activePlans
  const historyPlans = allPlans.filter(p => p.status !== 'active')

  if (loading) return <Typography sx={{ color: C.muted, py: 4, textAlign: 'center' }}>...</Typography>

  return (
    <Box>
      {/* Pending reviews — moderation queue */}
      {pendingReviews.length > 0 && (
        <Box sx={{
          mb: 2, p: 2, borderRadius: '12px',
          background: 'rgba(170,169,205,0.08)', border: '1px solid rgba(170,169,205,0.3)',
        }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 700, color: '#aaa9cd', mb: 1 }}>
            Ревюта за модерация ({pendingReviews.length})
          </Typography>
          {pendingReviews.map(r => (
            <Box key={r.id} sx={{ mb: 1.5, p: 1.5, borderRadius: '10px', background: 'rgba(0,0,0,0.2)', border: `1px solid ${C.border}` }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <Typography sx={{ fontSize: '14px', color: '#FFC107' }}>
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </Typography>
                <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.text }}>
                  {r.client_name || 'Клиент'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: C.muted, ml: 'auto' }}>
                  {formatDate(r.created_at)}
                </Typography>
              </Box>
              {r.text && (
                <Typography sx={{ fontSize: '12px', color: C.text, lineHeight: 1.5, mb: 1 }}>
                  "{r.text}"
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <button
                  onClick={() => moderateReview(r.id, 'approved')}
                  style={{
                    background: 'rgba(196,233,191,0.2)', border: '1px solid rgba(196,233,191,0.5)',
                    color: '#c4e9bf', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Одобри
                </button>
                <button
                  onClick={() => moderateReview(r.id, 'rejected')}
                  style={{
                    background: 'rgba(248,113,113,0.15)', border: '1px solid rgba(248,113,113,0.4)',
                    color: '#F87171', padding: '4px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Отхвърли
                </button>
              </Box>
            </Box>
          ))}
        </Box>
      )}

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
        {lang === 'en' ? 'Subscriptions' : 'Абонаменти'}
      </Typography>

      <Box sx={{ display: 'flex', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const count = f.key === 'unpaid' ? activePlans.filter(p => !p.is_paid).length : activePlans.length
          return (
            <Box key={f.key} onClick={() => setPlanFilter(f.key)} sx={{
              px: 1.25, py: 0.5, borderRadius: '100px', cursor: 'pointer', fontSize: '12px', fontWeight: 700,
              background: planFilter === f.key ? (f.key === 'unpaid' ? '#FF6B9D' : C.primary) : 'transparent',
              color:      planFilter === f.key ? '#0f1c11' : (f.key === 'unpaid' ? '#FF6B9D' : C.muted),
              border:     `1px solid ${planFilter === f.key ? (f.key === 'unpaid' ? '#FF6B9D' : C.primary) : (f.key === 'unpaid' ? 'rgba(255,107,157,0.4)' : C.border)}`,
              '&:hover':  planFilter === f.key ? {} : { borderColor: C.logan },
            }}>
              {f.label} ({count})
            </Box>
          )
        })}
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {visiblePlans.map(renderPlanRow)}
      </Box>

      <Box onClick={() => setShowHistory(v => !v)} sx={{
        display: 'flex', alignItems: 'center', gap: 1, mt: 2, cursor: 'pointer',
        p: 1.5, borderRadius: '10px', border: `1px solid ${C.border}`,
      }}>
        <Typography sx={{ fontSize: '12px', fontWeight: 700, color: C.muted, flex: 1 }}>
          {lang === 'en' ? 'History' : 'История'} — {lang === 'en' ? 'expired and refunded plans' : 'изтекли и възстановени планове'} ({historyPlans.length})
        </Typography>
        <Typography sx={{ fontSize: '11px', color: C.muted }}>
          {showHistory ? (lang === 'en' ? 'Hide' : 'Скрий') : (lang === 'en' ? 'Show' : 'Покажи')}
        </Typography>
      </Box>
      {showHistory && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, mt: 1 }}>
          {historyPlans.map(renderPlanRow)}
        </Box>
      )}
    </Box>
  )

  function renderPlanRow(p) {
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

              {/* Paid status — only toggleable on an active plan. A replaced/
                  expired plan's paid status is frozen: this is exactly how an
                  already-superseded plan got re-marked paid by mistake and
                  double-counted a renewal payment (Мария Славкова, Християн
                  Роев incidents). To correct an old plan, use its own
                  Refund/manage dialog instead of this quick toggle. */}
              {isActive ? (
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
              ) : (
                <Tooltip title={lang === 'en' ? 'Locked — plan is no longer active' : 'Заключено — планът вече не е активен'} arrow>
                  <Box sx={{
                    fontSize: '10px', fontWeight: 700, px: 0.75, py: 0.15, borderRadius: '4px',
                    background: p.is_paid ? 'rgba(74,222,128,0.08)' : 'rgba(224,82,82,0.08)',
                    color: p.is_paid ? 'rgba(74,222,128,0.6)' : 'rgba(224,82,82,0.6)',
                  }}>
                    {p.is_paid ? (lang === 'en' ? 'PAID' : 'ПЛ.') : (lang === 'en' ? 'UNPAID' : 'НЕПЛ.')}
                  </Box>
                </Tooltip>
              )}

              {/* Date */}
              <Typography sx={{ fontSize: '11px', color: C.muted, whiteSpace: 'nowrap' }}>
                {formatDate(p.valid_from)}
              </Typography>

              {/* Price — net of any refund, so a partially refunded plan shows
                  what it actually kept, not the original charge */}
              <Typography sx={{ fontSize: '11px', fontWeight: 700, color: C.text, whiteSpace: 'nowrap', minWidth: 45, textAlign: 'right' }}>
                {(Number(p.price) || 0) - (Number(p.refund_amount) || 0)} €
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
                  // A paid, never-refunded plan carries real revenue — hard
                  // deleting the row erases it from Finance with no trace,
                  // no different from the "Изтрий клиент" hazard fixed
                  // earlier. Point towards Refund instead when that applies.
                  const net = (Number(p.price) || 0) - (Number(p.refund_amount) || 0)
                  const msg = (p.is_paid && net > 0)
                    ? (lang === 'en'
                        ? `${getName(p.client_id)}'s plan is marked paid (${net} €) and was never refunded — deleting it will erase that amount from Finance with no record. If the client left, use "Refund" on the plan instead. Delete anyway?`
                        : `Планът на ${getName(p.client_id)} е маркиран платен (${net} €) и никога не е възстановяван — изтриването ще заличи тази сума от Финанси безследно. Ако клиентът е напуснал, ползвай "Възстанови сума" на плана вместо това. Все пак ли да изтрия?`)
                    : (lang === 'en' ? `Delete plan for ${getName(p.client_id)}?` : `Изтрий план на ${getName(p.client_id)}?`)
                  if (window.confirm(msg)) handleDelete(p.id)
                }}
                  sx={{ color: '#e05252', p: 0.4, fontSize: '14px' }}>
                  &#x2715;
                </IconButton>
              </Tooltip>
            </Box>
          )
  }
}
