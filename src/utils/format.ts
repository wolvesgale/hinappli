export function displayOrEmail(email?: string | null, display?: string | null) {
  const safeEmail = email ?? ''
  const safeDisplay = display?.trim()
  if (safeDisplay) {
    return safeDisplay
  }
  return safeEmail
}
