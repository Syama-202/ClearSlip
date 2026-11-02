import { C } from '../utils/colors'

const PRIORITY_STYLE = {
  high: { bg: '#fef2f2', color: C.maroon, label: 'High' },
  medium: { bg: C.yellowCard, color: '#92400e', label: 'Medium' },
  low: { bg: '#f0fdf4', color: '#166534', label: 'Low' },
}

export default function ActionCard({ actionItems, onSendEmail, loading, emailSending }) {
  if (loading) return <SkeletonAction />

  return (
    <div style={{ background: C.yellowCard, borderLeft: `4px solid ${C.maroon}`, borderRadius: '0 10px 10px 0', padding: 16, marginBottom: 12 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.terra }}>What to do next</div>
        {/* No handler when the server can't send email */}
        {onSendEmail && <button
          onClick={onSendEmail}
          disabled={emailSending}
          style={{
            background: emailSending ? '#d1d5db' : C.saffron,
            color: '#fff', border: 'none', borderRadius: 6,
            padding: '5px 12px', fontSize: 12, fontWeight: 500, cursor: emailSending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', gap: 5, transition: 'background 0.15s',
          }}
          onMouseEnter={e => { if (!emailSending) e.currentTarget.style.background = C.saffronDark }}
          onMouseLeave={e => { if (!emailSending) e.currentTarget.style.background = C.saffron }}
        >
          <span>✉</span>
          {emailSending ? 'Sending…' : 'Email checklist'}
        </button>}
      </div>

      {/* Action items */}
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(actionItems ?? []).map((item, i) => {
          const ps = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.medium
          return (
            <li key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', background: C.maroon,
                color: '#fff', fontSize: 11, fontWeight: 600, display: 'flex',
                alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 99, background: ps.bg, color: ps.color, fontWeight: 500 }}>
                    {ps.label}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: C.textMid, lineHeight: 1.5 }}>{item.action}</div>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: C.saffron, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 3 }}>
                    Open official portal ↗
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function SkeletonAction() {
  return (
    <div style={{ background: C.yellowCard, borderLeft: `4px solid ${C.amberBorder}`, borderRadius: '0 10px 10px 0', padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div className="animate-shimmer" style={{ height: 14, background: C.amberBorder, borderRadius: 4, width: 120 }} />
        <div className="animate-shimmer" style={{ height: 28, background: C.amberBorder, borderRadius: 6, width: 110 }} />
      </div>
      {[0, 1, 2].map(i => (
        <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <div className="animate-shimmer" style={{ width: 22, height: 22, borderRadius: '50%', background: C.amberBorder, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4, width: '90%', marginBottom: 6 }} />
            <div className="animate-shimmer" style={{ height: 12, background: C.amberBorder, borderRadius: 4, width: '70%' }} />
          </div>
        </div>
      ))}
    </div>
  )
}
