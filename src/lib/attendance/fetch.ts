export type AttendanceRow = {
  id: string
  user_id: string | null
  user_email: string
  start_time: string
  end_time: string | null
  companion_checked: boolean
  created_at: string
  role: string | null
  display_name: string
}

const DEFAULT_BASE_URL = 'http://localhost'

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : DEFAULT_BASE_URL
  const url = new URL('/api/admin/attendance-range', baseUrl)
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)

  const response = await fetch(url.toString(), { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`attendance-range: ${response.status}`)
  }

  const rows = (await response.json()) as AttendanceRow[]

  return rows.map(row => ({
    ...row,
    display_name: (row.display_name || row.user_email || '').trim()
  }))
}
