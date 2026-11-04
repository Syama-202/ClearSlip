import { Loader2 } from 'lucide-react'

function Shimmer({ className = '', style }) {
  return <div className={`animate-shimmer rounded bg-line ${className}`} style={style} />
}

// Mirrors the result layout so nothing jumps when the answer arrives.
// `progress` ({ fraction, label }) is set while an uploaded file is read on the device.
export default function LoadingState({ mode, progress }) {
  const label = progress?.label ?? (mode === 'image'
    ? 'Getting the text reader ready… the first upload can take up to 30 seconds while it loads.'
    : 'Decoding your payslip — this usually takes a few seconds…')
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="rounded-2xl border border-line bg-white p-4 text-base text-muted">
        <div className="flex items-center gap-3" aria-live="polite">
          <Loader2 size={20} className="animate-spin text-saffron-500" />
          {label}
        </div>
        {mode === 'image' && (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-sand" role="progressbar" aria-label="Reading progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((progress?.fraction ?? 0) * 100)}>
              <div className="h-full rounded-full bg-saffron-500 transition-all duration-300" style={{ width: `${Math.round((progress?.fraction ?? 0) * 100)}%` }} />
            </div>
            <p className="mt-2 text-sm text-subtle">Your file stays on this device — only the text read from it is sent to ClearSlip.</p>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="rounded-2xl border border-line bg-white p-5">
            <Shimmer className="mb-3 h-4 w-3/5" />
            <Shimmer className="h-8 w-4/5" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="p-5"><Shimmer className="h-5 w-44" /></div>
        <div className="h-10 bg-sand" />
        {[85, 70, 60, 75, 65].map((w, i) => (
          <div key={i} className="grid grid-cols-[1fr_7rem_7rem] gap-4 border-t border-line px-5 py-4">
            <Shimmer className="h-4" style={{ width: `${w}%` }} />
            <Shimmer className="h-4" />
            <Shimmer className="h-4" />
          </div>
        ))}
      </div>
    </div>
  )
}
