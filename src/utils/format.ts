export function displayOrEmail(email: string, display?: string | null) {
  return display && display.trim().length > 0 ? display : email
}
