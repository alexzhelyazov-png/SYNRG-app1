// ── useClientTier ──────────────────────────────────────────────
// Derives the authoritative tier for the currently-logged-in client:
//   - 'online' : has ACTIVE row in program_purchases (paid via Stripe)
//   - 'studio' : has ANY row in client_plans (8/12/unlimited plan)
//   - 'lead'   : neither — potential customer using the freemium trackers
//
// Per MEMORY.md: module membership alone CANNOT distinguish studio vs
// online because active studio plans grant synrg_method too. The
// authoritative signals are the rows in program_purchases / client_plans.
//
// Returns { tier, loaded, isOnline, isStudio, isLead } so callers can
// pick whichever flag is handiest. For coaches/admins tier is always 'studio'
// (they see the full app), and isLead is false.

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'

export default function useClientTier() {
  const { auth } = useApp()
  const [tier, setTier] = useState('lead')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!auth?.isLoggedIn) {
      setTier('lead'); setLoaded(true); return
    }
    // Coaches/admins see everything — report as 'studio' so nav isn't trimmed.
    if (auth.role !== 'client' || !auth.id) {
      setTier('studio'); setLoaded(true); return
    }
    setLoaded(false)
    Promise.all([
      DB.findWhere('program_purchases', 'client_id', auth.id).catch(() => []),
      DB.findWhere('client_plans',      'client_id', auth.id).catch(() => []),
    ])
      .then(([purchases, plans]) => {
        if (cancelled) return
        const hasOnline = (purchases || []).some(p => p.status === 'active')
        const hasStudio = (plans || []).length > 0
        setTier(hasOnline ? 'online' : hasStudio ? 'studio' : 'lead')
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setTier('lead'); setLoaded(true)
      })
    return () => { cancelled = true }
  }, [auth?.isLoggedIn, auth?.role, auth?.id])

  return {
    tier,
    loaded,
    isOnline: tier === 'online',
    isStudio: tier === 'studio',
    isLead:   tier === 'lead',
  }
}
