import { useState, useCallback } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function useClaudeApi() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const analyze = useCallback(async ({ messages }) => {
    setLoading(true)
    setError(null)
    setData(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)

    try {
      const response = await fetch(`${API_BASE}/api/decode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
        signal: controller.signal,
        credentials: 'include',
      })

      const json = await response.json()

      if (!response.ok) {
        throw Object.assign(
          new Error(json.error || `Server error (${response.status})`),
          { code: json.code }
        )
      }

      setData(json.data)
      return json.data
    } catch (err) {
      const msg = err.name === 'AbortError'
        ? 'Request timed out. Please try again.'
        : err.message || 'Something went wrong. Please try again.'
      setError(msg)
      return null
    } finally {
      clearTimeout(timeout)
      setLoading(false)
    }
  }, [])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return { analyze, data, loading, error, reset }
}
