// ── Admin names (can also add is_admin to coaches table) ─────
export const ADMIN_NAMES = ['АдминАлекс', 'АдминКари']

export function isAdmin(auth) {
  return auth.role === 'coach' && ADMIN_NAMES.includes(auth.name)
}

// ── Plan configs ─────────────────────────────────────────────
export const PLAN_CONFIGS = {
  '8':        { label: '8 тренировки',  credits: 8,   unlimited: false },
  '12':       { label: '12 тренировки', credits: 12,  unlimited: false },
  'unlimited':{ label: 'Unlimited',     credits: null, unlimited: true  },
}

export function planLabel(planType, t) {
  if (t) {
    const key = planType === 'unlimited' ? 'planTypeUnlimited' : `planType${planType}`
    return t(key) || PLAN_CONFIGS[planType]?.label || planType
  }
  return PLAN_CONFIGS[planType]?.label || planType
}

// ── Plan validity helpers ─────────────────────────────────────
export function effectiveValidTo(plan) {
  if (!plan) return null
  return plan.extended_to || plan.valid_to
}

export function isPlanActive(plan) {
  if (!plan || plan.status !== 'active') return false
  // Credits exhausted = plan expired (except unlimited)
  if (plan.plan_type !== 'unlimited' && (plan.credits_used || 0) >= (plan.credits_total || 0)) return false
  const validTo = effectiveValidTo(plan)
  if (!validTo) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(validTo + 'T00:00:00')
  expiry.setHours(23, 59, 59, 999)
  return today <= expiry
}

export function creditsRemaining(plan) {
  if (!plan) return 0
  if (plan.plan_type === 'unlimited') return Infinity
  return Math.max(0, (plan.credits_total || 0) - (plan.credits_used || 0))
}

export function fmtValidTo(plan, lang = 'bg') {
  const d = effectiveValidTo(plan)
  if (!d) return '-'
  return new Date(d + 'T00:00:00').toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

// ── Slot time helpers ─────────────────────────────────────────
export function slotDateTime(slot) {
  // slot_date = 'YYYY-MM-DD', start_time = 'HH:MM:SS' or 'HH:MM'
  return new Date(`${slot.slot_date}T${slot.start_time}`)
}

export function hoursUntilSlot(slot) {
  return (slotDateTime(slot).getTime() - Date.now()) / 3_600_000
}

// ── Booking eligibility ───────────────────────────────────────
export function canClientBook(slot, plan, myBookings = []) {
  if (!slot || slot.status === 'cancelled')
    return { ok: false, reason: 'Слотът е отменен' }

  if (slotDateTime(slot) <= new Date())
    return { ok: false, reason: 'Минал час' }

  if (hoursUntilSlot(slot) < 24)
    return { ok: false, reason: 'Записването е възможно до 24 часа предварително' }

  if ((slot.booked_count || 0) >= slot.capacity)
    return { ok: false, reason: 'Този час вече е запълнен' }

  if (myBookings.some(b => b.slot_id === slot.id && b.status === 'active'))
    return { ok: false, reason: 'Вече сте записани за този час' }

  if (!isPlanActive(plan))
    return { ok: false, reason: 'Нямате активен план' }

  if (plan.plan_type !== 'unlimited' && creditsRemaining(plan) <= 0)
    return { ok: false, reason: 'Нямате оставащи кредити' }

  return { ok: true }
}

export function canClientCancel(slot) {
  if (!slot) return { ok: false, reason: 'Слотът не е намерен' }
  if (hoursUntilSlot(slot) < 2)
    return { ok: false, reason: 'Отказването е възможно до 2 часа предварително' }
  return { ok: true }
}

// ── Date helpers ──────────────────────────────────────────────
export function isoToday() {
  return new Date().toISOString().slice(0, 10)
}

export function isoDatePlusDays(n) {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d.toISOString().slice(0, 10)
}

export function fmtTime(t) {
  if (!t) return ''
  return t.slice(0, 5) // HH:MM
}

export function fmtSlotDate(isoDate, lang = 'bg') {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}

export function fmtShortDate(isoDate, lang = 'bg') {
  if (!isoDate) return ''
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString(lang === 'bg' ? 'bg-BG' : 'en-GB', {
    day: 'numeric', month: 'short',
  })
}

export function isToday(isoDate) {
  return isoDate === isoToday()
}

export function isTomorrow(isoDate) {
  return isoDate === isoDatePlusDays(1)
}

export function dayLabel(isoDate, lang = 'bg') {
  if (isToday(isoDate)) return lang === 'bg' ? 'Днес' : 'Today'
  if (isTomorrow(isoDate)) return lang === 'bg' ? 'Утре' : 'Tomorrow'
  return fmtSlotDate(isoDate, lang)
}

// ── Group slots by date ───────────────────────────────────────
export function groupByDate(slots) {
  const out = {}
  for (const s of slots) {
    if (!out[s.slot_date]) out[s.slot_date] = []
    out[s.slot_date].push(s)
  }
  for (const d of Object.keys(out)) {
    out[d].sort((a, b) => a.start_time.localeCompare(b.start_time))
  }
  return out
}

// ── Occupancy display string ──────────────────────────────────
export function occupancyStr(booked, capacity) {
  return `${booked}/${capacity}`
}

export function placesLeftStr(booked, capacity, lang = 'bg') {
  const left = capacity - booked
  if (left <= 0) return lang === 'bg' ? 'Запълнен' : 'Full'
  if (left === 1) return lang === 'bg' ? 'Остава 1 място' : '1 place left'
  return lang === 'bg' ? `Остават ${left} места` : `${left} places left`
}

// ── Plan status display ───────────────────────────────────────
export function planStatusColor(plan) {
  if (!plan) return '#94A3B8'
  if (!isPlanActive(plan)) return '#F87171'
  const daysLeft = daysUntilExpiry(plan)
  if (daysLeft !== null && daysLeft <= 5) return '#FB923C'
  return '#4ADE80'
}

export function daysUntilExpiry(plan) {
  const validTo = effectiveValidTo(plan)
  if (!validTo) return null
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const expiry = new Date(validTo + 'T00:00:00')
  return Math.ceil((expiry - now) / 86_400_000)
}
