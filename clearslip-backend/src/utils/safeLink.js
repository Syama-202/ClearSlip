// Links shown or emailed to users must be https and point to an official site.
// This blocks javascript:/data: URLs and lookalike domains that an AI-generated
// action item (e.g. from a crafted payslip) could otherwise carry.
const ALLOWED_SUFFIXES = ['.gov.in', '.nic.in']
const ALLOWED_HOSTS = ['enps.nsdl.com', 'npscra.nsdl.co.in']

export function safeLink(url) {
  if (typeof url !== 'string') return null
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  const host = parsed.hostname.toLowerCase()
  const allowed = ALLOWED_HOSTS.includes(host) || ALLOWED_SUFFIXES.some(s => host.endsWith(s))
  return parsed.protocol === 'https:' && allowed ? parsed.href : null
}
