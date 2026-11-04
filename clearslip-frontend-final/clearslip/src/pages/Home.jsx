import { useState, useCallback } from 'react'
import { RotateCcw, Info } from 'lucide-react'
import InputPanel from '../components/InputPanel.jsx'
import StatCards from '../components/StatCards.jsx'
import BreakdownTable from '../components/BreakdownTable.jsx'
import ActionCard from '../components/ActionCard.jsx'
import EmailModal from '../components/EmailModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import AskPanel from '../components/AskPanel.jsx'
import WhatIfSimulator from '../components/WhatIfSimulator.jsx'
import useClaudeApi from '../hooks/useClaudeApi.js'
import useServerFeatures from '../hooks/useServerFeatures.js'
import { buildClaudeMessage } from '../utils/buildClaudeMessage.js'
import { sendChecklist } from '../utils/sendChecklist.js'
import { useToast } from '../components/Toast.jsx'

// A complete two-column payslip, so "Try a sample" shows every part of a result
const SAMPLE_PAYSLIP = `Basic Salary 37,500 | Employee PF 4,500
House Rent Allowance 15,000 | Professional Tax 200
Special Allowance 18,900 | TDS 3,000
Conveyance Allowance 1,600
Leave Travel Allowance 2,000
Gross Salary 75,000 | Total Deductions 7,700
Net Pay 67,300`

// appState machine: 'empty' | 'loading' | 'result'

export default function Home() {
  const [appState, setAppState] = useState('empty')
  const [analysisData, setAnalysisData] = useState(null)
  const [loadingMode, setLoadingMode] = useState('text')
  const [sample, setSample] = useState(null) // { text } pushed into the input panel
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { analyze, loading } = useClaudeApi()
  const features = useServerFeatures()
  const addToast = useToast()
  const aiAvailable = features.llmFallback !== false

  const handleSubmit = useCallback(async (mode, textInput, imageData) => {
    setAppState('loading')
    setLoadingMode(mode)
    setAnalysisData(null)
    try {
      const messages = buildClaudeMessage(mode, textInput, imageData)
      const result = await analyze({ messages })
      if (result) {
        setAnalysisData(result)
        setAppState('result')
      } else {
        setAppState('empty')
        addToast('Could not decode. Please try again or rephrase your input.', 'error')
      }
    } catch (err) {
      setAppState('empty')
      addToast(err.message || 'Something went wrong. Please try again.', 'error')
    }
  }, [analyze, addToast])

  const handleTrySample = useCallback(() => {
    setSample({ text: SAMPLE_PAYSLIP })
    handleSubmit('text', SAMPLE_PAYSLIP)
  }, [handleSubmit])

  const handleSendChecklist = useCallback(async (email) => {
    setEmailSending(true)
    try {
      await sendChecklist({
        email,
        checklistItems: analysisData?.actionItems ?? [],
        payslipSummary: analysisData?.summary ?? {},
      })
      setEmailSent(true)
      addToast('Checklist sent! Check your inbox.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to send. Please try again.', 'error')
    } finally {
      setEmailSending(false)
    }
  }, [analysisData, addToast])

  function openEmailModal() {
    setEmailSent(false)
    setEmailModalOpen(true)
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[360px_minmax(0,1fr)] md:gap-8 md:px-8 md:py-8 lg:grid-cols-[400px_minmax(0,1fr)]">

      {/* ── INPUT (stays in view while results scroll on desktop) ── */}
      <aside className="md:sticky md:top-24 md:self-start">
        <InputPanel onSubmit={handleSubmit} loading={loading} aiAvailable={aiAvailable} sample={sample} />
      </aside>

      {/* ── RESULTS ── */}
      <section className="min-w-0">
        {appState === 'empty' && <EmptyState aiAvailable={aiAvailable} onTrySample={handleTrySample} />}
        {appState === 'loading' && <LoadingState mode={loadingMode} />}

        {appState === 'result' && analysisData && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-terra md:text-3xl">Your payslip, decoded</h1>
              {analysisData.summary?.ctc > 0 && (
                <span className="rounded-full border border-line bg-sand px-3 py-1 text-sm font-medium text-saffron-700">
                  CTC ₹{(analysisData.summary.ctc / 100000).toFixed(1)}L / year
                </span>
              )}
              <button
                onClick={() => { setAppState('empty'); setAnalysisData(null) }}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-base text-muted hover:bg-peach hover:text-ink"
              >
                <RotateCcw size={16} /> Start over
              </button>
            </div>

            <StatCards summary={analysisData.summary} />

            {/* Side by side only where both get enough width */}
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
              <div className="2xl:col-span-3">
                <BreakdownTable breakdown={analysisData.breakdown} />
              </div>
              <div className="2xl:col-span-2">
                <ActionCard
                  actionItems={analysisData.actionItems}
                  onSendEmail={features.checklistEmail !== false ? openEmailModal : null}
                  emailSending={emailSending}
                />
              </div>
            </div>

            {/* Deductions tried out live against both regimes */}
            <WhatIfSimulator breakdown={analysisData.breakdown} />

            {/* Questions answered with the user's own figures */}
            <AskPanel
              payslip={{ summary: analysisData.summary, breakdown: analysisData.breakdown }}
              aiAvailable={aiAvailable}
            />

            {analysisData.disclaimer && (
              <p className="flex gap-2 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                <Info size={18} className="mt-0.5 shrink-0 text-subtle" />
                {analysisData.disclaimer}
              </p>
            )}
          </div>
        )}
      </section>

      <EmailModal
        isOpen={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        onSubmit={handleSendChecklist}
        loading={emailSending}
        sent={emailSent}
      />
    </div>
  )
}
