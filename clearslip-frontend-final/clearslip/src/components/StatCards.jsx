import { formatINR } from '../utils/formatCurrency'
import { C } from '../utils/colors'

export default function StatCards({ summary, loading }) {
  if (loading) return <SkeletonCards />

  const cards = [
    { label: 'Take-home / month', value: formatINR(summary?.takeHome), accent: C.terra, bg: '#fff', highlight: false },
    { label: 'Annual TDS', value: formatINR(summary?.tds), accent: C.maroon, bg: '#fff', highlight: false },
    { label: 'Tax you can save', value: formatINR(summary?.savingsPotential), accent: C.terra, bg: C.yellowCard, highlight: true },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {cards.map((card, i) => (
        <div key={i} style={{
          background: card.bg, border: `1px solid ${card.highlight ? '#fbbf24' : C.amberBorder}`,
          borderRadius: 10, padding: '12px 14px',
          boxShadow: card.highlight ? `0 0 0 1px #fbbf24` : 'none',
        }}>
          <div style={{ fontSize: 11, color: '#92400e', marginBottom: 4, fontWeight: 500 }}>{card.label}</div>
          <div style={{ fontSize: 22, fontWeight: 600, color: card.accent, lineHeight: 1.1 }}>{card.value}</div>
        </div>
      ))}
    </div>
  )
}

function SkeletonCards() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ background: '#fff', border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 14px' }}>
          <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4, width: '60%', marginBottom: 8 }} />
          <div className="animate-shimmer" style={{ height: 22, background: C.amberBorder, borderRadius: 4, width: '80%' }} />
        </div>
      ))}
    </div>
  )
}
