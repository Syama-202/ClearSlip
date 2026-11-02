import { C } from '../utils/colors'

export default function PrivacyPolicy({ onBack }) {
  const sections = [
    {
      title: 'What ClearSlip collects',
      content: `ClearSlip collects only what you voluntarily provide:
      
• Payslip text or image you paste or upload (processed for your request only — never saved to any server)
• Your email address, only if you choose to send a checklist to yourself via the "Email checklist" feature

We do not collect your name, phone number, Aadhaar, PAN, bank account number, or any other identifier.`,
    },
    {
      title: 'How your payslip data is used',
      content: `Your payslip text or image is sent to the ClearSlip server, where text is read from images using on-server OCR and decoded by a rule-based parser. Only if the parser cannot read your payslip confidently is the extracted text (never the image) sent to a third-party AI service (Groq) to generate the breakdown. ClearSlip does not store this data after the request completes.`,
    },
    {
      title: 'How your email is used',
      content: `If you choose to send a checklist, your email is sent to our workflow automation service (n8n) solely to deliver the one-time checklist email. Your email is not added to any marketing list, not shared with third parties, and not used for any purpose beyond this single delivery.`,
    },
    {
      title: 'Cookies and tracking',
      content: `ClearSlip does not use cookies, analytics trackers, or any third-party tracking scripts. We do not use Google Analytics, Facebook Pixel, or similar services.`,
    },
    {
      title: 'Data security',
      content: `All data transmission is encrypted via HTTPS. Your payslip data exists only in your browser memory during your session and is cleared when you close the tab or click "Start over."`,
    },
    {
      title: 'Your rights',
      content: `You have the right to know what data we hold about you and to request deletion. Since we do not store payslip data, the only data we may hold is your email address if you used the checklist feature. To request deletion, email us at: privacy@clearslip.in`,
    },
    {
      title: 'Not financial advice',
      content: `ClearSlip is an educational tool. The payslip analysis and action items are generated automatically (by rules, and sometimes AI) and may not be accurate for every situation. Nothing on ClearSlip constitutes financial, tax, or legal advice. Please consult a qualified CA for complex tax matters.`,
    },
    {
      title: 'Updates to this policy',
      content: `If we make material changes to this policy, we will update the "Last updated" date below. Continued use of ClearSlip after changes means you accept the updated policy.`,
    },
  ]

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '32px 24px', color: C.textDark }}>
      <button onClick={onBack} style={{
        background: 'none', border: 'none', color: C.saffron, fontSize: 13,
        cursor: 'pointer', padding: 0, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        ← Back to ClearSlip
      </button>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, color: C.terra, margin: '0 0 6px' }}>Privacy Policy</h1>
        <div style={{ fontSize: 13, color: C.textMuted }}>ClearSlip · Last updated June 2026</div>
      </div>

      <div style={{ fontSize: 14, color: C.textMid, lineHeight: 1.7, background: C.yellowCard, border: `1px solid ${C.amberBorder}`, borderRadius: 10, padding: '14px 18px', marginBottom: 28 }}>
        <strong style={{ color: C.terra }}>Short version:</strong> ClearSlip never stores your payslip data. Your analysis is session-only. If you email a checklist, we use your email only for that delivery and nothing else.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        {sections.map((s, i) => (
          <div key={i}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: C.terra, margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22, height: 22, background: C.yellowCard, borderRadius: 99, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: C.saffron, border: `1px solid ${C.amberBorder}`, flexShrink: 0 }}>{i + 1}</span>
              {s.title}
            </h2>
            <p style={{ fontSize: 14, color: C.textMid, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-line', paddingLeft: 30 }}>{s.content}</p>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 40, borderTop: `1px solid ${C.amberBorder}`, paddingTop: 20, fontSize: 12, color: C.textFaint, textAlign: 'center' }}>
        Questions? Email <a href="mailto:privacy@clearslip.in" style={{ color: C.saffron }}>privacy@clearslip.in</a>
      </div>
    </div>
  )
}
