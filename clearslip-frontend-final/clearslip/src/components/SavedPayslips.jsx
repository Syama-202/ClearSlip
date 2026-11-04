import { useState } from 'react'
import { History, Trash2, ArrowLeftRight, FolderOpen } from 'lucide-react'
import { monthLabel } from '../utils/history'
import { formatINR } from '../utils/formatCurrency'

/**
 * The payslips saved on this device: open one, delete one, or tick two and
 * compare them. Renders nothing when there are none.
 */
export default function SavedPayslips({ entries, onOpen, onDelete, onClear, onCompare }) {
  const [picked, setPicked] = useState([])
  if (!entries.length) return null

  const toggle = id => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id].slice(-2)))

  return (
    <div className="rounded-2xl border border-line bg-white p-5 print:hidden">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-terra"><History size={20} className="text-saffron-500" /> Saved on this device</h2>
          <p className="mt-0.5 text-sm text-muted">Kept in this browser only — ClearSlip never receives them. Tick two to compare months.</p>
        </div>
        <button onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-sm text-muted hover:bg-peach hover:text-bad">Delete all</button>
      </div>

      <ul className="mt-3 divide-y divide-line">
        {entries.map(e => (
          <li key={e.id} className="flex flex-wrap items-center gap-3 py-2.5">
            <input
              type="checkbox"
              aria-label={`Compare ${monthLabel(e.month)}`}
              checked={picked.includes(e.id)}
              onChange={() => toggle(e.id)}
              className="h-4 w-4 accent-saffron-500"
            />
            <span className="min-w-[8rem] flex-1 text-base font-medium text-ink">{monthLabel(e.month)}</span>
            <span className="text-sm tabular-nums text-muted">Take-home {formatINR(e.result.summary?.takeHome)}</span>
            <span className="flex gap-1">
              <button onClick={() => onOpen(e)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-saffron-600 hover:bg-peach"><FolderOpen size={15} /> Open</button>
              <button onClick={() => { onDelete(e.id); setPicked(p => p.filter(x => x !== e.id)) }} aria-label={`Delete ${monthLabel(e.month)}`} className="rounded-lg p-1.5 text-muted hover:bg-peach hover:text-bad"><Trash2 size={16} /></button>
            </span>
          </li>
        ))}
      </ul>

      {entries.length > 1 && (
        <button
          onClick={() => onCompare(picked.map(id => entries.find(e => e.id === id)))}
          disabled={picked.length !== 2}
          className="mt-3 flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white hover:bg-maroon-dark disabled:cursor-not-allowed disabled:bg-stone-300"
        >
          <ArrowLeftRight size={17} /> Compare {picked.length === 2 ? 'these two' : '(tick two)'}
        </button>
      )}
    </div>
  )
}
