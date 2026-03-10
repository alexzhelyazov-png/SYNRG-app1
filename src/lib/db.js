import { createClient } from '@supabase/supabase-js'

// ── Detect if Supabase is configured ────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const USE_SUPABASE  = Boolean(SUPABASE_URL && SUPABASE_KEY)

const supabase = USE_SUPABASE ? createClient(SUPABASE_URL, SUPABASE_KEY) : null

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

// ── Supabase implementation ──────────────────────────────────
const SB = {
  async selectAll(table) {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    return data || []
  },
  async insert(table, row) {
    const { data, error } = await supabase.from(table).insert(row).select().single()
    if (error) throw error
    return data
  },
  async update(table, id, patch) {
    const { data, error } = await supabase.from(table).update(patch).eq('id', id).select().single()
    if (error) throw error
    return data
  },
  async deleteById(table, id) {
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) throw error
  },
  async findWhere(table, field, value) {
    const { data, error } = await supabase.from(table).select('*').eq(field, value)
    if (error) throw error
    return data || []
  },
}

const impl = USE_SUPABASE ? SB : LS

// ── Public API ───────────────────────────────────────────────
export const DB = {
  selectAll:  (table)               => impl.selectAll(table),
  insert:     (table, row)          => impl.insert(table, row),
  update:     (table, id, patch)    => impl.update(table, id, patch),
  deleteById: (table, id)           => impl.deleteById(table, id),
  findWhere:  (table, field, value) => impl.findWhere(table, field, value),

  async upsertByFields(table, row, matchFields) {
    if (USE_SUPABASE) {
      let query = supabase.from(table).select('id')
      matchFields.forEach(f => { query = query.eq(f, row[f]) })
      const { data: existing } = await query.maybeSingle()
      if (existing) return SB.update(table, existing.id, row)
      return SB.insert(table, row)
    }
    const all      = await LS.selectAll(table)
    const existing = all.find(r => matchFields.every(f => r[f] === row[f]))
    if (existing) return LS.update(table, existing.id, row)
    return LS.insert(table, row)
  },

  async seedIfEmpty() {
    let first
    if (USE_SUPABASE) {
      const { data } = await supabase.from('coaches').select('id').limit(1)
      first = data || []
    } else {
      first = await LS.selectAll('coaches')
    }
    if (first.length === 0) {
      await Promise.all([
        this.insert('coaches', { name: 'Елина',  password: '1111' }),
        this.insert('coaches', { name: 'Никола', password: '1111' }),
        this.insert('coaches', { name: 'Ицко',   password: '1111' }),
        this.insert('coaches', { name: 'Алекс',  password: '1111' }),
      ])
    }
  },
}

export const isUsingSupabase = USE_SUPABASE
