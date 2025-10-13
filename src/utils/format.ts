export function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) return `${name[0] || ''}*@${domain}`
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(1, name.length - 2))}@${domain}`
}

export function displayFrom(email: string, display?: string | null) {
  return display && display.trim().length > 0 ? display : maskEmail(email)
}
