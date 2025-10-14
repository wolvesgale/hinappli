export type AttendanceRow = {
  id: string;
  user_email: string | null;
  start_time: string;
  end_time: string | null;
  companion_checked?: boolean | null;
};

// CSR/SSRどちらでも安全に origin を得る
function getOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  // SSR時は相対パスで問題ない（Next/Vercel が補完する）
  return "";
}

/**
 * 勤怠を期間で取得（クライアントは自前APIだけ叩く）
 * - REST直叩きや env 参照はしない
 */
export async function fetchAttendancesInRange(fromISO: string, toISO: string) {
  const base = getOrigin();
  const url = new URL("/api/admin/attendances-range-node", base || "http://localhost");
  url.searchParams.set("from", fromISO);
  url.searchParams.set("to", toISO);

  const res = await fetch(url.toString(), { cache: "no-store" });
  const body = await res.json().catch(() => null);

  if (!res.ok) {
    const detail = body?.detail || body?.error || res.statusText || `${res.status}`;
    throw new Error(`ATT_API_${res.status}: ${detail}`);
  }

  return (body as AttendanceRow[]) ?? [];
}

/** 画面表示はメール固定 */
export function attendanceEmailLabel(row: AttendanceRow) {
  return (row.user_email || "").trim();
}
