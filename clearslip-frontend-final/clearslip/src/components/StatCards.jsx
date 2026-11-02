import { Wallet, Landmark, PiggyBank } from 'lucide-react'
import { formatINR } from '../utils/formatCurrency'

export default function StatCards({ summary }) {
  const cards = [
    { label: 'Take-home per month', value: summary?.takeHome, icon: Wallet, hero: true },
    { label: 'Income tax (TDS) per year', value: summary?.tds, icon: Landmark },
    { label: 'Tax you could save per year', value: summary?.savingsPotential, icon: PiggyBank, good: true },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {cards.map(({ label, value, icon: Icon, hero, good }) => (
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
        </div>
      ))}
    </div>
  )
}
