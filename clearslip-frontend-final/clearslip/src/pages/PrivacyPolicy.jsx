import { ArrowLeft } from 'lucide-react'

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
      content: `When you upload a photo or PDF, ClearSlip reads it in your own browser: the file itself is not uploaded, only the text found in it is sent to the ClearSlip server. (The text reader's engine and English language data, like the site's fonts, come from ClearSlip's own website, so your browser contacts no other service while reading it. If your browser can't run the reader, the file is sent to the ClearSlip server to be read instead, and discarded straight after.) Pasted text is sent as typed. On the server, a rule-based parser decodes the text. Only if the parser cannot read your payslip confidently is the extracted text (never the image) sent to a third-party AI service (Groq) to generate the breakdown. Before that, ClearSlip removes personal identifiers it can recognise — your name, employee code, PAN, Aadhaar, bank account and IFSC, UAN, phone number and email — so only the salary lines are sent. Figures read by the AI are checked (they must add up) and labelled "AI estimate". ClearSlip does not store this data after the request completes.`,
    },
    {
      title: 'Questions you ask Ask ClearSlip',
      content: `Ask ClearSlip answers are written by a third-party AI service (Groq). When you ask a question, the question — and, if you have decoded a payslip, its figures (component names and amounts, never the image) — is sent through the ClearSlip server to Groq. Untick "Use my payslip figures" above the question box to send only your question. When AI answers are switched off or unavailable, nothing is sent to Groq and you see the matching passages from the tax rules instead. ClearSlip does not store your questions or the answers. If you press "Yes" or "No" under "Was this helpful?", the server records only that rating, the kind of answer, and which passages of the tax rules it showed — never your question, the answer or anything from your payslip.

The "What if…?" tax simulator sends the figures you set to the ClearSlip server only, to calculate your tax. They are not sent to any AI service and not stored.`,
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
      content: `All data transmission is encrypted via HTTPS. Your payslip data exists only in your browser memory during your session and is cleared when you close the tab or click "Start over" — unless you choose "Save to this device". Saved payslips are kept in your browser's local storage on this device only (without the "Read from" lines, which can quote your name); ClearSlip's server never receives them. Delete them any time from "Saved on this device", or by clearing this site's data in your browser.`,
    },
    {
      title: 'Your rights',
      content: `You have the right to know what data we hold about you and to request deletion. Since we do not store payslip data, the only data we may hold is your email address if you used the checklist feature. To request deletion, email us at: syamainala@gmail.com`,
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
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-ink md:px-8">
      <button onClick={onBack} className="mb-8 flex items-center gap-1.5 text-base font-medium text-saffron-600 hover:text-saffron-700">
        <ArrowLeft size={18} /> Back to ClearSlip
      </button>

      <h1 className="text-3xl font-bold tracking-tight text-terra md:text-4xl">Privacy Policy</h1>
      <div className="mt-2 text-base text-muted">ClearSlip · Last updated November 2026</div>

      <div className="mt-8 rounded-2xl border border-line bg-sand px-5 py-4 text-base leading-relaxed text-ink">
        <strong className="text-terra">Short version:</strong> ClearSlip never stores your payslip data. Your analysis is session-only. Questions you ask Ask ClearSlip go to a third-party AI (Groq) with your payslip figures, unless you switch that off. If you email a checklist, we use your email only for that delivery and nothing else.
      </div>

      <div className="mt-10 flex flex-col gap-8">
        {sections.map((s, i) => (
          <section key={i}>
            <h2 className="flex items-center gap-3 text-xl font-semibold text-terra">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line bg-sand text-sm font-bold text-saffron-600">{i + 1}</span>
              {s.title}
            </h2>
            <p className="mt-2 whitespace-pre-line pl-11 text-base leading-relaxed text-muted">{s.content}</p>
          </section>
        ))}
      </div>

      <div className="mt-12 border-t border-line pt-6 text-center text-base text-muted">
        Questions? Email <a href="mailto:syamainala@gmail.com" className="font-medium text-saffron-600 hover:underline">syamainala@gmail.com</a>
      </div>
    </div>
  )
}
