import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, Loader2, Calculator, BookOpen, ExternalLink, RotateCcw, AlertCircle, AlertTriangle, Wallet, HelpCircle, ListChecks } from 'lucide-react'
import AnswerText from './AnswerText.jsx'
import useAsk from '../hooks/useAsk.js'
import { formatINR } from '../utils/formatCurrency'

const GENERAL_QUESTIONS = [
  'Do I pay any tax on a ₹10 lakh salary?',
  'Which tax regime should I choose?',
  'How is HRA exemption calculated?',
  'Why is PF deducted from my salary?',
]

const PAYSLIP_QUESTIONS = [
  'Which tax regime is better for me?',
  'How much HRA can I claim if I pay ₹15,000 rent in Bengaluru?',
  'How can I reduce my tax?',
  'Why is my take-home lower than my CTC?',
]

const TOOL_LABELS = {
  compare_tax_regimes: 'Compared both tax regimes',
  calculate_tax: 'Calculated income tax',
  calculate_hra_exemption: 'Calculated HRA exemption',
}

// One line with the calculator's key result, so the number in the answer is traceable
function toolSummary({ name, result }) {
  if (!result || result.error) return null
  if (name === 'compare_tax_regimes') {
    return `New regime ${formatINR(result.newRegime.totalTax)} · Old regime ${formatINR(result.oldRegime.totalTax)} per year`
  }
  if (name === 'calculate_tax') return `${result.regime === 'old' ? 'Old' : 'New'} regime: ${formatINR(result.totalTax)} on taxable income ${formatINR(result.taxableIncome)}`
  if (name === 'calculate_hra_exemption') return `Exempt ${formatINR(result.exemption)} of ${formatINR(result.limits.actualHraReceived)} HRA per year`
  return null
}

/**
 * Ask ClearSlip — questions answered from the tax knowledge base with cited
 * sources. Given a decoded `payslip`, answers can use the user's own figures.
 */
export default function AskPanel({ payslip, aiAvailable }) {
  // The payslip's figures go to the AI with each question unless the user opts out
  const [usePayslip, setUsePayslip] = useState(true)
  const sharedPayslip = usePayslip ? payslip : null
  const { messages, loading, ask, reset } = useAsk(sharedPayslip)
  const [input, setInput] = useState('')
  const endRef = useRef(null)
  const suggestions = sharedPayslip ? PAYSLIP_QUESTIONS : GENERAL_QUESTIONS

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, loading])

  function submit(question) {
    const q = (question ?? input).trim()
    if (!q || loading) return
    setInput('')
    ask(q)
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-terra">
            <Sparkles size={20} className="text-saffron-500" /> Ask ClearSlip
          </h2>
          <p className="mt-1 text-base text-muted">
            {sharedPayslip ? 'Questions about your payslip and tax, ' : 'Questions about salary and income tax, '}
            answered from official tax rules — with sources.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${aiAvailable ? 'bg-green-50 text-good' : 'bg-sand text-saffron-700'}`}>
            {aiAvailable ? 'AI answers with sources' : 'Sources only — AI is off'}
          </span>
          {messages.length > 0 && (
            <button onClick={reset} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-peach hover:text-ink">
              <RotateCcw size={14} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Conversation. A screen reader announces each new message once: the bubble
          being streamed is aria-busy, and the finished answer replaces it whole. */}
      {messages.length > 0 && (
        <div role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation" className="mt-5 flex flex-col gap-4">
          {messages.map((m, i) => m.role === 'user'
            ? <UserMessage key={i} text={m.content} />
            : <AssistantMessage key={i} message={m} idPrefix={`msg${i}`} onAsk={submit} />)}
          {loading && !messages.at(-1)?.streaming && (
            <div className="flex items-center gap-2 text-base text-muted">
              <Loader2 size={18} className="animate-spin text-saffron-500" /> Searching the tax rules…
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {/* Suggestions until the first question */}
      {messages.length === 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {suggestions.map(q => (
            <button
              key={q}
              onClick={() => submit(q)}
              className="rounded-full border border-line bg-peach px-3.5 py-2 text-left text-sm text-terra transition hover:border-saffron-500/40 hover:bg-sand"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {payslip && (
        <label className="mt-5 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={usePayslip}
            onChange={e => setUsePayslip(e.target.checked)}
            className="h-4 w-4 accent-saffron-500"
          />
          Use my payslip figures in answers
        </label>
      )}

      {/* Input */}
      <form onSubmit={e => { e.preventDefault(); submit() }} className={`${payslip ? 'mt-2' : 'mt-5'} flex gap-2`}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about PF, HRA, TDS, tax regimes…"
          aria-label="Your question"
          maxLength={500}
          className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-subtle focus:border-saffron-500 focus:outline-none focus:ring-4 focus:ring-saffron-100"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="flex items-center gap-2 rounded-xl bg-maroon px-4 py-3 text-base font-semibold text-white transition hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-stone-300"
          aria-label="Ask"
        >
          <Send size={18} /> <span className="hidden sm:inline">Ask</span>
        </button>
      </form>
      <p className="mt-2 text-sm text-subtle">
        {aiAvailable && `Answers are written by a third-party AI (Groq), which receives your question${sharedPayslip ? ' and payslip figures' : ''}. `}
        General information, not financial advice. Don't include PAN, Aadhaar or bank details.
      </p>
    </div>
  )
}

function UserMessage({ text }) {
  return (
    <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-maroon px-4 py-2.5 text-base text-white">
      {text}
    </div>
  )
}

// The four labelled parts of an answer (see answerChecks.js on the server), so the
// user can tell their own figures from general rules, calculations and gaps
const PART_STYLE = {
  payslip: { label: 'Your payslip', icon: Wallet },
  explanation: { label: 'Explanation', icon: BookOpen },
  calculation: { label: 'Calculation', icon: Calculator },
  next: { label: 'Next steps', icon: ListChecks },
  missing: { label: 'Not in my sources', icon: HelpCircle },
}

function AnswerPart({ part, sources, idPrefix }) {
  const { label, icon: Icon } = PART_STYLE[part.kind] ?? PART_STYLE.explanation
  return (
    <section aria-label={label}>
      <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-saffron-700">
        <Icon size={14} /> {label}
      </h3>
      <div className={part.kind === 'missing' ? 'text-muted' : ''}>
        <AnswerText text={part.text} sources={sources} idPrefix={idPrefix} />
      </div>
    </section>
  )
}

// What the server's checks found, in plain words; nothing shows when all is well
function AnswerChecks({ checks }) {
  const notes = []
  if (checks.untracedAmounts?.length) {
    notes.push(`We couldn't trace ${checks.untracedAmounts.join(', ')} to your payslip, a calculation or a source, so double-check ${checks.untracedAmounts.length > 1 ? 'these figures' : 'this figure'}.`)
  }
  // A figure the user typed is theirs to give, but the answer repeating it doesn't make it a rule
  if (checks.fromQuestion?.length) {
    notes.push(`${checks.fromQuestion.join(', ')} ${checks.fromQuestion.length > 1 ? 'come' : 'comes'} from your question, not from your payslip, a calculation or a source, so don't take ${checks.fromQuestion.length > 1 ? 'them' : 'it'} as confirmed.`)
  }
  if (checks.calculationWithoutTool) notes.push("This calculation wasn't done by ClearSlip's tax calculator, so treat it as approximate.")
  if (checks.noCitations) notes.push('No source was cited for this answer, so treat it as general guidance.')
  if (!notes.length) return null
  return (
    <div role="note" className="mt-4 space-y-1 rounded-lg border border-saffron-500/40 bg-sand px-3 py-2 text-sm text-terra">
      {notes.map(n => <p key={n} className="flex gap-2"><AlertTriangle size={15} className="mt-0.5 shrink-0 text-saffron-600" />{n}</p>)}
    </div>
  )
}

function AssistantMessage({ message, idPrefix, onAsk }) {
  // Being written: plain text for now; the checked answer, in parts, replaces it when done
  if (message.streaming) {
    return (
      <div className="rounded-2xl rounded-bl-md border border-line bg-cream p-4 md:p-5" aria-busy="true">
        {message.text
          ? <AnswerText text={message.text} sources={[]} idPrefix={idPrefix} />
          : <p className="flex items-center gap-2 text-base text-muted"><Calculator size={18} className="text-saffron-600" /> Working it out with the tax calculator…</p>}
        <p className="mt-3 flex items-center gap-2 text-sm text-subtle"><Loader2 size={14} className="animate-spin" /> Writing… sources and checks appear when it&apos;s done</p>
      </div>
    )
  }

  if (message.error) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-maroon/20 bg-maroon-light px-4 py-3 text-base text-maroon">
        <AlertCircle size={18} className="mt-0.5 shrink-0" /> {message.error}
      </div>
    )
  }

  const { mode, answer, parts, sources, cited, toolCalls, notice, suggestions, checks } = message.data
  // Show the passages the answer cites; in sources-only mode, show the passages themselves
  const shownSources = mode === 'rag' ? sources.filter(s => cited.includes(s.n)) : sources

  return (
    <div className="rounded-2xl rounded-bl-md border border-line bg-cream p-4 md:p-5">
      {mode === 'retrieval-only' && (
        <p className="mb-3 text-base text-muted">
          {notice ?? 'AI answers are switched off on this server, so here are the most relevant passages from the tax rules:'}
        </p>
      )}

      {parts
        ? <div className="space-y-4">{parts.map((part, i) => <AnswerPart key={i} part={part} sources={sources} idPrefix={idPrefix} />)}</div>
        : answer && <AnswerText text={answer} sources={sources} idPrefix={idPrefix} />}

      {checks && <AnswerChecks checks={checks} />}

      {/* A vague question gets these instead of a refusal; clicking one asks it */}
      {suggestions?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map(q => (
            <button key={q} onClick={() => onAsk(q)} className="rounded-full border border-line bg-peach px-3.5 py-2 text-left text-sm text-terra transition hover:border-saffron-500/40 hover:bg-sand">
              {q}
            </button>
          ))}
        </div>
      )}

      {toolCalls?.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {toolCalls.map((call, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-sm text-muted">
              <Calculator size={16} className="mt-0.5 shrink-0 text-saffron-600" />
              <span>
                <span className="font-medium text-ink">{TOOL_LABELS[call.name] ?? call.name}</span> with ClearSlip's tax calculator
                {toolSummary(call) && <> — {toolSummary(call)}</>}
              </span>
            </div>
          ))}
        </div>
      )}

      {shownSources.length > 0 && (
        <div className="mt-4 border-t border-line pt-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-muted">
            <BookOpen size={15} /> Sources
          </div>
          <ol className="mt-2 flex flex-col gap-2">
            {shownSources.map(s => (
              <li key={s.n} id={`${idPrefix}-source-${s.n}`} className="rounded-lg bg-white px-3 py-2.5 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded bg-sand px-1 text-xs font-semibold text-saffron-700">{s.n}</span>
                  <span className="font-medium text-ink">{s.title} — {s.section}</span>
                </div>
                <div className="mt-0.5 text-subtle">{s.reference}</div>
                {mode === 'retrieval-only' && <p className="mt-2 leading-relaxed text-muted">{s.text}</p>}
                {s.source && (
                  <a href={s.source} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-medium text-saffron-600 hover:underline">
                    Official source <ExternalLink size={13} />
                  </a>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
