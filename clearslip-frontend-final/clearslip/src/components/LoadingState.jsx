import { C } from '../utils/colors'

function Shimmer({ w = '100%', h = 14, radius = 4, style = {} }) {
  return (
    <div className="animate-shimmer" style={{
      width: w, height: h, background: C.amberBorder,
      borderRadius: radius, ...style,
    }} />
  )
}

export default function LoadingState() {
  return (
    <div style={{ padding: '4px 0' }}>
      {/* Header label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Shimmer w={160} h={14} />
        <Shimmer w={80} h={20} radius={99} />
      </div>

      {/* Stat cards skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ background: '#fff', border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '12px 14px' }}>
            <Shimmer w="55%" h={11} style={{ marginBottom: 8 }} />
            <Shimmer w="75%" h={22} radius={6} />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div style={{ marginBottom: 20 }}>
        <Shimmer w={140} h={13} style={{ marginBottom: 10 }} />
        <div style={{ border: `1px solid ${C.amberBorder}`, borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ background: C.yellowCard, height: 36 }} />
          {[85, 70, 60, 75, 65].map((w, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px 14px', gap: 8, borderTop: `1px solid ${C.amberBorder}` }}>
              <Shimmer w={`${w}%`} h={12} />
              <Shimmer h={12} />
              <Shimmer h={12} />
            </div>
          ))}
          <div style={{ borderTop: `2px solid ${C.amberBorder}`, background: '#fef9ee', display: 'grid', gridTemplateColumns: '1fr 90px 90px', padding: '10px 14px', gap: 8 }}>
            <Shimmer w="40%" h={14} />
            <Shimmer h={14} />
            <Shimmer h={14} />
          </div>
        </div>
      </div>

      {/* Action card skeleton */}
      <div style={{ background: C.yellowCard, borderLeft: `4px solid ${C.amberBorder}`, borderRadius: '0 10px 10px 0', padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <Shimmer w={130} h={14} />
          <Shimmer w={110} h={28} radius={6} />
        </div>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <Shimmer w={22} h={22} radius={99} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <Shimmer w="88%" h={12} style={{ marginBottom: 6 }} />
              <Shimmer w="65%" h={12} />
            </div>
          </div>
        ))}
      </div>

      {/* Status text */}
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 13, color: C.textMuted }}>
        Decoding your payslip — this takes 5-10 seconds…
      </div>
    </div>
  )
}
