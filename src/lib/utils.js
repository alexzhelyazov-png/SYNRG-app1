export function todayDate() {
  const d = new Date()
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`
}

export function dateToInput(s) {
  const p = String(s || '').split('.')
  if (p.length !== 3) return ''
  return `${p[2]}-${p[1]}-${p[0]}`
}

export function inputToDate(v) {
  if (!v) return todayDate()
  const [y, m, d] = v.split('-')
  return `${d}.${m}.${y}`
}

export function parseDate(s) {
  const [d, m, y] = String(s || '').split('.').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

export function fmt1(v) {
  if (v === null || v === undefined || isNaN(v)) return '—'
  return Number(v).toFixed(1)
}

export function avgArr(nums) {
  if (!nums.length) return 0
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function sameDateStr(a, b) {
  return String(a || '') === String(b || '')
}

export function last30Days() {
  const arr = [], now = new Date()
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(now.getDate() - i)
    arr.push(`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`)
  }
  return arr
}

export function computeRanking(clients) {
  const days = new Set(last30Days())
  return clients.map(c => {
    const weightPts = (c.weightLogs || []).filter(w => days.has(w.date)).length * 2
    const workoutPts = (c.workouts || []).filter(w => days.has(w.date)).length * 5
    const byDate = {}
    ;(c.meals || []).forEach(m => {
      if (!days.has(m.date)) return
      if (!byDate[m.date]) byDate[m.date] = { kcal: 0, protein: 0 }
      byDate[m.date].kcal += Number(m.kcal || 0)
      byDate[m.date].protein += Number(m.protein || 0)
    })
    let calPts = 0, protPts = 0
    Object.values(byDate).forEach(day => {
      if (day.kcal >= (c.calorieTarget || 99999)) calPts += 3
      if (day.protein >= (c.proteinTarget || 99999)) protPts += 3
    })
    return {
      name: c.name,
      points: weightPts + workoutPts + calPts + protPts,
      breakdown: { weightPts, workoutPts, calPts, protPts }
    }
  }).sort((a, b) => b.points - a.points)
}
