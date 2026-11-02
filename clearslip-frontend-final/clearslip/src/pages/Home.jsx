import { useState, useCallback } from 'react'
import InputPanel from '../components/InputPanel.jsx'
import StatCards from '../components/StatCards.jsx'
import BreakdownTable from '../components/BreakdownTable.jsx'
import ActionCard from '../components/ActionCard.jsx'
import EmailModal from '../components/EmailModal.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import useClaudeApi from '../hooks/useClaudeApi.js'
import { buildClaudeMessage } from '../utils/buildClaudeMessage.js'
import { sendChecklist } from '../utils/sendChecklist.js'
import { useToast } from '../components/Toast.jsx'
import { C } from '../utils/colors'

// appState machine: 'empty' | 'loading' | 'result' | 'error'

export default function Home() {
  const [appState, setAppState] = useState('empty')
  const [analysisData, setAnalysisData] = useState(null)
  const [emailModalOpen, setEmailModalOpen] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const { analyze, loading } = useClaudeApi()
  const addToast = useToast()

  const handleSubmit = useCallback(async (mode, textInput, imageData) => {
    setAppState('loading')
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
    <div style={{ display: 'flex', flex: 1, height: 'calc(100vh - 56px - 41px)', overflow: 'hidden', flexDirection: 'row' }}
      className="flex-col md:flex-row">

      {/* ── LEFT PANEL ── */}
      <aside style={{
        width: 300, flexShrink: 0, background: C.peach,
        borderRight: `1px solid ${C.amberBorder}`,
        overflowY: 'auto', padding: 20,
      }}
        className="w-full md:w-72 lg:w-80">
        <InputPanel onSubmit={handleSubmit} loading={loading} />
      </aside>

      {/* ── RIGHT PANEL ── */}
      <section style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: C.cream }}>
        {appState === 'empty' && <EmptyState />}
        {appState === 'loading' && <LoadingState />}

        {appState === 'result' && analysisData && (
          <>
            {/* Decode header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.terra }}>Your payslip, decoded</span>
              {analysisData.summary?.ctc > 0 && (
                <span style={{ fontSize: 12, background: C.yellowCard, color: '#92400e', padding: '2px 9px', borderRadius: 99, border: `1px solid ${C.amberBorder}` }}>
                  CTC ₹{(analysisData.summary.ctc / 100000).toFixed(1)}L
                </span>
              )}
              <button
                onClick={() => { setAppState('empty'); setAnalysisData(null) }}
                style={{ marginLeft: 'auto', fontSize: 12, color: C.textMuted, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Start over
              </button>
            </div>

            <StatCards summary={analysisData.summary} loading={false} />
            <BreakdownTable breakdown={analysisData.breakdown} loading={false} />
            <ActionCard
              actionItems={analysisData.actionItems}
              onSendEmail={openEmailModal}
              loading={false}
              emailSending={emailSending}
            />

            {/* Disclaimer */}
            {analysisData.disclaimer && (
              <div style={{ fontSize: 12, color: C.textFaint, fontStyle: 'italic', marginTop: 8, lineHeight: 1.5, borderTop: `1px solid ${C.amberBorder}`, paddingTop: 10 }}>
                ⚠️ {analysisData.disclaimer}
              </div>
            )}
          </>
        )}
      </section>

      {/* Email modal */}
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
