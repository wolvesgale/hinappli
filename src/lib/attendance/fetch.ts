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
  display_name?: string | null
}

const API_PATH = '/api/admin/attendances-range-node'

function buildUrl(fromISO: string, toISO: string) {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const url = new URL(API_PATH, base)
  url.searchParams.set('from', fromISO)
  url.searchParams.set('to', toISO)
  return url
}

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const url = buildUrl(fromISO, toISO)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const body = await res.json().catch(() => null)

  if (!res.ok) {
    const detail = (body as any)?.detail ?? (body as any)?.error ?? `${res.status}`
    throw new Error(`ATT_API_${res.status}: ${detail}`)
  }

  return (body as AttendanceRow[]) ?? []
}

/** メール表記で描画（固定） */
export function attendanceEmailLabel(row: AttendanceRow): string {
  return (row.user_email || '').trim()
}

// ───────────────────────────────────────────
// ⚠ 重要: ここに "export function toDisplayName" は存在しない。
// ファイル末尾に余計な再エクスポートも追加しないこと。
// ───────────────────────────────────────────
