export type AttendanceRow = {
  id: string
  user_id: string | null
  user_email: string | null
  start_time: string
  end_time: string | null
  companion_checked: boolean | null
}

function readEnv(key: string): string | undefined {
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key]
  }

  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    const metaEnv = (import.meta as any).env as Record<string, string | undefined>
    return metaEnv[key]
  }

  return undefined
}

function getRestBase(): string {
  const explicit = readEnv('NEXT_PUBLIC_SUPABASE_REST_URL')
  if (explicit) {
    return explicit.replace(/\/+$/, '')
  }

  const projectUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')
  if (!projectUrl) {
    throw new Error('Supabase REST base URL is not set')
  }

  return `${projectUrl.replace(/\/+$/, '')}/rest/v1`
}

function authHeaders() {
  const anon = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!anon) {
    throw new Error('NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  }

  return {
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  }
}

/** from <= start_time < to の勤怠を取得（メール表記で復旧） */
export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const base = getRestBase()
  const url = new URL(`${base}/attendances`)

  url.searchParams.set(
    'select',
    'id,user_id,user_email,start_time,end_time,companion_checked'
  )
  url.searchParams.set('start_time', `gte.${fromISO}`)
  url.searchParams.append('start_time', `lt.${toISO}`)
  url.searchParams.set('order', 'start_time.asc')

  const res = await fetch(url.toString(), { headers: authHeaders(), cache: 'no-store' })
  if (!res.ok) throw new Error(`fetchAttendancesInRange failed: ${res.status}`)
  const rows = (await res.json()) as AttendanceRow[]
  return rows
}

/** 画面表示用。今回の復旧では必ずメールを返す */
export function toDisplayName(row: AttendanceRow): string {
  return (row.user_email || '').trim()
}
