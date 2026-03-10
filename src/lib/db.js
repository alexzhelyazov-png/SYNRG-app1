import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)

export const DB = {
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

  async upsertByFields(table, row, matchFields) {
    let query = supabase.from(table).select('id')
    matchFields.forEach(f => { query = query.eq(f, row[f]) })
    const { data: existing } = await query.maybeSingle()
    if (existing) {
      return this.update(table, existing.id, row)
    }
    return this.insert(table, row)
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

  async seedIfEmpty() {
    const { data } = await supabase.from('coaches').select('id').limit(1)
    if (!data || data.length === 0) {
      await Promise.all([
        this.insert('coaches', { name: 'Елина',  password: '1111' }),
        this.insert('coaches', { name: 'Никола', password: '1111' }),
        this.insert('coaches', { name: 'Ицко',   password: '1111' }),
        this.insert('coaches', { name: 'Алекс',  password: '1111' }),
      ])
    }
  },
}
