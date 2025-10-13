import { SUPABASE_ANON_KEY, SUPABASE_REST_BASE } from '@/lib/env.client'

export type AttendanceRow = {
  id: string
  user_email: string | null
  start_time: string
  end_time: string | null
  companion_checked?: boolean | null
}

function headers() {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Supabase anon key not set')
  }
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
}

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  if (!SUPABASE_REST_BASE) {
    throw new Error('Supabase REST base URL not set')
  }
  const url = new URL(`${SUPABASE_REST_BASE}/attendances`)
  url.searchParams.set('select', 'id,user_email,start_time,end_time,companion_checked')
  url.searchParams.set('start_time', `gte.${fromISO}`)
  url.searchParams.append('start_time', `lt.${toISO}`)
  url.searchParams.set('order', 'start_time.asc')

  const res = await fetch(url.toString(), { headers: headers(), cache: 'no-store' })

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => '')
    throw new Error(`AUTH_${res.status}: ${body || 'Invalid API key (anon). Check env/fallback.'}`)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`HTTP_${res.status}: ${body}`)
  }

  return (await res.json()) as AttendanceRow[]
}

export function toDisplayName(row: AttendanceRow): string {
  return (row.user_email || '').trim()
}

