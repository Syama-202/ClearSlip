import { useState, useCallback } from 'react'

import { API_BASE } from '../utils/api.js'

// Recent turns sent along so follow-ups ("and in the old regime?") make sense
const HISTORY_TURNS = 6

// gpt-oss writes citations as 【1†source】 while streaming; the server cleans them
// in the final answer, and this shows them the same way in the meantime
const tidyStreamed = text => text.replace(/【\s*(\d+)[^】]*】/g, '[$1]').replace(/【[^】]*】?/g, '')

/**
 * Conversation state for Ask ClearSlip. Each message is
 * { role: 'user', content }, { role: 'assistant', data } where data is the
 * /api/ask response (answer, parts, sources, cited, toolCalls, checks, mode),
 * or, while an answer is being written, { role: 'assistant', streaming: true, text }.
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
    // Replaces the last message if it is this answer's (streaming) placeholder
    const setAnswer = msg => setMessages(prev => (prev.at(-1)?.streaming ? [...prev.slice(0, -1), msg] : [...prev, msg]))

    try {
      const response = await fetch(`${API_BASE}/api/ask/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history, ...(payslip && { payslip }) }),
      })
      // Validation errors (empty question, PAN) come back as plain JSON
      if (!response.ok || !response.headers.get('content-type')?.includes('text/event-stream')) {
        const json = await response.json().catch(() => ({}))
        throw new Error(json.error || `Server error (${response.status})`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let text = ''
      let finished = false
      while (!finished) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        let end
        while ((end = buffer.indexOf('\n\n')) >= 0) {
          const block = buffer.slice(0, end)
          buffer = buffer.slice(end + 2)
          const event = block.match(/^event: (.+)$/m)?.[1]
          const data = JSON.parse(block.match(/^data: (.+)$/m)?.[1] ?? '{}')
          if (event === 'text') {
            text += data.text
            setAnswer({ role: 'assistant', streaming: true, text: tidyStreamed(text) })
          } else if (event === 'reset') {
            text = ''
            setAnswer({ role: 'assistant', streaming: true, text: '' })
          } else if (event === 'done') {
            setAnswer({ role: 'assistant', data: data.data })
            finished = true
          } else if (event === 'error') {
            throw new Error(data.error || 'Something went wrong. Please try again.')
          }
        }
      }
      if (!finished) throw new Error('The answer was cut off. Please try again.')
    } catch (err) {
      setAnswer({ role: 'assistant', error: err.message || 'Something went wrong. Please try again.' })
    } finally {
      setLoading(false)
    }
  }, [messages, payslip])

  const reset = useCallback(() => setMessages([]), [])

  return { messages, loading, ask, reset }
}
