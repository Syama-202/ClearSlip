import { useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Recent turns sent along so follow-ups ("and in the old regime?") make sense
const HISTORY_TURNS = 6

/**
 * Conversation state for Ask ClearSlip. Each message is
 * { role: 'user', content } or { role: 'assistant', data } where data is
 * the /api/ask response (answer, sources, cited, toolCalls, mode).
 */
export default function useAsk(payslip) {
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)

  const ask = useCallback(async (question) => {
    const history = messages
      .map(m => (m.role === 'user' ? { role: 'user', content: m.content } : m.data?.answer && { role: 'assistant', content: m.data.answer }))
      .filter(Boolean)
      .slice(-HISTORY_TURNS)

    setMessages(prev => [...prev, { role: 'user', content: question }])
    setLoading(true)
    try {
      const response = await fetch(`${API_BASE}/api/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, ...(payslip && { payslip }) }),
      })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || `Server error (${response.status})`)
      setMessages(prev => [...prev, { role: 'assistant', data: json.data }])
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', error: err.message || 'Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }, [messages, payslip])

  const reset = useCallback(() => setMessages([]), [])

  return { messages, loading, ask, reset }
}
