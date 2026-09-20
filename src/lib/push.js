// Web Push registration.
//
// iOS is the awkward one: Safari only exposes PushManager to a web app that was
// added to the Home Screen, so a plain Safari tab reports "unsupported" rather
// than "denied". We distinguish the two — telling an iPhone user to check their
// notification settings when the real fix is "add the icon" is a dead end.

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY

export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
  || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) // iPadOS masquerades as Mac

export function isStandalone() {
  try {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
  } catch { return false }
}

export function platformLabel() {
  if (isIOS) return 'ios'
  if (/android/i.test(navigator.userAgent)) return 'android'
  return 'desktop'
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

/**
 * What the UI should show. Kept as one function so the toggle and any prompt
 * can't drift apart.
 *   unsupported   — browser has no push at all (old Android browser, desktop Safari <16)
 *   needs-install — iOS, push exists but only once added to the Home Screen
 *   denied        — user said no; only recoverable from OS settings
 *   granted       — permission held (may or may not have a live subscription)
 *   default       — never asked
 */
export function getPushState() {
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (!hasApi) return isIOS && !isStandalone() ? 'needs-install' : 'unsupported'
  if (isIOS && !isStandalone()) return 'needs-install'
  return Notification.permission // 'granted' | 'denied' | 'default'
}

export async function getExistingSubscription() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.ready
    return await reg.pushManager.getSubscription()
  } catch { return null }
}

/**
 * Asks for permission (must be called from a user gesture — Safari drops the
 * prompt otherwise) and registers the subscription server-side.
 * Returns { ok } or { ok:false, reason }.
 */
export async function subscribeToPush(clientId) {
  if (!clientId) return { ok: false, reason: 'no_client' }
  const state = getPushState()
  if (state === 'unsupported')   return { ok: false, reason: 'unsupported' }
  if (state === 'needs-install') return { ok: false, reason: 'needs_install' }
  if (!VAPID_PUBLIC)             return { ok: false, reason: 'no_vapid_key' }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, reason: 'denied' }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
    }

    const res = await fetch(`${SUPABASE_URL}/functions/v1/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id:  clientId,
        subscription: sub.toJSON(),
        platform:   platformLabel(),
        standalone: isStandalone(),
        user_agent: navigator.userAgent,
      }),
    })
    if (!res.ok) return { ok: false, reason: 'store_failed' }
    return { ok: true }
  } catch (e) {
    console.warn('[push] subscribe failed:', e)
    return { ok: false, reason: 'error' }
  }
}

export async function unsubscribeFromPush() {
  try {
    const sub = await getExistingSubscription()
    if (!sub) return { ok: true }
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await fetch(`${SUPABASE_URL}/functions/v1/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'unsubscribe', endpoint }),
    })
    return { ok: true }
  } catch (e) {
    console.warn('[push] unsubscribe failed:', e)
    return { ok: false }
  }
}
