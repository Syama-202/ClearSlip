import { formatINR } from '../utils/formatCurrency'

// Each row shows what the component means right under its name, since
// explaining the payslip is the point (a hover-only tooltip hid it)
export default function BreakdownTable({ breakdown }) {
  const earnings = breakdown?.filter(r => r.type === 'earning') ?? []
  const deductions = breakdown?.filter(r => r.type === 'deduction') ?? []
  const totalMonthly = earnings.reduce((s, r) => s + (r.monthly || 0), 0) - deductions.reduce((s, r) => s + (r.monthly || 0), 0)
  const totalAnnual = totalMonthly * 12

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <h2 className="px-5 pb-3 pt-5 text-lg font-semibold text-terra">Payslip breakdown</h2>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-y border-line bg-sand text-sm font-semibold text-saffron-700">
            <th scope="col" className="px-5 py-2.5">Component</th>
            <th scope="col" className="w-28 px-3 py-2.5 text-right sm:w-36">Monthly</th>
            <th scope="col" className="hidden w-36 px-5 py-2.5 text-right sm:table-cell">Annual</th>
          </tr>
        </thead>
        {earnings.length > 0 && (
          <tbody>
            <SectionLabel label="Earnings" />
            {earnings.map(row => <Row key={row.component} row={row} />)}
          </tbody>
        )}
        {deductions.length > 0 && (
          <tbody className="border-t border-line">
            <SectionLabel label="Deductions" />
            {deductions.map(row => <Row key={row.component} row={row} isDeduction />)}
          </tbody>
        )}
        <tfoot>
          <tr className="border-t-2 border-line bg-peach text-base font-semibold text-terra">
            <th scope="row" className="px-5 py-4">Take-home</th>
            <td className="px-3 py-4 text-right tabular-nums">{formatINR(totalMonthly)}</td>
            <td className="hidden px-5 py-4 text-right tabular-nums sm:table-cell">{formatINR(totalAnnual)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <tr>
      <th colSpan={3} scope="colgroup" className="px-5 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-subtle">
        {label}
      </th>
    </tr>
  )
}

function Row({ row, isDeduction }) {
  const amountClass = `text-right text-base font-medium tabular-nums ${isDeduction ? 'text-bad' : 'text-ink'}`
  return (
    <tr className="align-top transition-colors hover:bg-cream">
      <td className="px-5 py-3">
        <div className="text-base font-medium text-ink">{row.component}</div>
        {row.explanation && <div className="mt-0.5 text-sm leading-relaxed text-muted">{row.explanation}</div>}
      </td>
      <td className={`px-3 py-3 ${amountClass}`}>{isDeduction ? '−' : ''}{formatINR(row.monthly)}</td>
      <td className={`hidden px-5 py-3 sm:table-cell ${amountClass}`}>{isDeduction ? '−' : ''}{formatINR(row.annual)}</td>
    </tr>
  )
}
