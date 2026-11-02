import { useState } from 'react'
import ImageUpload from './ImageUpload.jsx'
import { C } from '../utils/colors'

const EXAMPLES = [
  'My CTC is 8L but take-home is only ₹52k. What\'s happening?',
  'Basic 25000, HRA 12500, PF 3000, TDS 4200 deducted. Am I paying too much?',
  'Fresher at IT company, first salary ₹28,000. How do I save tax?',
]

const MODES = [
  { key: 'text', label: 'Paste text' },
  { key: 'image', label: 'Upload photo' },
  { key: 'describe', label: 'Describe it' },
]

export default function InputPanel({ onSubmit, loading }) {
  const [mode, setMode] = useState('text')
  const [textInput, setTextInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [imageData, setImageData] = useState(null)

  function handleSubmit() {
    if (mode === 'text' && !textInput.trim()) return
    if (mode === 'describe' && !descInput.trim()) return
    if (mode === 'image' && !imageData) return
    onSubmit(mode, mode === 'text' ? textInput : descInput, imageData)
  }

  function useExample(ex) {
    setMode('text')
    setTextInput(ex)
  }

  const canSubmit = !loading && (
    (mode === 'text' && textInput.trim()) ||
    (mode === 'describe' && descInput.trim()) ||
    (mode === 'image' && imageData)
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, height: '100%' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: C.terra, marginBottom: 10 }}>
          How do you want to share your payslip?
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)} style={{
              padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: mode === m.key ? 500 : 400,
              background: mode === m.key ? C.yellowCard : '#fff',
              border: `1px solid ${mode === m.key ? C.amberBorder : '#e5e7eb'}`,
              color: mode === m.key ? C.terra : C.textMuted, cursor: 'pointer', transition: 'all 0.15s',
            }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Text mode */}
      {mode === 'text' && (
        <textarea
          value={textInput}
          onChange={e => setTextInput(e.target.value)}
          placeholder="Paste your payslip details here…&#10;e.g. Basic: 25000, HRA: 12500, Special Allowance: 15000, PF deducted: 3000, TDS: 4200"
          style={{
            width: '100%', height: 120, border: `1px solid ${C.amberBorder}`, borderRadius: 8,
            padding: 12, fontSize: 13, color: C.textDark, resize: 'none', fontFamily: 'inherit',
            background: '#fff', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.boxShadow = `0 0 0 3px ${C.amberBorder}`}
          onBlur={e => e.target.style.boxShadow = 'none'}
        />
      )}

      {/* Image mode */}
      {mode === 'image' && (
        <ImageUpload onImageReady={setImageData} />
      )}

      {/* Describe mode */}
      {mode === 'describe' && (
        <textarea
          value={descInput}
          onChange={e => setDescInput(e.target.value)}
          placeholder="Describe in your own words…&#10;e.g. Mera CTC 8L hai, take-home 52k aa raha hai, PF aur TDS cut ho raha hai. Kya main zyada tax de raha hoon?"
          style={{
            width: '100%', height: 120, border: `1px solid ${C.amberBorder}`, borderRadius: 8,
            padding: 12, fontSize: 13, color: C.textDark, resize: 'none', fontFamily: 'inherit',
            background: '#fff', outline: 'none', lineHeight: 1.6, boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.boxShadow = `0 0 0 3px ${C.amberBorder}`}
          onBlur={e => e.target.style.boxShadow = 'none'}
        />
      )}

      {/* CTA */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
          background: canSubmit ? C.maroon : '#d1d5db',
          color: '#fff', fontSize: 14, fontWeight: 500, cursor: canSubmit ? 'pointer' : 'not-allowed',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { if (canSubmit) e.target.style.background = C.maroonDark }}
        onMouseLeave={e => { if (canSubmit) e.target.style.background = C.maroon }}
      >
        {loading ? 'Decoding…' : 'Decode my payslip →'}
      </button>

      {/* Examples */}
      <div style={{ borderTop: `1px solid ${C.amberBorder}`, paddingTop: 14 }}>
        <div style={{ fontSize: 12, color: C.textMuted, marginBottom: 8, fontWeight: 500 }}>Try an example</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {EXAMPLES.map((ex, i) => (
            <button key={i} onClick={() => useExample(ex)} style={{
              background: C.peach, border: `1px solid ${C.amberBorder}`, borderRadius: 6,
              padding: '7px 10px', fontSize: 12, color: C.terra, cursor: 'pointer',
              textAlign: 'left', lineHeight: 1.5, transition: 'background 0.1s',
            }}
              onMouseEnter={e => e.currentTarget.style.background = C.yellowCard}
              onMouseLeave={e => e.currentTarget.style.background = C.peach}
            >
              "{ex}"
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
