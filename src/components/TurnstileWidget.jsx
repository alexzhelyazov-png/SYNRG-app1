// Cloudflare Turnstile widget — invisible bot protection.
// Site key is public (safe to embed). Backend verifies token via secret key.
//
// Renders nothing visually until a challenge is needed. Calls onVerify(token)
// when a token is issued. Re-renders if siteKey prop changes (rare).

import { useEffect, useRef } from 'react'

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY

export default function TurnstileWidget({ onVerify, onExpire, action }) {
  const ref = useRef(null)
  const widgetIdRef = useRef(null)

  useEffect(() => {
    if (!SITE_KEY) return
    // Lazy-load Turnstile script once
    if (!window.turnstile) {
      const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
      if (!existing) {
        const s = document.createElement('script')
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.async = true
        s.defer = true
        document.head.appendChild(s)
      }
    }

    let cancelled = false
    const tryRender = () => {
      if (cancelled) return
      if (!window.turnstile || !ref.current) {
        setTimeout(tryRender, 100)
        return
      }
      if (widgetIdRef.current !== null) return // already rendered
      try {
        widgetIdRef.current = window.turnstile.render(ref.current, {
          sitekey: SITE_KEY,
          action: action || 'auth',
          size: 'invisible',
          callback: (token) => onVerify?.(token),
          'expired-callback': () => onExpire?.(),
          'error-callback': () => onExpire?.(),
        })
      } catch (e) {
        console.warn('Turnstile render failed:', e)
      }
    }
    tryRender()

    return () => {
      cancelled = true
      if (widgetIdRef.current !== null && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current) } catch { /* ignore */ }
        widgetIdRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Programmatically request execution (for invisible widget)
  const execute = () => {
    if (widgetIdRef.current !== null && window.turnstile) {
      try { window.turnstile.execute(widgetIdRef.current) } catch { /* ignore */ }
    }
  }
  // Expose execute via ref-like callback if parent needs it
  if (typeof onVerify === 'function' && execute) {
    // No-op; parent can also call window.turnstile.execute(widgetId) directly
  }

  if (!SITE_KEY) return null
  return <div ref={ref} style={{ display: 'none' }} />
}

// Helper: programmatically generate a Turnstile token without visible widget.
// Returns a Promise resolving to the token string, or null on error.
export function getTurnstileToken(action = 'auth') {
  return new Promise((resolve) => {
    if (!SITE_KEY) { resolve(null); return }
    const tryExecute = (attempt = 0) => {
      if (!window.turnstile) {
        if (attempt > 50) { resolve(null); return }
        setTimeout(() => tryExecute(attempt + 1), 100)
        return
      }
      // Create a temporary container
      const container = document.createElement('div')
      container.style.display = 'none'
      document.body.appendChild(container)
      let resolved = false
      let widgetId = null
      const cleanup = () => {
        if (widgetId !== null && window.turnstile) {
          try { window.turnstile.remove(widgetId) } catch { /* ignore */ }
        }
        if (container.parentNode) container.parentNode.removeChild(container)
      }
      try {
        widgetId = window.turnstile.render(container, {
          sitekey: SITE_KEY,
          action,
          size: 'invisible',
          callback: (token) => {
            if (resolved) return
            resolved = true
            cleanup()
            resolve(token)
          },
          'error-callback': () => {
            if (resolved) return
            resolved = true
            cleanup()
            resolve(null)
          },
        })
      } catch {
        cleanup()
        resolve(null)
      }
      // Hard timeout — never block longer than 15 sec
      setTimeout(() => {
        if (resolved) return
        resolved = true
        cleanup()
        resolve(null)
      }, 15000)
    }
    // Ensure script is loaded
    if (!window.turnstile) {
      const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]')
      if (!existing) {
        const s = document.createElement('script')
        s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
        s.async = true
        s.defer = true
        document.head.appendChild(s)
      }
    }
    tryExecute()
  })
}
