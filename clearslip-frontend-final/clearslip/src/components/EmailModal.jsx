import { useState, useEffect } from 'react'
import { X, CheckCircle2 } from 'lucide-react'

export default function EmailModal({ isOpen, onClose, onSubmit, loading, sent }) {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState('')

  useEffect(() => {
    if (!isOpen) { setEmail(''); setEmailError('') }
  }, [isOpen])

  if (!isOpen) return null

  function validate(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)
  }

  function handleSubmit() {
    if (!validate(email)) { setEmailError('Please enter a valid email address'); return }
    setEmailError('')
    onSubmit(email)
  }

  function handleKey(e) { if (e.key === 'Enter') handleSubmit() }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
    >
      <div role="dialog" aria-modal="true" aria-labelledby="email-modal-title"
        className="relative w-full max-w-md rounded-2xl border border-line bg-cream p-7 shadow-2xl">
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-1.5 text-muted hover:bg-peach" aria-label="Close">
          <X size={20} />
        </button>

        {sent ? (
          <div className="py-2 text-center">
            <CheckCircle2 size={48} className="mx-auto text-good" />
            <h2 className="mt-3 text-xl font-semibold text-terra">Checklist sent!</h2>
            <p className="mt-2 text-base leading-relaxed text-muted">
              Check your inbox. If you don't see it in 2 minutes, check your spam folder.
            </p>
            <button onClick={onClose} className="mt-5 rounded-xl bg-saffron-500 px-6 py-2.5 text-base font-semibold text-white hover:bg-saffron-600">
              Done
            </button>
          </div>
        ) : (
          <>
            <h2 id="email-modal-title" className="text-xl font-semibold text-terra">Send your checklist</h2>
            <p className="mt-1.5 text-base leading-relaxed text-muted">
              We'll email your action items so you don't lose them. One email, no spam.
            </p>

            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={handleKey}
              placeholder="your@email.com"
              aria-label="Email address"
              autoFocus
              className={`mt-5 w-full rounded-xl border bg-white px-4 py-3 text-base text-ink focus:outline-none focus:ring-4 focus:ring-saffron-100 ${emailError ? 'border-bad' : 'border-line focus:border-saffron-500'}`}
            />
            {emailError && <div className="mt-1.5 text-sm text-bad">{emailError}</div>}

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="mt-4 w-full rounded-xl bg-maroon py-3 text-base font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              {loading ? 'Sending…' : 'Send checklist →'}
            </button>
            <p className="mt-3 text-center text-sm text-muted">
              No account needed. We use your email only for this checklist.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
