// ── useIsOnlineClient ──────────────────────────────────────────────
// Returns true iff the currently-logged-in client has an ACTIVE row in
// program_purchases (i.e. bought the online program via Stripe).
//
// Per MEMORY.md business rules: module membership alone cannot distinguish
// studio vs online (active studio plans grant synrg_method too). The
// authoritative signal for "online" is the program_purchases table.

import { useEffect, useState } from 'react'
import { useApp } from '../context/AppContext'
import { DB } from '../lib/db'

export default function useIsOnlineClient() {
  const { auth } = useApp()
  const [isOnline, setIsOnline] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!auth?.isLoggedIn || auth.role !== 'client' || !auth.id) {
      setIsOnline(false); setLoaded(true); return
    }
    setLoaded(false)
    DB.findWhere('program_purchases', 'client_id', auth.id)
      .then(rows => {
        if (cancelled) return
        const hasActive = (rows || []).some(r => r.status === 'active')
        setIsOnline(hasActive)
        setLoaded(true)
      })
      .catch(() => {
        if (cancelled) return
        setIsOnline(false); setLoaded(true)
      })
    return () => { cancelled = true }
  }, [auth?.isLoggedIn, auth?.role, auth?.id])

  return { isOnline, loaded }
}
