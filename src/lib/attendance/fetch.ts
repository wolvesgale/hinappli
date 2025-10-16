export type AttendanceRow = {
  id: string;
  user_email: string | null;
  start_time: string;
  end_time: string | null;
  companion_checked?: boolean | null;
};

function origin(): string {
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}

/** クライアントは自前APIのみ呼ぶ（REST直・env参照はしない） */
export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const url = new URL("/api/admin/attendances-range-node", origin() || "http://localhost");
  url.searchParams.set("from", fromISO);
  url.searchParams.set("to", toISO);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`ATT_API_${res.status}: ${body?.error || body?.detail || res.statusText}`);
  return (body as AttendanceRow[]) ?? [];
}

/** 画面表示はメール固定 */
export function attendanceEmailLabel(row: AttendanceRow) {
  return (row.user_email || "").trim();
}
