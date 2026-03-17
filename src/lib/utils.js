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

