// lib/env.client.ts
const readEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env[key]) {
    return process.env[key]
  }

  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
    const metaEnv = (import.meta as any).env as Record<string, string | undefined>
    return metaEnv[key]
  }

  return undefined
}

// 1) まずは .env の公開環境変数
const PUBLIC_URL = readEnv('NEXT_PUBLIC_SUPABASE_URL')?.replace(/\/+$/, '') || ''
const PUBLIC_REST = readEnv('NEXT_PUBLIC_SUPABASE_REST_URL')?.replace(/\/+$/, '') || ''
const PUBLIC_ANON = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || ''

// 2) フォールバック直値（← 必ず編集）
//   URL はあなたの Supabase プロジェクトに合わせて固定
//   ANON は Supabase > Project Settings > API の "anon public" をコピペ
const FALLBACK_REST_BASE = 'https://fekjhyecepyrrmmbvtwj.supabase.co/rest/v1' // ←直すならここ
const FALLBACK_ANON_KEY = '<PUT_YOUR_SUPABASE_ANON_KEY_HERE>'                // ←anonキーを貼る

export const SUPABASE_REST_BASE =
  PUBLIC_REST || (PUBLIC_URL ? `${PUBLIC_URL}/rest/v1` : '') || FALLBACK_REST_BASE

export const SUPABASE_ANON_KEY =
  PUBLIC_ANON || FALLBACK_ANON_KEY

if (typeof globalThis !== 'undefined') {
  ;(globalThis as any).__SUPABASE_REST_FALLBACK__ = SUPABASE_REST_BASE
  ;(globalThis as any).__SUPABASE_ANON_FALLBACK__ = SUPABASE_ANON_KEY
}
