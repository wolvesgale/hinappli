import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function json(data: any, status = 200) {
  const r = NextResponse.json(data, { status });
  r.headers.set("Cache-Control", "no-store");
  return r;
}
function bad(status: number, msg: string, extra?: any) {
  console.error("[att-range-node]", msg, extra ?? "");
  return json({ error: msg, detail: extra ?? null }, status);
}

type AttendanceRow = {
  id: string;
  user_email: string | null;
  start_time: string;
  end_time: string | null;
  companion_checked?: boolean | null;
};

type RoleRow = {
  email: string | null;
  display_name: string | null;
};

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return bad(400, "Missing from/to");

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl) return bad(500, "SUPABASE_URL not set");
    if (!serviceKey) return bad(500, "SUPABASE_SERVICE_ROLE_KEY not set");

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    // 1) 勤怠データを取得
    const { data: rows, error } = await sb
      .from("attendances")
      .select("id,user_email,start_time,end_time,companion_checked")
      .gte("start_time", from)
      .lt("start_time", to)
      .order("start_time", { ascending: true });

    if (error) return bad(500, "Fetch failed", { message: error.message, code: (error as any).code });

    const data: AttendanceRow[] = rows ?? [];

    // 2) メール集合を抽出し、ユーザーロールから表示名を取得
    const emailSet = new Set<string>();
    for (const row of data) {
      const raw = (row.user_email || "").trim();
      if (!raw) continue;
      emailSet.add(raw);
      const lower = raw.toLowerCase();
      if (lower && lower !== raw) {
        emailSet.add(lower);
      }
    }

    const emailList = Array.from(emailSet);
    const nameMap = new Map<string, string>();

    if (emailList.length > 0) {
      const { data: roles, error: rolesErr } = await sb
        .from("user_roles")
        .select("email,display_name")
        .in("email", emailList);

      if (rolesErr) {
        console.error("[att-range-node] roles fetch failed", rolesErr);
      } else if (roles) {
        for (const role of roles as RoleRow[]) {
          const email = (role.email || "").trim();
          if (!email) continue;
          const key = email.toLowerCase();
          const value = (role.display_name || "").trim();
          if (value) {
            nameMap.set(key, value);
          }
        }
      }
    }

    // 3) display_name を付与（なければメール）
    const enriched = data.map((row) => {
      const email = (row.user_email || "").trim();
      const displayName = email ? nameMap.get(email.toLowerCase()) || email : "";
      return { ...row, display_name: displayName };
    });

    return json(enriched, 200);
  } catch (e: any) {
    return bad(500, "Unhandled", { message: e?.message });
  }
}
