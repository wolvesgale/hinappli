// lib/attendance/fetch.ts
import { SUPABASE_REST_BASE, SUPABASE_ANON_KEY } from "@/lib/env.client";

export type AttendanceRow = {
  id: string;
  user_email: string | null;
  start_time: string;
  end_time: string | null;
};

function headers() {
  if (!SUPABASE_ANON_KEY) throw new Error("anon key empty");
  // 今回は apikey のみ送る（Authorization は付けない）
  return { apikey: SUPABASE_ANON_KEY };
}

export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  if (!SUPABASE_REST_BASE) throw new Error("REST base empty");
  const url = new URL(`${SUPABASE_REST_BASE}/attendances`);
  url.searchParams.set("select", "id,user_email,start_time,end_time");
  url.searchParams.set("start_time", `gte.${fromISO}`);
  url.searchParams.append("start_time", `lt.${toISO}`);
  url.searchParams.set("order", "start_time.asc");

  const res = await fetch(url.toString(), { headers: headers(), cache: "no-store" });

  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    throw new Error(`AUTH_${res.status}: ${body || "Invalid anon key or project ref."}`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP_${res.status}: ${body}`);
  }
  return (await res.json()) as AttendanceRow[];
}

// ★この定義を「唯一の toDisplayName」として残す（重複禁止）
export function toDisplayName(row: AttendanceRow): string {
  return (row.user_email || "").trim(); // メール固定
}
