import { useState, useEffect } from 'react'

import { API_BASE } from '../utils/api.js'

/**
 * Asks the backend which optional features it has configured:
 * { llmFallback, checklistEmail }. Each is null until the answer arrives
 * (or if the server can't be reached), so callers only hide a feature
 * once the server has said it's off.
 */
export default function useServerFeatures() {
  const [features, setFeatures] = useState({ llmFallback: null, checklistEmail: null })

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/health`)
      .then(res => res.json())
      .then(json => { if (!cancelled && json.features) setFeatures(json.features) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  return features
}
