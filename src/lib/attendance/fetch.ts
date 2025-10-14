// lib/attendance/fetch.ts
import {
  SUPABASE_REST_BASE,
  SUPABASE_ANON_KEY,
  validateAnonKeyOrThrow,
} from "@/lib/env.client"

export type AttendanceRow = {
  id: string
  user_email: string | null
  start_time: string
  end_time: string | null
  companion_checked?: boolean | null
}

function resolveOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost'
}

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const url = new URL('/api/admin/attendances-range-node', resolveOrigin())
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)
  return url
}

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const detail = (body as any)?.error ?? (body as any)?.detail ?? res.statusText
    throw new Error(`ATT_API_${res.status}: ${detail}`)
  }

  return (body as AttendanceRow[]) ?? []
}

export function attendanceEmailLabel(row: AttendanceRow) {
  return (row.user_email || '').trim()
}

// ───────────────────────────────────────────
// ⚠ 重要: ここに "export function toDisplayName" は存在しない。
// ファイル末尾に余計な再エクスポートも追加しないこと。
// ───────────────────────────────────────────
