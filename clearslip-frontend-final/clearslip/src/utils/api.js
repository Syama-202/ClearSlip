// The backend's address: VITE_API_URL is baked in at build time (see README → Deploy)
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

/** POSTs JSON and returns `data`, or throws with the server's message. */
export async function postJson(path, body, { signal } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(json.error || `Server error (${response.status})`), { code: json.code })
  return json.data
}
