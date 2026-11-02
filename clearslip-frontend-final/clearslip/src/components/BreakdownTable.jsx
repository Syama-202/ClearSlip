import { useState } from 'react'
import { formatINR } from '../utils/formatCurrency'
import { C } from '../utils/colors'

export default function BreakdownTable({ breakdown, loading }) {
  const [hoverIdx, setHoverIdx] = useState(null)

  if (loading) return <SkeletonTable />

  const earnings = breakdown?.filter(r => r.type === 'earning') ?? []
  const deductions = breakdown?.filter(r => r.type === 'deduction') ?? []
  const totalMonthly = earnings.reduce((s, r) => s + (r.monthly || 0), 0) - deductions.reduce((s, r) => s + (r.monthly || 0), 0)
  const totalAnnual = totalMonthly * 12

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: C.terra, marginBottom: 10 }}>Payslip breakdown</div>
      <div style={{ border: `1px solid ${C.amberBorder}`, borderRadius: 10, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ background: C.yellowCard, display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '8px 14px', gap: 8 }}>
          {['Component', 'Monthly', 'Annual'].map(h => (
            <div key={h} style={{ fontSize: 12, fontWeight: 500, color: '#92400e' }}>{h}</div>
          ))}
        </div>

        {/* Earnings */}
        {earnings.length > 0 && (
          <div style={{ padding: '4px 0' }}>
            <SectionLabel label="Earnings" />
            {earnings.map((row, i) => (
              <Row key={i} row={row} idx={i} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} />
            ))}
          </div>
        )}

        {/* Deductions */}
        {deductions.length > 0 && (
          <div style={{ borderTop: `1px solid ${C.amberBorder}`, padding: '4px 0' }}>
            <SectionLabel label="Deductions" />
            {deductions.map((row, i) => (
              <Row key={i} row={row} idx={earnings.length + i} hoverIdx={hoverIdx} setHoverIdx={setHoverIdx} isDeduction />
            ))}
          </div>
        )}

        {/* Total */}
        <div style={{ borderTop: `2px solid ${C.amberBorder}`, background: '#fef9ee', display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px 14px', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>Take-home</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>{formatINR(totalMonthly)}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>{formatINR(totalAnnual)}</div>
        </div>
      </div>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div style={{ padding: '4px 14px', fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 500 }}>
      {label}
    </div>
  )
}

function Row({ row, idx, hoverIdx, setHoverIdx, isDeduction }) {
  const isHovered = hoverIdx === idx
  return (
    <div
      onMouseEnter={() => setHoverIdx(idx)}
      onMouseLeave={() => setHoverIdx(null)}
      style={{
        display: 'grid', gridTemplateColumns: '1fr 90px 90px',
        padding: '7px 14px', gap: 8, position: 'relative', cursor: 'default',
        background: isHovered ? (isDeduction ? '#fef2f2' : C.saffronLight) : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{ fontSize: 13, color: C.textMid, display: 'flex', alignItems: 'center', gap: 6 }}>
        {row.component}
        <span style={{ fontSize: 11, color: C.textFaint, cursor: 'help' }} title={row.explanation}>ⓘ</span>
      </div>
      <div style={{ fontSize: 13, color: isDeduction ? C.red : C.textDark, fontWeight: 500 }}>
        {isDeduction ? '−' : ''}{formatINR(row.monthly)}
      </div>
      <div style={{ fontSize: 13, color: isDeduction ? C.red : C.textDark, fontWeight: 500 }}>
        {isDeduction ? '−' : ''}{formatINR(row.annual)}
      </div>

      {/* Tooltip */}
      {isHovered && row.explanation && (
        <div style={{
          position: 'absolute', left: 14, bottom: '100%', zIndex: 20,
          background: C.maroonDark, color: '#fff', fontSize: 12, padding: '6px 10px',
          borderRadius: 6, maxWidth: 280, lineHeight: 1.5,
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)', pointerEvents: 'none',
        }}>
          {row.explanation}
        </div>
      )}
    </div>
  )
}

function SkeletonTable() {
  return (
    <div style={{ border: `1px solid ${C.amberBorder}`, borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
      <div style={{ background: C.yellowCard, height: 36 }} />
      {[0, 1, 2, 3, 4].map(i => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px 14px', gap: 8, borderTop: i === 0 ? 'none' : `1px solid ${C.amberBorder}` }}>
          <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4, width: `${50 + (i * 10) % 35}%` }} />
          <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4 }} />
          <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}
