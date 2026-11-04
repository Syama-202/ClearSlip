import { useState, useEffect, useRef } from 'react'
import { ClipboardType, Camera, MessageSquareText, ArrowRight, Loader2, Sparkles } from 'lucide-react'
import ImageUpload from './ImageUpload.jsx'

// Free-form questions need the server's AI fallback; payslip lines don't
const EXAMPLES = [
  { text: 'My CTC is 8L but take-home is only ₹52k. What\'s happening?', needsAi: true },
  { text: 'Basic 25000, HRA 12500, PF 3000, TDS 4200 deducted. Am I paying too much?' },
  { text: 'Basic 30,000, HRA 15,000, Special Allowance 20,000, PF 3,600, Professional Tax 200, TDS 2,500' },
  { text: 'Fresher at IT company, first salary ₹28,000. How do I save tax?', needsAi: true },
]

const MODES = [
  { key: 'text', label: 'Paste', icon: ClipboardType },
  { key: 'image', label: 'Upload', icon: Camera },
  { key: 'describe', label: 'Describe', icon: MessageSquareText },
]

const textareaClass =
  'h-44 w-full resize-none rounded-xl border border-line bg-white p-4 text-base leading-relaxed text-ink placeholder:text-subtle focus:border-saffron-500 focus:outline-none focus:ring-4 focus:ring-saffron-100'

export default function InputPanel({ onSubmit, loading, aiAvailable, sample, pasteRequest }) {
  const [mode, setMode] = useState('text')
  const [textInput, setTextInput] = useState('')
  const [descInput, setDescInput] = useState('')
  const [imageData, setImageData] = useState(null)

  const examples = EXAMPLES.filter(ex => aiAvailable || !ex.needsAi)

  // "Try a sample payslip" fills the box so people can see what was decoded
  useEffect(() => {
    if (sample) {
      setMode('text')
      setTextInput(sample.text)
    }
  }, [sample])

  // "Paste the lines instead" (after a failed decode): switch to Paste and put the cursor there
  const textareaRef = useRef(null)
  useEffect(() => {
    if (!pasteRequest) return
    setMode('text')
    requestAnimationFrame(() => textareaRef.current?.focus())
  }, [pasteRequest])

  function handleSubmit() {
    if (mode === 'text' && !textInput.trim()) return
    if (mode === 'describe' && (!descInput.trim() || !aiAvailable)) return
    if (mode === 'image' && !imageData) return
    onSubmit(mode, mode === 'text' ? textInput : descInput, imageData)
  }

  function useExample(ex) {
    setMode('text')
    setTextInput(ex)
  }

  const canSubmit = !loading && (
    (mode === 'text' && textInput.trim()) ||
    (mode === 'describe' && descInput.trim() && aiAvailable) ||
    (mode === 'image' && imageData)
  )

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-sm md:p-6">
      <h2 className="text-lg font-semibold text-terra">Share your payslip</h2>
      <p className="mt-1 text-base text-muted">Paste the lines, upload a photo or PDF, or describe it.</p>

      {/* Mode switch */}
      <div className="mt-5 grid grid-cols-3 gap-1 rounded-xl bg-peach p-1" role="tablist">
        {MODES.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={mode === key}
            onClick={() => setMode(key)}
            className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2.5 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-saffron-500 ${
              mode === key ? 'bg-white text-saffron-600 shadow-sm' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon size={17} /> {label}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === 'text' && (
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            aria-label="Payslip text"
            placeholder={'Paste your payslip details here…\ne.g. Basic: 25000, HRA: 12500, Special Allowance: 15000, PF deducted: 3000, TDS: 4200'}
            className={textareaClass}
          />
        )}

        {mode === 'image' && <ImageUpload onImageReady={setImageData} />}

        {/* Free-form text is read by the AI fallback, so it only works when the server has one */}
        {mode === 'describe' && !aiAvailable && (
          <div className="rounded-xl border border-line bg-sand p-4 text-base leading-relaxed text-saffron-700">
            Describing your salary in your own words needs the AI helper, which isn't switched on for this site.
            Use <strong>Paste</strong> with your payslip lines (like "Basic 25,000, PF 3,000") or <strong>Upload</strong> instead.
          </div>
        )}
        {mode === 'describe' && aiAvailable && (
          <textarea
            value={descInput}
            onChange={e => setDescInput(e.target.value)}
            aria-label="Describe your salary"
            placeholder={'Describe in your own words…\ne.g. Mera CTC 8L hai, take-home 52k aa raha hai, PF aur TDS cut ho raha hai. Kya main zyada tax de raha hoon?'}
            className={textareaClass}
          />
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-maroon px-4 py-3.5 text-base font-semibold text-white transition hover:bg-maroon-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-maroon/30 disabled:cursor-not-allowed disabled:bg-stone-300"
      >
        {loading ? <><Loader2 size={18} className="animate-spin" /> Decoding…</> : <>Decode my payslip <ArrowRight size={18} /></>}
      </button>

      {/* Examples */}
      <div className="mt-6 border-t border-line pt-5">
        <div className="flex items-center gap-1.5 text-sm font-medium text-muted">
          <Sparkles size={15} /> Try an example
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {examples.map(({ text }, i) => (
            <button
              key={i}
              onClick={() => useExample(text)}
              className="rounded-lg border border-line bg-peach px-3.5 py-2.5 text-left text-sm leading-relaxed text-terra transition hover:border-saffron-500/40 hover:bg-sand"
            >
              “{text}”
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
