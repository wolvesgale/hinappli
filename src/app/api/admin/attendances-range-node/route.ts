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

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    if (!from || !to) return bad(400, "Missing from/to");

    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl) return bad(500, "SUPABASE_URL not set");
    if (!serviceKey)  return bad(500, "SUPABASE_SERVICE_ROLE_KEY not set");

    const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data, error } = await sb
      .from("attendances")
      .select("id,user_email,start_time,end_time,companion_checked")
      .gte("start_time", from)
      .lt("start_time", to)
      .order("start_time", { ascending: true });

    if (error) return bad(500, "Fetch failed", { message: error.message, code: (error as any).code });
    return json(data ?? [], 200);
  } catch (e: any) {
    return bad(500, "Unhandled", { message: e?.message });
  }
}
