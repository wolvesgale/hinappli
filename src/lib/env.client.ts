// lib/env.client.ts
// 1) 環境変数（あれば優先）
const PUB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '')
const PUB_REST = (process.env.NEXT_PUBLIC_SUPABASE_REST_URL || '').replace(/\/+$/, '')
const PUB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()

// 2) フォールバック（★必ず埋める：あなたの Supabase の anon key）
export const FALLBACK_REST_BASE = 'https://fekjhyecepyrrmmbvtwj.supabase.co/rest/v1'
export const FALLBACK_ANON_KEY = '<PASTE_YOUR_SUPABASE_ANON_KEY_HERE>' // ←ここに anon key を貼る

// 3) 実際に使う値（env → fallback の順）
export const SUPABASE_REST_BASE = (PUB_REST || (PUB_URL ? `${PUB_URL}/rest/v1` : '') || FALLBACK_REST_BASE).replace(/\/+$/, '')
export const SUPABASE_ANON_KEY = PUB_ANON || FALLBACK_ANON_KEY

if (typeof window !== 'undefined') {
  const keyPreview = SUPABASE_ANON_KEY ? `${SUPABASE_ANON_KEY.slice(0, 6)}…` : '(empty)'
  console.info('[supabase] REST_BASE:', SUPABASE_REST_BASE, ' ANON_KEY:', keyPreview)
}
