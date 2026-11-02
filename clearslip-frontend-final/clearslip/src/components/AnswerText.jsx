// Renders an assistant answer: paragraphs, "-" / "1." lists, **bold**, and
// citation markers like [1] or [1, 3] as chips pointing at the sources.
// Deliberately tiny instead of a markdown library — that's all answers use.

const INLINE_RE = /(\*\*[^*]+\*\*|\[\d+(?:\s*,\s*\d+)*\])/g

function Inline({ text, sources, idPrefix }) {
  return text.split(INLINE_RE).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-semibold text-ink">{part.slice(2, -2)}</strong>
    const citation = part.match(/^\[(\d+(?:\s*,\s*\d+)*)\]$/)
    if (citation) {
      return citation[1].split(/\s*,\s*/).map(n => {
        const source = sources.find(s => s.n === Number(n))
        return (
          <a
            key={`${i}-${n}`}
            href={`#${idPrefix}-source-${n}`}
            title={source ? `${source.title} — ${source.section}` : undefined}
            className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded bg-sand px-1 align-text-top text-xs font-semibold text-saffron-700 no-underline hover:bg-saffron-100"
          >
            {n}
          </a>
        )
      })
    }
    return part
  })
}

// idPrefix keeps source anchors unique when several answers are on the page
export default function AnswerText({ text, sources = [], idPrefix = 'answer' }) {
  const blocks = text.split(/\n\s*\n/).map(b => b.trim()).filter(Boolean)
  return (
    <div className="space-y-3 text-base leading-relaxed text-ink">
      {blocks.map((block, i) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
        const isList = lines.every(l => /^([-*•]|\d+[.)])\s+/.test(l))
        if (isList) {
          const ordered = /^\d/.test(lines[0])
          const ListTag = ordered ? 'ol' : 'ul'
          return (
            <ListTag key={i} className={`space-y-1.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
              {lines.map((l, j) => <li key={j}><Inline text={l.replace(/^([-*•]|\d+[.)])\s+/, '')} sources={sources} idPrefix={idPrefix} /></li>)}
            </ListTag>
          )
        }
        return <p key={i}><Inline text={lines.join(' ')} sources={sources} idPrefix={idPrefix} /></p>
      })}
    </div>
  )
}
