// lib/env.client.ts
const PUB_URL = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "")
const PUB_REST = (process.env.NEXT_PUBLIC_SUPABASE_REST_URL || "").replace(/\/+$/, "")
const PUB_ANON = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim()

// ★ フォールバック直値（必ずあなたの値で上書き）
export const FALLBACK_REST_BASE = "https://fekjhyecepyrrmmbvtwj.supabase.co/rest/v1"
export const FALLBACK_ANON_KEY = "<貼り付け：Supabaseの anon public key（英数/._- のみ）>"

export const SUPABASE_REST_BASE = (
  PUB_REST || (PUB_URL ? `${PUB_URL}/rest/v1` : "") || FALLBACK_REST_BASE
).replace(/\/+$/, "")

export const SUPABASE_ANON_KEY = (PUB_ANON || FALLBACK_ANON_KEY).trim()

// ▲ バリデーション（全角/プレースホルダ/空を弾く）
export function validateAnonKeyOrThrow() {
  const key = SUPABASE_ANON_KEY
  const hasNonAscii = /[^\x00-\x7F]/.test(key)
  const looksPlaceholder = /ここに|<|＞|＜|paste/i.test(key)
  const looksEmpty = !key || key.length < 10

  if (hasNonAscii || looksPlaceholder || looksEmpty) {
    throw new Error("ANON_KEY_MISCONFIGURED")
  }
}

// 表示用ダイアグ（先頭6/末尾4だけ出す）
if (typeof window !== "undefined") {
  const preview = SUPABASE_ANON_KEY
    ? `${SUPABASE_ANON_KEY.slice(0, 6)}…${SUPABASE_ANON_KEY.slice(-4)}`
    : "(empty)"
  console.info("[supabase-diag]", { REST_BASE: SUPABASE_REST_BASE, ANON_KEY: preview })
}
