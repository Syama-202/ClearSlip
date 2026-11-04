import { useState, useCallback } from 'react'
import { postJson } from '../utils/api.js'

// Generous: a free-tier server waking from sleep plus a first-time
// OCR language download can together take close to a minute
const TIMEOUT_MS = 90000

/**
 * Sends a payslip to POST /api/decode. `decode` resolves with the result or
 * throws an Error carrying the server's message and `code`, so the page can
 * show what went wrong and what to try next.
 */
export default function useDecode() {
  const [loading, setLoading] = useState(false)

  const decode = useCallback(async ({ messages }) => {
    setLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    try {
      return await postJson('/api/decode', { messages }, { signal: controller.signal })
    } catch (err) {
      if (err.name === 'AbortError') throw Object.assign(new Error('ClearSlip took too long to answer. Please try again.'), { code: 'TIMEOUT' })
      if (err instanceof TypeError) throw Object.assign(new Error("Couldn't reach ClearSlip. Check your internet connection and try again."), { code: 'NETWORK' })
      throw err
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [])

  return { decode, loading }
}
