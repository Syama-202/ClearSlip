const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export async function sendChecklist({ email, userName, checklistItems, payslipSummary }) {
  const response = await fetch(`${API_BASE}/api/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, userName, checklistItems, payslipSummary }),
  })

  const json = await response.json()
  if (!response.ok) throw new Error(json.error || 'Failed to send checklist')
  return { success: true }
}
