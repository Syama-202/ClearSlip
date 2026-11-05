// Payslips the user chose to save, kept in this browser's localStorage only:
// ClearSlip's server never receives them. Each entry is a decode result minus
// anything identifying ("Read from" lines and unplaced lines quote the payslip,
// which can include a name) or short-lived (the checklist token is tied to one
// server run).
const KEY = 'clearslip.history.v1'
const MAX_ENTRIES = 24

const isRow = r => Boolean(r) && typeof r.component === 'string' && (r.type === 'earning' || r.type === 'deduction')
  && Number.isFinite(r.monthly) && Number.isFinite(r.annual)

/**
 * Whether a stored entry has everything the page reads from it. Storage can hold
 * anything — an older format, a save cut short, another tab, an extension — and
 * one bad entry must not break the page every time it loads.
 */
export function isValidEntry(e) {
  const r = e?.result
  return typeof e?.id === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(e.month ?? '')
    && Boolean(r) && Number.isFinite(r.summary?.takeHome)
    && Array.isArray(r.breakdown) && r.breakdown.length > 0 && r.breakdown.every(isRow)
    && (r.actionItems === undefined || Array.isArray(r.actionItems))
    && (r.checks === undefined || Array.isArray(r.checks))
}

export function loadHistory() {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) || '[]')
    if (!Array.isArray(stored)) {
      localStorage.removeItem(KEY)
      return []
    }
    const entries = stored.filter(isValidEntry)
    // Drop the unreadable ones for good, so they aren't skipped on every visit
    if (entries.length !== stored.length) store(entries)
    return entries
  } catch {
    return [] // storage blocked (private window) or unreadable
  }
}

function store(entries) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
    return true
  } catch {
    return false
  }
}

/** Saves a result under a month ("2026-10"); a second save for the same month replaces it. */
export function savePayslip(month, result) {
  const { checklistToken, unplaced, ...rest } = result
  const entry = {
    id: `${month}-${Date.now()}`,
    month,
    savedAt: new Date().toISOString(),
    result: { ...rest, breakdown: rest.breakdown.map(({ source, ...row }) => row) },
  }
  const entries = [entry, ...loadHistory().filter(e => e.month !== month)]
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, MAX_ENTRIES)
  return store(entries) ? entries : null
}

export function deletePayslip(id) {
  const entries = loadHistory().filter(e => e.id !== id)
  store(entries)
  return entries
}

export function clearHistory() {
  try { localStorage.removeItem(KEY) } catch { /* nothing to clear */ }
  return []
}

/** Whether anything is saved, readable or not (the error page offers to clear it). */
export function hasSavedPayslips() {
  try { return localStorage.getItem(KEY) !== null } catch { return false }
}

export function monthLabel(month) {
  const [y, m] = month.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
