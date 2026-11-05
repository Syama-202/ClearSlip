import { Component } from 'react'
import { AlertCircle, RotateCcw, Trash2 } from 'lucide-react'
import { clearHistory, hasSavedPayslips } from '../utils/history'

/**
 * Catches a rendering bug anywhere below it, so the user sees what happened and
 * a way back instead of a blank page. Nothing about their payslip was sent or
 * saved by the crash, and the message says so. If payslips are saved on this
 * device, it also offers to clear them: saved data that this version can't read
 * is the one cause a reload wouldn't fix.
 */
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error, info) {
    console.error('ClearSlip page error:', error, info?.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    const saved = hasSavedPayslips()
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16">
        <div role="alert" className="rounded-2xl border border-maroon/20 bg-white p-6 md:p-8">
          <h1 className="flex items-center gap-2 text-xl font-semibold text-maroon">
            <AlertCircle size={22} className="shrink-0" /> Something went wrong on this page
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted">
            This is a fault in ClearSlip, not in your payslip. Nothing was sent or saved because of it. Reloading usually fixes it.
            {saved && ' If it keeps happening, clearing the payslips saved on this device should — you would need to decode them again.'}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 rounded-lg bg-maroon px-4 py-2 text-base font-semibold text-white hover:bg-maroon-dark"
            >
              <RotateCcw size={17} /> Reload ClearSlip
            </button>
            {saved && (
              <button
                onClick={() => { clearHistory(); window.location.reload() }}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-base font-medium text-muted hover:bg-peach hover:text-bad"
              >
                <Trash2 size={17} /> Clear saved payslips and reload
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }
}
