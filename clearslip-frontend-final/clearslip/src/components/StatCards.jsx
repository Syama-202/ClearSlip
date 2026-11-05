import { Wallet, Landmark, PiggyBank } from 'lucide-react'
import { formatINR } from '../utils/formatCurrency'

// Same tolerance as the server's TDS check: smaller gaps are just TDS varying month to month
const TDS_GAP_TOLERANCE = 6000

function tdsHint({ tds, estimatedTax }, hasOneOff) {
  if (estimatedTax == null || tds == null) return null
  // A bonus month's TDS includes tax on the bonus, so ×12 overstates the year
  if (hasOneOff) {
    return { text: `At this month's rate. This month includes a one-off payment, so its TDS is probably higher than usual; tax on your year is about ${formatINR(estimatedTax)}.` }
  }
  if (tds - estimatedTax > TDS_GAP_TOLERANCE) {
    return { text: `Tax due on your salary is about ${formatINR(estimatedTax)}, so you may be overpaying.`, warn: true }
  }
  if (estimatedTax - tds > TDS_GAP_TOLERANCE) {
    return { text: `Tax due on your salary is about ${formatINR(estimatedTax)}, so TDS may rise later in the year.` }
  }
  return null
}

function savingsHint({ savingsPotential, estimatedTax }) {
  if (savingsPotential == null) return null
  if (savingsPotential > 0) return { text: 'By using your full 80C and NPS limits under the old regime.' }
  if (estimatedTax === 0) return { text: 'No tax is due on your salary under the new regime, so there is nothing to save.' }
  return { text: 'The new regime already gives you the lowest tax, so 80C or NPS investments won’t cut it. Rent or a home loan might: try What if…? below.' }
}

export default function StatCards({ summary, breakdown }) {
  const hasOneOff = breakdown?.some(r => r.oneOff && r.type === 'earning')
  const cards = [
    { label: 'Take-home per month', value: summary?.takeHome, icon: Wallet, hero: true },
    { label: 'Income tax (TDS) per year', value: summary?.tds, icon: Landmark, hint: tdsHint(summary ?? {}, hasOneOff) },
    { label: 'Tax you could save per year', value: summary?.savingsPotential, icon: PiggyBank, good: true, hint: savingsHint(summary ?? {}) },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon, hero, good, hint }) => (
        <div
          key={label}
          className={`rounded-2xl border p-5 ${hero ? 'border-maroon bg-maroon text-white shadow-md' : 'border-line bg-white'}`}
        >
          <div className={`flex items-center gap-2 text-sm font-medium ${hero ? 'text-white/85' : 'text-muted'}`}>
            <Icon size={18} className={hero ? 'text-white/85' : good ? 'text-good' : 'text-saffron-600'} />
            {label}
          </div>
          <div className={`mt-2 text-3xl font-semibold tabular-nums tracking-tight ${hero ? 'text-white' : good ? 'text-good' : 'text-terra'}`}>
            {formatINR(value)}
          </div>
          {hint && <p className={`mt-1.5 text-sm leading-snug ${hint.warn ? 'font-medium text-bad' : 'text-muted'}`}>{hint.text}</p>}
        </div>
      ))}
    </div>
  )
}
