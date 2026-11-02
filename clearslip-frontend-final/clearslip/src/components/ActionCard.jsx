import { Mail, ExternalLink, ListChecks } from 'lucide-react'

const PRIORITY_STYLE = {
  high: { className: 'bg-maroon-light text-maroon', label: 'High priority' },
  medium: { className: 'bg-sand text-saffron-700', label: 'Medium' },
  low: { className: 'bg-green-50 text-good', label: 'Low' },
}

export default function ActionCard({ actionItems, onSendEmail, emailSending }) {
  return (
    <div className="rounded-2xl border border-line border-l-4 border-l-maroon bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-terra">
          <ListChecks size={20} className="text-maroon" /> What to do next
        </h2>
        {/* No handler when the server can't send email */}
        {onSendEmail && (
          <button
            onClick={onSendEmail}
            disabled={emailSending}
            className="flex items-center gap-2 rounded-lg bg-saffron-500 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-saffron-600 disabled:cursor-not-allowed disabled:bg-stone-300"
          >
            <Mail size={16} /> {emailSending ? 'Sending…' : 'Email checklist'}
          </button>
        )}
      </div>

      <ol className="mt-4 flex flex-col gap-4">
        {(actionItems ?? []).map((item, i) => {
          const ps = PRIORITY_STYLE[item.priority] ?? PRIORITY_STYLE.medium
          return (
            <li key={i} className="flex gap-3">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-maroon text-sm font-semibold text-white">
                {i + 1}
              </span>
              <div className="flex-1">
                <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ps.className}`}>{ps.label}</span>
                <p className="mt-1 text-base leading-relaxed text-ink">{item.action}</p>
                {item.link && (
                  <a href={item.link} target="_blank" rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-saffron-600 hover:text-saffron-700 hover:underline">
                    Open official portal <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
