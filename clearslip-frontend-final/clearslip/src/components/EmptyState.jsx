import { ClipboardType, ScanText, ListChecks, ShieldCheck, Calculator, MessageSquareText, Play } from 'lucide-react'

const STEPS = [
  { icon: ClipboardType, title: 'Share your payslip', text: 'Paste the lines, or upload a photo or PDF — even messy two-column layouts work.' },
  { icon: ScanText, title: 'We read every line', text: 'Basic, HRA, PF, TDS and more, each explained in plain language.' },
  { icon: ListChecks, title: 'Get your next steps', text: 'Your take-home, your tax and concrete ways to save more.' },
]

const FACTS = [
  { icon: ShieldCheck, text: "Nothing is stored on our server — saving to this device is up to you" },
  { icon: Calculator, text: 'Tax rules for 2026-27 (both regimes)' },
  { icon: MessageSquareText, text: 'Describe it in plain words — Hinglish works too', needsAi: true },
]

export default function EmptyState({ aiAvailable, onTrySample }) {
  const facts = FACTS.filter(f => aiAvailable || !f.needsAi)

  return (
    <div className="rounded-2xl border border-line bg-white p-6 md:p-10">
      <span className="inline-block rounded-full bg-sand px-3 py-1 text-sm font-medium text-saffron-700">
        For first-time salaried employees in India
      </span>
      <h1 className="mt-4 max-w-2xl text-3xl font-bold tracking-tight text-terra md:text-4xl">
        Understand your payslip in plain language
      </h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
        See where every rupee of your salary goes, how much tax you pay and what you can do to keep more of it.
      </p>

      <button
        onClick={onTrySample}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-maroon px-5 py-3 text-base font-semibold text-white shadow-sm transition hover:bg-maroon-dark focus:outline-none focus-visible:ring-4 focus-visible:ring-maroon/30"
      >
        <Play size={18} /> Try a sample payslip
      </button>

      <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {STEPS.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="rounded-xl border border-line bg-cream p-5">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-saffron-500 text-white">
                <Icon size={20} />
              </span>
              <span className="text-sm font-semibold text-subtle">Step {i + 1}</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold text-terra">{title}</h3>
            <p className="mt-1 text-base leading-relaxed text-muted">{text}</p>
          </div>
        ))}
      </div>

      <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6 md:flex-row md:flex-wrap md:gap-x-8">
        {facts.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-center gap-2 text-base text-muted">
            <Icon size={18} className="shrink-0 text-good" /> {text}
          </li>
        ))}
      </ul>
    </div>
  )
}
