import { useState, useCallback } from 'react'
import { RotateCcw, Info, AlertTriangle, Printer } from 'lucide-react'
import InputPanel from '../components/InputPanel.jsx'
import StatCards from '../components/StatCards.jsx'
import BreakdownTable from '../components/BreakdownTable.jsx'
import ActionCard from '../components/ActionCard.jsx'
import EmailModal from '../components/EmailModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import AskPanel from '../components/AskPanel.jsx'
import WhatIfSimulator from '../components/WhatIfSimulator.jsx'
import ErrorState from '../components/ErrorState.jsx'
import SaveToDevice from '../components/SaveToDevice.jsx'
import SavedPayslips from '../components/SavedPayslips.jsx'
import PayslipComparison from '../components/PayslipComparison.jsx'
import { loadHistory, savePayslip, deletePayslip, clearHistory } from '../utils/history.js'
import useDecode from '../hooks/useDecode.js'
import useServerFeatures from '../hooks/useServerFeatures.js'
import { buildDecodeMessages } from '../utils/buildDecodeMessages.js'
import { sendChecklist } from '../utils/sendChecklist.js'
import { postJson } from '../utils/api.js'
import { readPayslipFile, ReadError } from '../utils/readPayslipFile.js'
import { useToast } from '../components/Toast.jsx'

// A complete two-column payslip, so "Try a sample" shows every part of a result
const SAMPLE_PAYSLIP = `Basic Salary 37,500 | Employee PF 4,500
House Rent Allowance 15,000 | Professional Tax 200
Special Allowance 18,900 | TDS 3,000
Conveyance Allowance 1,600
Leave Travel Allowance 2,000
Gross Salary 75,000 | Total Deductions 7,700
Net Pay 67,300`

/**
 * Reads an uploaded payslip in the browser and returns the decode request:
 * just the text found, so the file itself never leaves the device. If the
 * reading libraries can't load at all (e.g. a network that blocks the CDN), the
 * file is sent to the server's own OCR instead, so the feature still works.
 */
async function readOnDevice(imageData, onProgress) {
  try {
    const { text, origin } = await readPayslipFile(imageData.file, onProgress)
    return [{ type: 'text', text: text.slice(0, MAX_TEXT_CHARS), origin }]
  } catch (err) {
    if (err instanceof ReadError) throw err
    console.warn('Reading on this device failed; sending the file to the server instead.', err)
    return buildDecodeMessages('image', '', imageData)
  }
}

// The server accepts up to this much text in one request
const MAX_TEXT_CHARS = 12000

// appState machine: 'empty' | 'loading' | 'result' | 'error' | 'compare'

export default function Home() {
  const [appState, setAppState] = useState('empty')
  const [analysisData, setAnalysisData] = useState(null)
  const [decodeError, setDecodeError] = useState(null) // { message, code } when appState is 'error'
  const [lastSubmission, setLastSubmission] = useState(null) // for "Try again"
  const [pasteRequest, setPasteRequest] = useState(0) // bumps to switch the input panel to Paste
  const [history, setHistory] = useState(loadHistory) // payslips saved in this browser
  const [comparing, setComparing] = useState(null) // two saved entries, when appState is 'compare'
  const [resultVersion, setResultVersion] = useState(0) // bumps when the user corrects figures
  const [loadingMode, setLoadingMode] = useState('text')
  const [loadingProgress, setLoadingProgress] = useState(null) // { fraction, label } while a file is read
  const [sample, setSample] = useState(null) // { text } pushed into the input panel
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { decode, loading } = useDecode()
  const features = useServerFeatures()
  const addToast = useToast()
  const aiAvailable = features.llmFallback !== false

  const handleSubmit = useCallback(async (mode, textInput, imageData) => {
    setAppState('loading')
    setLoadingMode(mode)
    setLoadingProgress(null)
    setAnalysisData(null)
    setLastSubmission({ mode, textInput, imageData })
    try {
      const messages = mode === 'image'
        ? await readOnDevice(imageData, (fraction, label) => setLoadingProgress({ fraction, label }))
        : buildDecodeMessages(mode, textInput, imageData)
      setLoadingProgress({ fraction: 1, label: 'Decoding your payslip…' })
      setAnalysisData(await decode({ messages }))
      setAppState('result')
    } catch (err) {
      // Stays on screen with what to try next, unlike a toast
      setDecodeError({ message: err.message, code: err.code })
      setAppState('error')
    }
  }, [decode])

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
        checklistToken: analysisData?.checklistToken,
      })
      setEmailSent(true)
      addToast('Checklist sent! Check your inbox.', 'success')
    } catch (err) {
      addToast(err.message || 'Failed to send. Please try again.', 'error')
    } finally {
      setEmailSending(false)
    }
  }, [analysisData, addToast])

  // Corrected figures go back to the server, which redoes the tax, checks and checklist
  const handleRecalculate = useCallback(async (rows) => {
    const data = await postJson('/api/decode/recalculate', { breakdown: rows })
    setAnalysisData(data)
    setResultVersion(v => v + 1)
    addToast('Recalculated with your figures.', 'success')
  }, [addToast])

  const savedList = (
    <SavedPayslips
      entries={history}
      onOpen={entry => { setAnalysisData(entry.result); setResultVersion(v => v + 1); setAppState('result') }}
      onDelete={id => setHistory(deletePayslip(id))}
      onClear={() => setHistory(clearHistory())}
      onCompare={pair => { setComparing(pair); setAppState('compare') }}
    />
  )

  function openEmailModal() {
    setEmailSent(false)
    setEmailModalOpen(true)
  }

  return (
    <div className="mx-auto grid w-full max-w-screen-2xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[360px_minmax(0,1fr)] md:gap-8 md:px-8 md:py-8 lg:grid-cols-[400px_minmax(0,1fr)] print:block print:p-0">

      {/* ── INPUT (stays in view while results scroll on desktop) ── */}
      <aside className="md:sticky md:top-24 md:self-start print:hidden">
        <InputPanel onSubmit={handleSubmit} loading={loading} aiAvailable={aiAvailable} sample={sample} pasteRequest={pasteRequest} />
      </aside>

      {/* ── RESULTS ── */}
      <section className="min-w-0">
        {appState === 'empty' && (
          <div className="space-y-6">
            {savedList}
            <EmptyState aiAvailable={aiAvailable} onTrySample={handleTrySample} />
          </div>
        )}
        {appState === 'compare' && comparing && <PayslipComparison entries={comparing} onBack={() => setAppState('empty')} />}
        {appState === 'loading' && <LoadingState mode={loadingMode} progress={loadingProgress} />}
        {appState === 'error' && decodeError && (
          <ErrorState
            error={decodeError}
            onPaste={() => { setAppState('empty'); setPasteRequest(n => n + 1) }}
            onRetry={lastSubmission ? () => handleSubmit(lastSubmission.mode, lastSubmission.textInput, lastSubmission.imageData) : null}
            onTrySample={handleTrySample}
          />
        )}

        {appState === 'result' && analysisData && (
          <div className="space-y-6">
            {/* Only on the printed / PDF report */}
            <p className="hidden border-b border-line pb-2 text-sm text-muted print:block">
              ClearSlip payslip report · {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} · General information, not financial advice
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-semibold text-terra md:text-3xl">Your payslip, decoded</h1>
              {analysisData.summary?.ctc > 0 && (
                <span
                  title="Gross salary plus employer PF. Employer NPS, insurance and gratuity are not included unless your payslip shows a CTC line."
                  className="rounded-full border border-line bg-sand px-3 py-1 text-sm font-medium text-saffron-700"
                >
                  CTC ≈ ₹{(analysisData.summary.ctc / 100000).toFixed(1)}L / year (estimate)
                </span>
              )}
              <div className="ml-auto flex flex-wrap items-center gap-1 print:hidden">
                <SaveToDevice key={resultVersion} onSave={month => {
                  const entries = savePayslip(month, analysisData)
                  if (entries) setHistory(entries)
                  return Boolean(entries)
                }} />
                {/* The browser's print dialog can save the report as a PDF */}
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-base text-muted hover:bg-peach hover:text-ink"
                >
                  <Printer size={16} /> Save as PDF
                </button>
                <button
                  onClick={() => { setAppState('empty'); setAnalysisData(null) }}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-base text-muted hover:bg-peach hover:text-ink"
                >
                  <RotateCcw size={16} /> Start over
                </button>
              </div>
            </div>

            {/* The rules engine couldn't read this layout, so an AI read it: say so plainly */}
            {analysisData.engine === 'llm-fallback' && (
              <p role="status" className="flex items-start gap-2 rounded-xl border border-saffron-500/40 bg-sand px-4 py-3 text-base text-terra">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-saffron-600" />
                <span><strong>AI estimate.</strong> We didn&apos;t recognise this payslip&apos;s layout, so an AI read the figures. Please check each amount against your payslip — use <em>Check &amp; correct figures</em> below to fix any.</span>
              </p>
            )}

            {/* Figures that were read but may not mean what we assumed */}
            {analysisData.checks?.length > 0 && (
              <div role="status" className="rounded-xl border border-saffron-500/40 bg-sand px-4 py-3 text-base text-terra">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={18} className="shrink-0 text-saffron-600" /> Please check</p>
                <ul className="mt-1.5 list-disc space-y-1 pl-9 text-sm leading-relaxed">
                  {analysisData.checks.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}

            <StatCards summary={analysisData.summary} breakdown={analysisData.breakdown} />

            {/* Side by side only where both get enough width */}
            <div className="grid grid-cols-1 gap-6 2xl:grid-cols-5">
              <div className="2xl:col-span-3">
                <BreakdownTable breakdown={analysisData.breakdown} unplaced={analysisData.unplaced} onRecalculate={handleRecalculate} />
              </div>
              <div className="2xl:col-span-2">
                <ActionCard
                  actionItems={analysisData.actionItems}
                  // A reopened saved payslip has no checklist token, so it can't be emailed
                  onSendEmail={features.checklistEmail !== false && analysisData.checklistToken ? openEmailModal : null}
                  emailSending={emailSending}
                />
              </div>
            </div>

            {/* Deductions tried out live against both regimes */}
            {/* Keyed by version so corrected figures restart it from the new payslip */}
            <div className="print:hidden">
              <WhatIfSimulator key={resultVersion} breakdown={analysisData.breakdown} />
            </div>

            {/* Questions answered with the user's own figures */}
            <div className="print:hidden">
              <AskPanel
                payslip={{ summary: analysisData.summary, breakdown: analysisData.breakdown }}
                aiAvailable={aiAvailable}
              />
            </div>

            {savedList}

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
