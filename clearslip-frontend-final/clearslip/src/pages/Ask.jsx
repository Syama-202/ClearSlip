import AskPanel from '../components/AskPanel.jsx'
import useServerFeatures from '../hooks/useServerFeatures.js'

export default function Ask() {
  const features = useServerFeatures()

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 md:px-8 md:py-10">
      <h1 className="text-3xl font-bold tracking-tight text-terra md:text-4xl">Ask ClearSlip</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">
        Ask anything about your salary, PF, HRA, TDS or which tax regime to pick. Answers come from a knowledge base of
        Indian tax rules, cite their sources, and use ClearSlip's tax calculator for any numbers.
      </p>
      <div className="mt-8">
        <AskPanel aiAvailable={features.llmFallback !== false} />
      </div>
    </div>
  )
}
