import { AlertCircle, ClipboardPaste, Sparkles, RotateCcw } from 'lucide-react'

// What to say for each kind of failure: a plain title, and what to try next
const KINDS = {
  unreadable: {
    title: "We couldn't read this payslip reliably",
    tips: [
      'Paste the earnings and deductions lines instead, for example "Basic 25,000, HRA 10,000, PF 3,000".',
      'Or upload a sharper photo: bright light, the whole page in view, no blur.',
    ],
  },
  file: {
    title: "We couldn't read this file",
    tips: ['Try a JPG or PNG screenshot of the payslip, or paste its lines instead.'],
  },
  busy: {
    title: 'ClearSlip is busy right now',
    tips: ['Wait a minute and try again. Pasting the lines works without the AI, so it is never limited this way.'],
  },
  offline: {
    title: "Couldn't reach ClearSlip",
    tips: ['Check your internet connection and try again. On the free hosting plan the server can take up to a minute to wake up.'],
  },
  other: {
    title: 'Something went wrong',
    tips: ['Please try again, or paste the payslip lines instead.'],
  },
}

const KIND_BY_CODE = {
  LOW_CONFIDENCE_NO_FALLBACK: 'unreadable', FALLBACK_UNRELIABLE: 'unreadable', OCR_EMPTY: 'unreadable',
  INVALID_FILE: 'file', INVALID_PDF: 'file', UNREADABLE_PDF: 'file', OCR_FAILED: 'file', READ_ERROR: 'file',
  RATE_LIMIT_EXCEEDED: 'busy', GROQ_RATE_LIMITED: 'busy', FALLBACK_UNAVAILABLE: 'busy',
  NETWORK: 'offline', TIMEOUT: 'offline',
}

/** Shown in the results area when decoding fails, instead of a toast that disappears. */
export default function ErrorState({ error, onPaste, onTrySample, onRetry }) {
  const kind = KINDS[KIND_BY_CODE[error.code] ?? 'other']
  return (
    <div role="alert" className="rounded-2xl border border-maroon/20 bg-white p-6 md:p-8">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-maroon">
        <AlertCircle size={22} className="shrink-0" /> {kind.title}
      </h2>
      {error.message && <p className="mt-3 text-base leading-relaxed text-ink">{error.message}</p>}
      <ul className="mt-3 list-disc space-y-1 pl-6 text-base leading-relaxed text-muted">
        {kind.tips.map(t => <li key={t}>{t}</li>)}
      </ul>
      <div className="mt-5 flex flex-wrap gap-2">
        <button onClick={onPaste} className="flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white hover:bg-maroon-dark">
          <ClipboardPaste size={17} /> Paste the lines instead
        </button>
        {onRetry && (
          <button onClick={onRetry} className="flex items-center gap-2 rounded-lg border border-line px-4 py-2 text-base font-medium text-terra hover:bg-peach">
            <RotateCcw size={17} /> Try again
          </button>
        )}
        <button onClick={onTrySample} className="flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium text-saffron-600 hover:bg-peach">
          <Sparkles size={17} /> Try a sample payslip
        </button>
      </div>
    </div>
  )
}
