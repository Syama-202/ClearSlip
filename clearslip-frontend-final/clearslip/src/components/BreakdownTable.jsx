import { useState } from 'react'
import { Pencil, Plus, X, Loader2, AlertTriangle } from 'lucide-react'
import { formatINR } from '../utils/formatCurrency'

// Each row shows what the component means right under its name, since
// explaining the payslip is the point (a hover-only tooltip hid it), and
// the payslip line it was read from, so every figure can be checked.
// `onRecalculate(rows)` lets the user correct a mis-read figure; it resolves
// once the new result is in, or rejects with a message to show.
// `unplaced` lists lines that had an amount but no label ClearSlip knows; each
// can be added as a row, which opens the editor with it filled in.
export default function BreakdownTable({ breakdown, unplaced = [], onRecalculate }) {
  const [editing, setEditing] = useState(null) // null, or rows to add when the editor opens

  if (editing) {
    return <EditFigures breakdown={breakdown} extraRows={editing} onCancel={() => setEditing(null)} onSave={async rows => { await onRecalculate(rows); setEditing(null) }} />
  }

  const earnings = breakdown?.filter(r => r.type === 'earning') ?? []
  const deductions = breakdown?.filter(r => r.type === 'deduction') ?? []
  const total = key => earnings.reduce((s, r) => s + (r[key] || 0), 0) - deductions.reduce((s, r) => s + (r[key] || 0), 0)
  // Yearly from each row's own yearly figure, so a one-off bonus counts once
  const totalMonthly = total('monthly')
  const totalAnnual = total('annual')

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
        <h2 className="text-lg font-semibold text-terra">Payslip breakdown</h2>
        {onRecalculate && (
          <button
            onClick={() => setEditing([])}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-saffron-600 hover:bg-peach hover:text-saffron-700 print:hidden"
          >
            <Pencil size={15} /> Check &amp; correct figures
          </button>
        )}
      </div>
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
            {earnings.map((row, i) => <Row key={`e${i}`} row={row} />)}
          </tbody>
        )}
        {deductions.length > 0 && (
          <tbody className="border-t border-line">
            <SectionLabel label="Deductions" />
            {deductions.map((row, i) => <Row key={`d${i}`} row={row} isDeduction />)}
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
      {unplaced.length > 0 && (
        <Unplaced lines={unplaced} onAdd={onRecalculate && (line => setEditing([line]))} />
      )}
    </div>
  )
}

// Lines with an amount that no known component claimed: left out of every
// figure above until the user says what they are
function Unplaced({ lines, onAdd }) {
  return (
    <div className="border-t border-line bg-sand/60 px-5 py-4">
      <h3 className="flex items-center gap-2 text-base font-semibold text-terra">
        <AlertTriangle size={17} className="shrink-0 text-saffron-600" /> Lines we couldn&apos;t place
      </h3>
      <p className="mt-0.5 text-sm text-muted">These lines have an amount, but ClearSlip doesn&apos;t know what they are, so they aren&apos;t in the figures above. Add the ones that are part of your pay.</p>
      <ul className="mt-3 space-y-2">
        {lines.map(line => (
          <li key={line.text} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-white px-3 py-2">
            <q className="min-w-0 break-words font-mono text-sm text-ink">{line.text}</q>
            {onAdd && (
              <span className="flex gap-1.5 print:hidden">
                {['earning', 'deduction'].map(type => (
                  <button
                    key={type}
                    onClick={() => onAdd({ component: line.component, type, monthly: String(line.monthly) })}
                    className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-medium hover:bg-peach ${type === line.suggestedType ? 'text-saffron-700 ring-1 ring-saffron-500/50' : 'text-muted'}`}
                  >
                    <Plus size={14} /> Add as {type}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
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

// Deductions show as "−₹4,500"; a negative deduction (a refund) as "+₹500"
function signedAmount(value, isDeduction) {
  if (isDeduction) return value < 0 ? `+${formatINR(-value)}` : `−${formatINR(value)}`
  return value < 0 ? `−${formatINR(-value)}` : formatINR(value)
}

function Row({ row, isDeduction }) {
  const amountClass = `text-right text-base font-medium tabular-nums ${isDeduction ? 'text-bad' : 'text-ink'}`
  return (
    <tr className="align-top transition-colors hover:bg-cream">
      <td className="px-5 py-3">
        <div className="flex flex-wrap items-center gap-2 text-base font-medium text-ink">
          {row.component}
          {row.corrected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-sand px-2 py-0.5 text-xs font-semibold text-saffron-700">
              <AlertTriangle size={12} /> Please check
            </span>
          )}
          {row.oneOff && <span className="rounded-full bg-peach px-2 py-0.5 text-xs font-semibold text-terra">One-off · counted once a year</span>}
          {row.edited && <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-good">Checked by you</span>}
        </div>
        {row.explanation && <div className="mt-0.5 text-sm leading-relaxed text-muted">{row.explanation}</div>}
        {row.source && <div className="mt-1 text-xs text-subtle">Read from: <q className="font-mono">{row.source}</q></div>}
      </td>
      <td className={`px-3 py-3 ${amountClass}`}>{signedAmount(row.monthly, isDeduction)}</td>
      <td className={`hidden px-5 py-3 sm:table-cell ${amountClass}`}>{signedAmount(row.annual, isDeduction)}</td>
    </tr>
  )
}

const MAX_ROWS = 30

// The type menu also says whether a row is paid every month or this month only
const KINDS = [
  { value: 'earning', label: 'Earning' },
  { value: 'earning-once', label: 'One-off earning' },
  { value: 'deduction', label: 'Deduction' },
  { value: 'deduction-once', label: 'One-off deduction' },
]
const kindOf = row => `${row.type}${row.oneOff ? '-once' : ''}`

function EditFigures({ breakdown, extraRows = [], onCancel, onSave }) {
  const [rows, setRows] = useState(() => [
    ...(breakdown ?? []).map(r => ({ component: r.component, kind: kindOf(r), monthly: String(r.monthly) })),
    ...extraRows.map(r => ({ component: r.component, kind: r.type, monthly: r.monthly })),
  ].slice(0, MAX_ROWS))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const update = (i, patch) => setRows(rs => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const valid = rows.length > 0 && rows.every(r => r.component.trim() && r.monthly !== '' && Number.isFinite(Number(r.monthly)))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await onSave(rows.map(r => ({
        component: r.component.trim(),
        type: r.kind.replace('-once', ''),
        monthly: Math.round(Number(r.monthly)),
        oneOff: r.kind.endsWith('-once'),
      })))
    } catch (err) {
      setError(err.message || 'Could not recalculate. Please try again.')
      setSaving(false)
    }
  }

  const field = 'rounded-lg border border-line bg-cream px-3 py-2 text-base text-ink focus:border-saffron-500 focus:outline-none focus:ring-4 focus:ring-saffron-100'

  return (
    <div className="rounded-2xl border border-saffron-500/40 bg-white p-5">
      <h2 className="text-lg font-semibold text-terra">Check &amp; correct figures</h2>
      <p className="mt-1 text-base text-muted">Compare each amount with your payslip and fix anything that was read wrongly. Monthly amounts; everything else is recalculated. Mark a bonus or arrears as one-off so it counts once in your year, not 12 times.</p>

      <div className="mt-4 space-y-2">
        <div className="hidden grid-cols-[minmax(0,1fr)_11.5rem_9rem_2.5rem] gap-2 px-1 text-sm font-semibold text-saffron-700 sm:grid">
          <span>Component</span><span>Type</span><span className="text-right">Monthly (₹)</span><span />
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_11.5rem_9rem_2.5rem]">
            <input aria-label={`Row ${i + 1} name`} value={row.component} maxLength={80} onChange={e => update(i, { component: e.target.value })} className={`${field} min-w-0`} />
            <button aria-label={`Remove row ${i + 1}`} onClick={() => setRows(rs => rs.filter((_, j) => j !== i))} className="row-span-2 flex items-center justify-center rounded-lg text-muted hover:bg-peach hover:text-bad sm:order-last sm:row-span-1">
              <X size={18} />
            </button>
            <div className="grid grid-cols-2 gap-2 sm:contents">
              <select aria-label={`Row ${i + 1} type`} value={row.kind} onChange={e => update(i, { kind: e.target.value })} className={field}>
                {KINDS.map(k => <option key={k.value} value={k.value}>{k.label}</option>)}
              </select>
              <input aria-label={`Row ${i + 1} monthly amount`} type="number" inputMode="numeric" value={row.monthly} onChange={e => update(i, { monthly: e.target.value })} className={`${field} text-right tabular-nums`} />
            </div>
          </div>
        ))}
      </div>

      {rows.length < MAX_ROWS && (
        <button onClick={() => setRows(rs => [...rs, { component: '', kind: 'earning', monthly: '' }])} className="mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-saffron-600 hover:bg-peach">
          <Plus size={15} /> Add a row
        </button>
      )}

      {error && <p role="alert" className="mt-3 rounded-lg bg-maroon-light px-3 py-2 text-sm text-maroon">{error}</p>}

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button onClick={onCancel} disabled={saving} className="rounded-lg px-4 py-2 text-base font-medium text-muted hover:bg-peach hover:text-ink">Cancel</button>
        <button
          onClick={save}
          disabled={!valid || saving}
          className="flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          {saving && <Loader2 size={16} className="animate-spin" />} Recalculate
        </button>
      </div>
    </div>
  )
}
