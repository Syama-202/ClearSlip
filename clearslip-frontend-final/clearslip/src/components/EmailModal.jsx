import { useState, useEffect } from 'react'
import { C } from '../utils/colors'

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
    /* Overlay */
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(2px)', zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
    >
      {/* Card */}
      <div style={{
        background: C.cream, border: `1px solid ${C.amberBorder}`, borderRadius: 16,
        padding: 28, width: '100%', maxWidth: 380, position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}>
        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, background: 'none', border: 'none',
          fontSize: 18, color: C.textMuted, cursor: 'pointer', padding: 4,
        }}>✕</button>

        {sent ? (
          <SentState onClose={onClose} />
        ) : (
          <>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.terra, marginBottom: 6 }}>Send your checklist</div>
            <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
              We'll email your action items so you don't lose them. One email, no spam.
            </div>

            <div style={{ marginBottom: 6 }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={handleKey}
                placeholder="your@email.com"
                autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 14,
                  border: `1px solid ${emailError ? C.red : C.amberBorder}`,
                  borderRadius: 8, outline: 'none', fontFamily: 'inherit',
                  background: '#fff', color: C.textDark, boxSizing: 'border-box',
                }}
                onFocus={e => e.target.style.boxShadow = `0 0 0 3px ${C.amberBorder}`}
                onBlur={e => e.target.style.boxShadow = 'none'}
              />
              {emailError && <div style={{ fontSize: 12, color: C.red, marginTop: 4 }}>{emailError}</div>}
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                width: '100%', padding: '11px 0', border: 'none', borderRadius: 8,
                background: loading ? '#d1d5db' : C.maroon, color: '#fff',
                fontSize: 14, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8, transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = C.maroonDark }}
              onMouseLeave={e => { if (!loading) e.target.style.background = C.maroon }}
            >
              {loading ? 'Sending…' : 'Send checklist →'}
            </button>
            <div style={{ textAlign: 'center', fontSize: 11, color: C.textFaint, marginTop: 10 }}>
              No account needed. We use your email only for this checklist.
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SentState({ onClose }) {
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
      <div style={{ fontSize: 17, fontWeight: 600, color: C.terra, marginBottom: 8 }}>Checklist sent!</div>
      <div style={{ fontSize: 13, color: C.textMuted, marginBottom: 20, lineHeight: 1.5 }}>
        Check your inbox. If you don't see it in 2 minutes, check your spam folder.
      </div>
      <button onClick={onClose} style={{
        background: C.saffron, color: '#fff', border: 'none', borderRadius: 8,
        padding: '9px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer',
      }}>
        Done
      </button>
    </div>
  )
}
