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
}

function headers() {
  validateAnonKeyOrThrow() // 全角やプレースホルダを即検知
  return { apikey: SUPABASE_ANON_KEY }
}

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  if (!SUPABASE_REST_BASE) throw new Error("REST base empty")
  const url = new URL(`${SUPABASE_REST_BASE}/attendances`)
  url.searchParams.set("select", "id,user_email,start_time,end_time")
  url.searchParams.set("start_time", `gte.${fromISO}`)
  url.searchParams.append("start_time", `lt.${toISO}`)
  url.searchParams.set("order", "start_time.asc")

  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" })

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "")
    throw new Error(`AUTH_${res.status}: ${body || "Invalid anon key / RLS policy."}`)
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new Error(`HTTP_${res.status}: ${body}`)
  }
  return (await res.json()) as AttendanceRow[]
}

/** メール表記で描画（固定） */
export function attendanceEmailLabel(row: AttendanceRow): string {
  return (row.user_email || "").trim()
}
