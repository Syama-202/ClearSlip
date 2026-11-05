import { useState } from 'react'
import { Save, Check } from 'lucide-react'
import { currentMonth, monthLabel } from '../utils/history'

/** "Save to this device" with a month picker; `onSave(month)` returns true when stored. */
export default function SaveToDevice({ onSave }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(currentMonth())
  const [saved, setSaved] = useState(null)
  const [failed, setFailed] = useState(false)

  if (saved) {
    return <span className="flex items-center gap-1.5 px-3 py-2 text-base text-good"><Check size={16} /> Saved as {monthLabel(saved)}</span>
  }
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-base text-muted hover:bg-peach hover:text-ink">
        <Save size={16} /> Save to this device
      </button>
    )
  }
  return (
    <form
      onSubmit={e => { e.preventDefault(); if (onSave(month)) setSaved(month); else setFailed(true) }}
      className="flex flex-wrap items-center gap-2"
    >
      <label className="text-sm text-muted" htmlFor="save-month">Payslip for</label>
      <input id="save-month" type="month" value={month} max={currentMonth()} onChange={e => setMonth(e.target.value)} required
        className="rounded-lg border border-line bg-cream px-2 py-1.5 text-base text-ink focus:border-saffron-500 focus:outline-none" />
      <button type="submit" className="rounded-lg bg-maroon px-3 py-1.5 text-base font-semibold text-white hover:bg-maroon-dark">Save</button>
      <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-2 py-1.5 text-sm text-muted hover:bg-peach">Cancel</button>
      <p className="w-full text-sm text-subtle">Anyone who uses this browser can open it, so don&apos;t save on a shared computer.</p>
      {failed &&<span role="alert" className="text-sm text-bad">This browser isn&apos;t allowing saving (private window?).</span>}
    </form>
  )
}
