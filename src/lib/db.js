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

  // ── Seed coaches & their shadow profiles ──────────────────
  async seedIfEmpty() {
    const COACHES = [
      { name: 'Виви',   password: 'vivi'   },
      { name: 'Кари',   password: 'kari'   },
      { name: 'Алекс',  password: 'alex'   },
      { name: 'Ицко',   password: 'icko'   },
      { name: 'Елина',  password: 'elina'  },
      { name: 'Никола', password: 'nikola' },
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
}
