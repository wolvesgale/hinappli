import { SUPABASE_ANON_KEY, SUPABASE_REST_BASE } from '@/lib/env.client'

export type AttendanceRow = {
  id: string
  user_email: string | null
  start_time: string
  end_time: string | null
  display_name?: string | null
  companion_checked?: boolean | null
}

function assertRestBase(): string {
  const base = SUPABASE_REST_BASE?.replace(/\/+$/, '')
  if (!base) {
    throw new Error('Supabase REST base URL is not set (check env or fallback).')
  }
  return base
}

function authHeaders() {
  if (!SUPABASE_ANON_KEY) {
    throw new Error('Supabase anon key is not set (check env or fallback).')
  }
  return { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
}

/** from <= start_time < to の勤怠を取得（メール表記で復旧） */
export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const base = assertRestBase()
  const url = new URL(`${base}/attendances`)
  url.searchParams.set(
    'select',
    'id,user_email,start_time,end_time,display_name,companion_checked'
  )
  url.searchParams.set('start_time', `gte.${fromISO}`)
  url.searchParams.append('start_time', `lt.${toISO}`)
  url.searchParams.set('order', 'start_time.asc')

  const res = await fetch(url.toString(), { headers: authHeaders(), cache: 'no-store' })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`fetchAttendancesInRange failed: ${res.status} ${text}`)
  }
  return (await res.json()) as AttendanceRow[]
}

