import { C } from '../utils/colors'

const TIPS = [
  '📋 Copy-paste your payslip text directly — even messy formats work',
  '📸 Take a photo of your physical payslip for instant decode',
  '🗣️ Describe it in plain words — Hinglish works perfectly',
]

export default function EmptyState({ onExample }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', height: '100%', textAlign: 'center',
    }}>
      {/* Icon */}
      <div style={{
        width: 72, height: 72, background: C.yellowCard, border: `2px solid ${C.amberBorder}`,
        borderRadius: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, marginBottom: 20,
      }}>💰</div>

      <div style={{ fontSize: 18, fontWeight: 600, color: C.terra, marginBottom: 8 }}>
        Understand your payslip in seconds
      </div>
      <div style={{ fontSize: 14, color: C.textMuted, marginBottom: 28, maxWidth: 340, lineHeight: 1.6 }}>
        Paste your payslip on the left and ClearSlip will decode every deduction — in plain English, with exact next steps to save more.
      </div>

      {/* Tips */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 360, marginBottom: 28 }}>
        {TIPS.map((tip, i) => (
          <div key={i} style={{
            background: C.peach, border: `1px solid ${C.amberBorder}`,
            borderRadius: 8, padding: '9px 14px', fontSize: 13, color: C.terra,
            textAlign: 'left', lineHeight: 1.5,
          }}>
            {tip}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 12, color: C.textFaint }}>
        🔒 Your payslip data is never stored or shared
      </div>
    </div>
  )
}
