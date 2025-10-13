// lib/env.client.ts
// --- 必ずあなたの Supabase プロジェクトに合わせて2行を正しく埋めてください ---
export const SUPABASE_REST_BASE = 'https://fekjhyecepyrrmmbvtwj.supabase.co/rest/v1'
export const SUPABASE_ANON_KEY = '<ここに Supabase の anon public key を正確にペースト>'
// -------------------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  const keyPreview = SUPABASE_ANON_KEY
    ? `${SUPABASE_ANON_KEY.slice(0, 6)}…${SUPABASE_ANON_KEY.slice(-4)}`
    : '(empty)'
  console.info('[supabase-diag] REST_BASE:', SUPABASE_REST_BASE, ' ANON_KEY:', keyPreview)
}
