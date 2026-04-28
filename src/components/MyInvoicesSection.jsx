// Customer-facing invoice list (used in Profile/Settings).
// Shows all invoices for the logged-in client, with a "View/Download" link
// that opens the invoice HTML in a new tab (browser handles "Save as PDF").

import { useEffect, useState } from 'react'
import { Box, Typography, Paper, Button, CircularProgress } from '@mui/material'
import DownloadIcon from '@mui/icons-material/Download'
import { useApp } from '../context/AppContext'
import { C } from '../theme'

export default function MyInvoicesSection() {
  const { auth, t } = useApp()
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!auth?.id) return
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
    fetch(`${SUPABASE_URL}/rest/v1/invoices?select=id,invoice_number,description,amount_cents,currency,issued_at,status&client_id=eq.${auth.id}&order=issued_at.desc`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setInvoices(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => { setLoading(false) })
  }, [auth?.id])

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
      win.document.write(html)
      win.document.close()
      // Trigger print dialog after HTML is loaded so user can Save as PDF
      setTimeout(() => { try { win.focus(); win.print() } catch { /* ignore */ } }, 500)
    } catch (e) {
      console.error('Failed to load invoice:', e)
    }
  }

  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
      <CircularProgress size={24} sx={{ color: C.muted }} />
    </Box>
  )

  if (invoices.length === 0) {
    return (
      <Paper sx={{ p: 3, borderRadius: '16px', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '13px', color: C.muted }}>
          Все още нямаш издадени фактури.
        </Typography>
      </Paper>
    )
  }

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      <Typography sx={{ fontSize: '11px', color: C.muted, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
        Моите фактури ({invoices.length})
      </Typography>
      {invoices.map(inv => {
        const date = new Date(inv.issued_at).toLocaleDateString('bg-BG', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const amount = (inv.amount_cents / 100).toFixed(2) + ' ' + (inv.currency || 'EUR')
        return (
          <Paper key={inv.id} sx={{
            p: 2,
            borderRadius: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 2,
          }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 800, color: C.text, mb: 0.25 }}>
                Фактура № {String(inv.invoice_number).padStart(10, '0')}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted, lineHeight: 1.4 }} noWrap>
                {inv.description}
              </Typography>
              <Typography sx={{ fontSize: '11px', color: C.muted, mt: 0.5 }}>
                {date} · {amount}
              </Typography>
            </Box>
            <Button
              startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
              onClick={() => openInvoice(inv.id)}
              size="small"
              sx={{
                minWidth: 0,
                px: 1.5,
                fontSize: '11px',
                fontWeight: 700,
                color: C.purple,
                background: C.primaryA3,
                border: `1px solid ${C.border}`,
                '&:hover': { background: C.accentSoft, borderColor: C.primaryA20 },
              }}
            >
              PDF
            </Button>
          </Paper>
        )
      })}
    </Box>
  )
}
