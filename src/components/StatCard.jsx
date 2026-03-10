import { C, EASE } from '../theme'

export default function StatCard({ label, value, accent, sub }) {
  return (
    <div style={{
      background:   accent
        ? 'linear-gradient(145deg, rgba(196,233,191,0.1) 0%, rgba(196,233,191,0.06) 100%)'
        : 'linear-gradient(145deg, #1C1A19 0%, rgba(25,23,22,0.97) 100%)',
      border:       `1px solid ${accent ? 'rgba(196,233,191,0.18)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: '16px',
      padding:      '18px 20px',
      transition:   `box-shadow 0.25s ${EASE.standard}, transform 0.25s ${EASE.standard}, border-color 0.25s ${EASE.standard}`,
      cursor:       'default',
    }}
    onMouseEnter={e => {
      e.currentTarget.style.transform   = 'translateY(-2px)'
      e.currentTarget.style.boxShadow   = '0 6px 24px rgba(0,0,0,0.45)'
      e.currentTarget.style.borderColor = accent ? 'rgba(196,233,191,0.28)' : 'rgba(255,255,255,0.1)'
    }}
    onMouseLeave={e => {
      e.currentTarget.style.transform   = 'translateY(0)'
      e.currentTarget.style.boxShadow   = 'none'
      e.currentTarget.style.borderColor = accent ? 'rgba(196,233,191,0.18)' : 'rgba(255,255,255,0.06)'
    }}
    >
      <div style={{
        fontSize:      '10.5px',
        color:         C.muted,
        marginBottom:  '8px',
        textTransform: 'uppercase',
        letterSpacing: '0.9px',
        fontWeight:    700,
      }}>
        {label}
      </div>
      <div style={{
        fontSize:   '26px',
        fontWeight: 800,
        color:      accent ? C.primary : C.text,
        lineHeight: 1.1,
        letterSpacing: '-0.5px',
        fontFamily: "'Space Grotesk', sans-serif",
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: C.muted, marginTop: '6px', letterSpacing: '0.2px' }}>
          {sub}
        </div>
      )}
    </div>
  )
}
