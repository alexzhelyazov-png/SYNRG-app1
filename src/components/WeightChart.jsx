import { C } from '../theme'

export default function WeightChart({ data }) {
  if (!data || !data.length) {
    return (
      <div style={{ color: C.muted, fontSize: '14px', padding: '20px 0' }}>
        Няма данни за графика.
      </div>
    )
  }

  const W = 800, H = 200, P = 30
  const vals = data.flatMap(d => [d.weight, d.avg].filter(v => typeof v === 'number' && isFinite(v)))
  if (!vals.length) {
    return <div style={{ color: C.muted, fontSize: '14px', padding: '20px 0' }}>Няма валидни данни.</div>
  }

  const minV  = Math.min(...vals)
  const maxV  = Math.max(...vals)
  const range = Math.max(maxV - minV, 1)
  const xStep = data.length === 1 ? 0 : (W - P * 2) / (data.length - 1)
  const gx    = i => P + i * xStep
  const gy    = v => H - P - ((v - minV) / range) * (H - P * 2)
  const wPts  = data.map((d, i) => `${gx(i)},${gy(d.weight)}`).join(' ')
  const aPts  = data.map((d, i) => `${gx(i)},${gy(d.avg)}`).join(' ')

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: '200px', borderRadius: '12px', background: '#141312', display: 'block' }}
      >
        {[0, 1, 2, 3].map(li => {
          const y = P + ((H - P * 2) / 3) * li
          return <line key={li} x1={P} y1={y} x2={W - P} y2={y} stroke={C.border} strokeWidth="1" />
        })}
        <polyline fill="none" stroke={C.primary} strokeWidth="2.5" points={wPts} strokeLinecap="round" strokeLinejoin="round" />
        <polyline fill="none" stroke="#B8B4FF" strokeWidth="2" strokeDasharray="5,4" points={aPts} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={i} cx={gx(i)} cy={gy(d.weight)} r="4" fill="#FFFFFF" />
        ))}
      </svg>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: C.muted, fontSize: '12px' }}>
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>

      <div style={{ display: 'flex', gap: '16px', marginTop: '8px', fontSize: '12px', color: C.muted }}>
        <span><span style={{ color: C.primary }}>●</span> тегло</span>
        <span><span style={{ color: '#B8B4FF' }}>●</span> moving avg</span>
      </div>
    </div>
  )
}
