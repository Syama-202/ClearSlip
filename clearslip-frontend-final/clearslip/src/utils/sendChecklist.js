import { API_BASE } from './api.js'

export async function sendChecklist({ email, userName, checklistItems, payslipSummary, checklistToken }) {
  const response = await fetch(`${API_BASE}/api/checklist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, userName, checklistItems, payslipSummary, checklistToken }),
  })

  const json = await response.json()
  if (!response.ok) throw new Error(json.error || 'Failed to send checklist')
  return { success: true }
}
