// ── Detect if Supabase is configured ────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
export const isUsingSupabase = Boolean(SUPABASE_URL && SUPABASE_KEY)

// ── Supabase REST helpers (direct fetch — no supabase-js) ────
function sbHeaders(extra = {}) {
  return {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

function sbUrl(table, params = '') {
  return `${SUPABASE_URL}/rest/v1/${table}${params}`
}

async function sbFetch(url, options) {
  const res = await fetch(url, options)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Supabase ${res.status}: ${text}`)
  }
  if (res.status === 204) return null
  return res.json()
}

// Safe fetch — returns null instead of throwing (for optional tables)
async function sbFetchSafe(url, options) {
  try {
    const res = await fetch(url, options)
    if (!res.ok) return null
    if (res.status === 204) return null
    return res.json()
  } catch { return null }
}

const SB = {
  async selectAll(table) {
    return (await sbFetch(sbUrl(table, '?select=*'), { headers: sbHeaders() })) || []
  },
  async insert(table, row) {
    const data = await sbFetch(sbUrl(table), {
      method: 'POST',
      headers: sbHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(row),
    })
    return Array.isArray(data) ? data[0] : data
  },
  async update(table, id, patch) {
    const data = await sbFetch(sbUrl(table, `?id=eq.${id}`), {
      method: 'PATCH',
      headers: sbHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(patch),
    })
    return Array.isArray(data) ? data[0] : data
  },
  async deleteById(table, id) {
    await sbFetch(sbUrl(table, `?id=eq.${id}`), {
      method: 'DELETE',
      headers: sbHeaders(),
    })
  },
  async findWhere(table, field, value) {
    return (await sbFetch(sbUrl(table, `?select=*&${field}=eq.${encodeURIComponent(value)}`), { headers: sbHeaders() })) || []
  },
}

// ── localStorage fallback (no .env / dev) ───────────────────
function lsUuid() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const LS = {
  async selectAll(table) {
    const rows = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(table + ':')) {
        try { rows.push(JSON.parse(localStorage.getItem(k))) } catch {}
      }
    }
    return rows.filter(Boolean)
  },
  async insert(table, row) {
    const record = { ...row, id: lsUuid(), created_at: new Date().toISOString() }
    localStorage.setItem(table + ':' + record.id, JSON.stringify(record))
    return record
  },
  async update(table, id, patch) {
    const key  = table + ':' + id
    const row  = JSON.parse(localStorage.getItem(key) || 'null')
    if (!row) return null
    const updated = { ...row, ...patch }
    localStorage.setItem(key, JSON.stringify(updated))
    return updated
  },
  async deleteById(table, id) {
    localStorage.removeItem(table + ':' + id)
  },
  async findWhere(table, field, value) {
    const all = await this.selectAll(table)
    return all.filter(r => r[field] === value)
  },
}

const impl = isUsingSupabase ? SB : LS

// ── Public API ───────────────────────────────────────────────
export const DB = {
  selectAll:  (table)               => impl.selectAll(table),
  insert:     (table, row)          => impl.insert(table, row),
  update:     (table, id, patch)    => impl.update(table, id, patch),
  deleteById: (table, id)           => impl.deleteById(table, id),
  findWhere:  (table, field, value) => impl.findWhere(table, field, value),

  async upsertByFields(table, row, matchFields) {
    if (isUsingSupabase) {
      const params = matchFields.map(f => `${f}=eq.${encodeURIComponent(row[f])}`).join('&')
      const existing = await sbFetch(sbUrl(table, `?select=id&${params}`), { headers: sbHeaders() })
      if (existing && existing.length > 0) return SB.update(table, existing[0].id, row)
      return SB.insert(table, row)
    }
    const all      = await LS.selectAll(table)
    const existing = all.find(r => matchFields.every(f => r[f] === row[f]))
    if (existing) return LS.update(table, existing.id, row)
    return LS.insert(table, row)
  },

  // ── Notifications (Supabase only, optional table) ─────────
  async insertNotification(fromCoach, clientName, actionType, content) {
    if (!isUsingSupabase) return
    try {
      await sbFetch(sbUrl('notifications'), {
        method: 'POST',
        headers: sbHeaders({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify({ from_coach: fromCoach, client_name: clientName, action_type: actionType, content }),
      })
    } catch { /* table may not exist yet */ }
  },

  async getNotifications(sinceHours = 48) {
    if (!isUsingSupabase) return []
    const since = new Date(Date.now() - sinceHours * 3600000).toISOString()
    const data = await sbFetchSafe(
      sbUrl('notifications', `?select=*&created_at=gte.${since}&order=created_at.desc&limit=50`),
      { headers: sbHeaders() }
    )
    return data || []
  },

  // ── Booking: get upcoming slots ────────────────────────────
  async getSlots(from, to) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('booking_slots',
          `?select=*&slot_date=gte.${from}&slot_date=lte.${to}&status=eq.active&order=slot_date.asc,start_time.asc`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('booking_slots')
    return all
      .filter(s => s.slot_date >= from && s.slot_date <= to && s.status === 'active')
      .sort((a, b) => a.slot_date.localeCompare(b.slot_date) || a.start_time.localeCompare(b.start_time))
  },

  // ── Booking: count active bookings per slot ─────────────────
  async getSlotBookingCounts(slotIds) {
    if (!slotIds || !slotIds.length) return {}
    if (isUsingSupabase) {
      const inClause = slotIds.map(id => `"${id}"`).join(',')
      const data = await sbFetchSafe(
        sbUrl('slot_bookings', `?select=slot_id&status=eq.active&slot_id=in.(${slotIds.join(',')})`),
        { headers: sbHeaders() }
      ) || []
      const counts = {}
      for (const b of data) {
        counts[b.slot_id] = (counts[b.slot_id] || 0) + 1
      }
      return counts
    }
    const all = await LS.selectAll('slot_bookings')
    const counts = {}
    for (const b of all.filter(b => slotIds.includes(b.slot_id) && b.status === 'active')) {
      counts[b.slot_id] = (counts[b.slot_id] || 0) + 1
    }
    return counts
  },

  // ── Booking: full bookings for a slot (coach/admin) ─────────
  async getSlotBookings(slotId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('slot_bookings', `?select=*&slot_id=eq.${slotId}&status=eq.active&order=booked_at.asc`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('slot_bookings')
    return all.filter(b => b.slot_id === slotId && b.status === 'active')
  },

  // ── Booking: a client's active bookings ─────────────────────
  async getClientBookings(clientId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('slot_bookings', `?select=*&client_id=eq.${clientId}&status=eq.active`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('slot_bookings')
    return all.filter(b => b.client_id === clientId && b.status === 'active')
  },

  // ── Plans: get client's current active plan ──────────────────
  async getClientActivePlan(clientId) {
    if (isUsingSupabase) {
      const data = await sbFetchSafe(
        sbUrl('client_plans', `?select=*&client_id=eq.${clientId}&status=eq.active&order=created_at.desc&limit=1`),
        { headers: sbHeaders() }
      )
      return (data && data[0]) || null
    }
    const all = await LS.selectAll('client_plans')
    const plans = all
      .filter(p => p.client_id === clientId && p.status === 'active')
      .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    return plans[0] || null
  },

  // ── Plans: all plans (admin) ─────────────────────────────────
  async getAllClientPlans() {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('client_plans', `?select=*&order=created_at.desc`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('client_plans')
    return all.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  },

  // ── Call Supabase RPC (with localStorage fallback) ───────────
  async callRpc(funcName, params) {
    if (isUsingSupabase) {
      return sbFetch(`${SUPABASE_URL}/rest/v1/rpc/${funcName}`, {
        method: 'POST',
        headers: sbHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params),
      })
    }
    return this._localRpc(funcName, params)
  },

  // ── localStorage RPC fallback (non-atomic, for dev only) ─────
  async _localRpc(funcName, params) {
    if (funcName === 'book_slot') {
      const { p_slot_id, p_client_id, p_client_name } = params
      const slots = await LS.selectAll('booking_slots')
      const slot  = slots.find(s => s.id === p_slot_id)
      if (!slot || slot.status === 'cancelled') return { error: 'Слотът не е намерен' }
      const bookings = await LS.selectAll('slot_bookings')
      const active   = bookings.filter(b => b.slot_id === p_slot_id && b.status === 'active')
      if (active.length >= slot.capacity)            return { error: 'Този час вече е запълнен' }
      if (active.some(b => b.client_id === p_client_id)) return { error: 'Вече сте записани за този час' }
      const plan = await this.getClientActivePlan(p_client_id)
      if (!plan) return { error: 'Нямате активен план' }
      let credit_used = false
      if (plan.plan_type !== 'unlimited') {
        if (plan.credits_used >= plan.credits_total) return { error: 'Нямате оставащи кредити' }
        credit_used = true
        await LS.update('client_plans', plan.id, { credits_used: plan.credits_used + 1 })
      }
      await LS.insert('slot_bookings', {
        slot_id: p_slot_id, client_id: p_client_id, client_name: p_client_name,
        status: 'active', credit_used,
      })
      return { success: true }
    }

    if (funcName === 'cancel_booking') {
      const { p_slot_id, p_client_id } = params
      const all     = await LS.selectAll('slot_bookings')
      const booking = all.find(b => b.slot_id === p_slot_id && b.client_id === p_client_id && b.status === 'active')
      if (!booking) return { error: 'Не сте записани за този час' }
      await LS.update('slot_bookings', booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() })
      if (booking.credit_used) {
        const plan = await this.getClientActivePlan(p_client_id)
        if (plan && plan.credits_used > 0) {
          await LS.update('client_plans', plan.id, { credits_used: plan.credits_used - 1 })
        }
      }
      return { success: true }
    }

    if (funcName === 'admin_book_slot') {
      const { p_slot_id, p_client_id, p_client_name, p_use_credit } = params
      const slots = await LS.selectAll('booking_slots')
      const slot  = slots.find(s => s.id === p_slot_id)
      if (!slot || slot.status === 'cancelled') return { error: 'Слотът не е намерен' }
      const bookings = await LS.selectAll('slot_bookings')
      const active   = bookings.filter(b => b.slot_id === p_slot_id && b.status === 'active')
      if (active.length >= slot.capacity)                return { error: 'Слотът е запълнен' }
      if (active.some(b => b.client_id === p_client_id)) return { error: 'Клиентът вече е записан' }
      let credit_used = false
      if (p_use_credit) {
        const plan = await this.getClientActivePlan(p_client_id)
        if (plan && plan.plan_type !== 'unlimited' && plan.credits_used < plan.credits_total) {
          credit_used = true
          await LS.update('client_plans', plan.id, { credits_used: plan.credits_used + 1 })
        }
      }
      await LS.insert('slot_bookings', {
        slot_id: p_slot_id, client_id: p_client_id, client_name: p_client_name,
        status: 'active', credit_used,
      })
      return { success: true }
    }

    if (funcName === 'admin_cancel_booking') {
      const { p_slot_id, p_client_id, p_return_credit } = params
      const all     = await LS.selectAll('slot_bookings')
      const booking = all.find(b => b.slot_id === p_slot_id && b.client_id === p_client_id && b.status === 'active')
      if (!booking) return { error: 'Клиентът не е записан за този час' }
      await LS.update('slot_bookings', booking.id, { status: 'cancelled', cancelled_at: new Date().toISOString() })
      if (p_return_credit && booking.credit_used) {
        const plan = await this.getClientActivePlan(p_client_id)
        if (plan && plan.credits_used > 0) {
          await LS.update('client_plans', plan.id, { credits_used: plan.credits_used - 1 })
        }
      }
      return { success: true }
    }

    return { error: `Unknown RPC: ${funcName}` }
  },

  // ── Website CMS ────────────────────────────────────────────
  async getSiteItems(table) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl(table, '?select=*&order=display_order.asc'),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll(table)
    return all.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  },

  async getContentBlocks(page) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('site_content_blocks', `?select=*&page=eq.${encodeURIComponent(page)}`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('site_content_blocks')
    return all.filter(r => r.page === page)
  },

  async upsertContentBlock(page, section, key, valueBg, valueEn) {
    return this.upsertByFields('site_content_blocks', {
      page, section, block_key: key,
      value_bg: valueBg, value_en: valueEn,
      updated_at: new Date().toISOString(),
    }, ['page', 'section', 'block_key'])
  },

  async getInquiries(status = null) {
    if (isUsingSupabase) {
      const params = status
        ? `?select=*&status=eq.${status}&order=created_at.desc&limit=100`
        : '?select=*&order=created_at.desc&limit=100'
      return (await sbFetchSafe(sbUrl('inquiries', params), { headers: sbHeaders() })) || []
    }
    const all = await LS.selectAll('inquiries')
    const filtered = status ? all.filter(r => r.status === status) : all
    return filtered.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
  },

  // ── Programs ──────────────────────────────────────────────
  async getPrograms(statusFilter = null) {
    if (isUsingSupabase) {
      const params = statusFilter
        ? `?select=*&status=eq.${statusFilter}&order=display_order.asc`
        : '?select=*&order=display_order.asc'
      return (await sbFetchSafe(sbUrl('programs', params), { headers: sbHeaders() })) || []
    }
    const all = await LS.selectAll('programs')
    const filtered = statusFilter ? all.filter(p => p.status === statusFilter) : all
    return filtered.sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  },

  async getProgramModules(programId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('program_modules', `?select=*&program_id=eq.${programId}&order=display_order.asc`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('program_modules')
    return all.filter(m => m.program_id === programId).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  },

  async getProgramLessons(programId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('program_lessons', `?select=*&program_id=eq.${programId}&order=display_order.asc`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('program_lessons')
    return all.filter(l => l.program_id === programId).sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
  },

  async getClientProgress(clientId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(
        sbUrl('client_lesson_progress', `?select=*&client_id=eq.${clientId}`),
        { headers: sbHeaders() }
      )) || []
    }
    const all = await LS.selectAll('client_lesson_progress')
    return all.filter(p => p.client_id === clientId)
  },

  async markLessonComplete(clientId, lessonId) {
    if (isUsingSupabase) {
      return (await sbFetchSafe(sbUrl('client_lesson_progress'), {
        method: 'POST',
        headers: sbHeaders({ 'Prefer': 'return=representation,resolution=ignore-duplicates' }),
        body: JSON.stringify({ client_id: clientId, lesson_id: lessonId }),
      })) || {}
    }
    const all = await LS.selectAll('client_lesson_progress')
    if (all.some(p => p.client_id === clientId && p.lesson_id === lessonId)) return
    return LS.insert('client_lesson_progress', { client_id: clientId, lesson_id: lessonId })
  },

  async unmarkLessonComplete(clientId, lessonId) {
    if (isUsingSupabase) {
      await sbFetchSafe(
        sbUrl('client_lesson_progress', `?client_id=eq.${clientId}&lesson_id=eq.${lessonId}`),
        { method: 'DELETE', headers: sbHeaders() }
      )
      return
    }
    const all = await LS.selectAll('client_lesson_progress')
    const entry = all.find(p => p.client_id === clientId && p.lesson_id === lessonId)
    if (entry) await LS.deleteById('client_lesson_progress', entry.id)
  },

  // ── Seed coaches & their shadow profiles ──────────────────
  async seedIfEmpty() {
    const COACHES = [
      { name: 'АдминАлекс', password: '1234' },  // Admin
      { name: 'АдминКари',  password: '1234' },  // Admin
      { name: 'Виви',       password: 'vivi'  },
      { name: 'Кари',       password: 'kari'  },
      { name: 'Алекс',      password: 'alex'  },
      { name: 'Ицко',       password: 'icko'  },
      { name: 'Елина',      password: 'elina' },
      { name: 'Никола',     password: 'nikola'},
    ]

    let existingCoaches
    if (isUsingSupabase) {
      existingCoaches = (await sbFetchSafe(sbUrl('coaches', '?select=id,name&limit=10'), { headers: sbHeaders() })) || []
    } else {
      existingCoaches = await LS.selectAll('coaches')
    }

    if (existingCoaches.length === 0) {
      // Insert coaches
      for (const c of COACHES) {
        await this.insert('coaches', c)
      }
      // Insert shadow client profiles for coaches (for self-tracking)
      for (const c of COACHES) {
        await this.insert('clients', {
          name: c.name, password: c.password,
          calorie_target: 2500, protein_target: 160,
          is_coach: true,
        })
      }
    }
  },

  // ── MailerLite sync (via Supabase Edge Function) ──────────
  async syncToMailerLite(action, email, name, fields = {}) {
    if (!isUsingSupabase || !email) return
    try {
      await fetch(`${SUPABASE_URL}/functions/v1/mailerlite-sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, email, name, fields }),
      })
    } catch { /* silent — email sync should not block UI */ }
  },
}
