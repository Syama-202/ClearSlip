import { useState, useEffect } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

// Wait for a slider to settle before asking the server
const DEBOUNCE_MS = 200

/**
 * Runs the what-if inputs through /api/tax/simulate whenever they change.
 * The previous result stays on screen while a new one loads, and a reply
 * that arrives after a newer request was sent is dropped.
 */
export default function useTaxSimulation(inputs) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const body = JSON.stringify(inputs)

  useEffect(() => {
    if (!(inputs.grossAnnual > 0)) {
      setResult(null)
      return undefined
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoading(true)
      try {
        const response = await fetch(`${API_BASE}/api/tax/simulate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: controller.signal,
        })
        const json = await response.json()
        if (!response.ok) throw new Error(json.error || `Server error (${response.status})`)
        setResult(json.data)
        setError(null)
      } catch (err) {
        if (err.name !== 'AbortError') setError(err.message || 'Could not calculate. Please try again.')
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  // `body` captures every input, so the effect reruns only when a value changes
  }, [body])

  return { result, loading, error }
}
