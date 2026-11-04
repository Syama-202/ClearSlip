import { ArrowLeft } from 'lucide-react'
import { monthLabel } from '../utils/history'
import { formatINR } from '../utils/formatCurrency'

// Rows matched by component name, so "Basic Salary" lines up across months
function componentRows(a, b) {
  const names = []
  for (const r of [...a.result.breakdown, ...b.result.breakdown]) {
    if (!names.some(n => n.component === r.component && n.type === r.type)) names.push({ component: r.component, type: r.type })
  }
  // null, not ₹0: a line missing from one payslip isn't a zero amount
  const find = (entry, n) => entry.result.breakdown.find(r => r.component === n.component && r.type === n.type)?.monthly ?? null
  return names.map(n => ({ ...n, before: find(a, n), after: find(b, n) }))
}

const Amount = ({ value }) => (value == null ? <span className="text-sm text-subtle">not shown</span> : formatINR(value))

function Change({ before, after, goodWhenUp }) {
  if (before == null) return <span className="text-sm text-subtle">new</span>
  if (after == null) return <span className="text-sm text-subtle">not shown</span>
  const value = after - before
  if (!value) return <span className="text-subtle">—</span>
  const good = goodWhenUp ? value > 0 : value < 0
  return <span className={`font-medium ${good ? 'text-good' : 'text-bad'}`}>{value > 0 ? '+' : '−'}{formatINR(Math.abs(value))}</span>
}

/** Two saved months side by side: every component, take-home and tax, with the change. */
export default function PayslipComparison({ entries, onBack }) {
  const [a, b] = [...entries].sort((x, y) => x.month.localeCompare(y.month)) // older first
  const rows = componentRows(a, b)
  const totals = [
    { label: 'Take-home per month', before: a.result.summary.takeHome, after: b.result.summary.takeHome, goodWhenUp: true },
    { label: 'TDS per year', before: a.result.summary.tds, after: b.result.summary.tds, goodWhenUp: false },
    { label: 'Estimated tax per year', before: a.result.summary.estimatedTax, after: b.result.summary.estimatedTax, goodWhenUp: false },
  ]
  const cell = 'px-3 py-2.5 text-right tabular-nums'

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-base text-muted hover:bg-peach hover:text-ink">
        <ArrowLeft size={16} /> Back
      </button>
      <h1 className="text-2xl font-semibold text-terra md:text-3xl">{monthLabel(a.month)} → {monthLabel(b.month)}</h1>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-full min-w-[32rem] border-collapse text-left text-base">
          <thead>
            <tr className="border-b border-line bg-sand text-sm font-semibold text-saffron-700">
              <th scope="col" className="px-4 py-2.5">Per month</th>
              <th scope="col" className={cell}>{monthLabel(a.month)}</th>
              <th scope="col" className={cell}>{monthLabel(b.month)}</th>
              <th scope="col" className={cell}>Change</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={`${r.type}:${r.component}`} className="border-b border-line last:border-0">
                <th scope="row" className="px-4 py-2.5 font-medium text-ink">
                  {r.component} <span className="text-xs font-normal text-subtle">{r.type === 'deduction' ? 'deduction' : ''}</span>
                </th>
                <td className={cell}><Amount value={r.before} /></td>
                <td className={cell}><Amount value={r.after} /></td>
                <td className={cell}><Change before={r.before} after={r.after} goodWhenUp={r.type === 'earning'} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-line bg-peach">
            {totals.map(t => (
              <tr key={t.label}>
                <th scope="row" className="px-4 py-2.5 font-semibold text-terra">{t.label}</th>
                <td className={cell}><Amount value={t.before} /></td>
                <td className={cell}><Amount value={t.after} /></td>
                <td className={cell}><Change before={t.before} after={t.after} goodWhenUp={t.goodWhenUp} /></td>
              </tr>
            ))}
          </tfoot>
        </table>
      </div>
      <p className="text-sm text-muted">Green is better for you (more pay, less tax); red is worse. &ldquo;Not shown&rdquo; means that payslip has no such line — it may have been paid separately, so it isn&apos;t counted as ₹0.</p>
    </div>
  )
}
