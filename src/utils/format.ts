export function maskEmail(email: string) {
  const [name, domain] = email.split('@')
  if (!name || !domain) return email
  if (name.length <= 2) {
    const firstChar = name[0] ?? ''
    return `${firstChar}*@${domain}`
  }
  const maskedSection = '*'.repeat(Math.max(1, name.length - 2))
  return `${name.slice(0, 2)}${maskedSection}@${domain}`
}

export function displayNameOrMasked(raw: string) {
  return raw.includes('@') ? maskEmail(raw) : raw
}
