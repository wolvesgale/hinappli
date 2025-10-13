import { SUPABASE_ANON_KEY, SUPABASE_REST_BASE } from '@/lib/env.client'

type NameCache = Record<string, string>

const LS_KEY = 'name_cache_v1'
const TTL_MS = 24 * 60 * 60 * 1000

let memCache: { data: NameCache; ts: number } | null = null

const hasStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'

const readEnv = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && typeof process.env !== 'undefined' && process.env[key]) {
    return process.env[key]
  }

  if (typeof import.meta !== 'undefined' && (import.meta as any)?.env && (import.meta as any).env[key]) {
    return (import.meta as any).env[key] as string | undefined
  }

  return undefined
}

function loadCache(): NameCache {
  const now = Date.now()

  if (memCache && now - memCache.ts < TTL_MS) {
    return memCache.data
  }

  if (hasStorage()) {
    try {
      const raw = window.localStorage.getItem(LS_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as { data: NameCache; ts: number }
        if (parsed?.data && typeof parsed.ts === 'number' && now - parsed.ts < TTL_MS) {
          memCache = { data: parsed.data, ts: parsed.ts }
          return memCache.data
        }
      }
    } catch {
      // 無視して新しいキャッシュを作成
    }
  }

  memCache = { data: memCache?.data || {}, ts: now }
  return memCache.data
}

function saveCache(data: NameCache) {
  const now = Date.now()
  const normalized = { ...data }
  memCache = { data: normalized, ts: now }

  if (hasStorage()) {
    try {
      window.localStorage.setItem(LS_KEY, JSON.stringify(memCache))
    } catch {
      // localStorage が利用できない場合はメモリキャッシュのみ維持
    }
  }
}

const getGlobal = <T,>(key: string): T | undefined => {
  if (typeof globalThis === 'undefined') {
    return undefined
  }
  return (globalThis as any)[key] as T | undefined
}

function resolveRestBase(): string {
  const envRest = readEnv('NEXT_PUBLIC_SUPABASE_REST_URL')?.replace(/\/+$/, '')
  const envUrl = readEnv('NEXT_PUBLIC_SUPABASE_URL')?.replace(/\/+$/, '')
  const globalRest = getGlobal<string>('__SUPABASE_REST_FALLBACK__')

  const base = envRest || (envUrl ? `${envUrl}/rest/v1` : '') || SUPABASE_REST_BASE || globalRest || ''
  return base.replace(/\/+$/, '')
}

function resolveAnonKey(): string {
  const envAnon = readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const globalAnon = getGlobal<string>('__SUPABASE_ANON_FALLBACK__')
  const key = envAnon || SUPABASE_ANON_KEY || globalAnon || ''
  return key
}

function anonHeaders() {
  const key = resolveAnonKey()
  if (!key) {
    throw new Error('anon-key-missing')
  }

  return {
    apikey: key,
    Authorization: `Bearer ${key}`
  }
}

const normalizeEmail = (email: string | null | undefined) => (email ?? '').trim().toLowerCase()

/** 単一メールの表示名を取得（他画面用） */
export async function getNameForEmail(email: string): Promise<string> {
  const normalized = normalizeEmail(email)
  if (!normalized) {
    return ''
  }

  const cache = loadCache()
  if (cache[normalized]) {
    return cache[normalized]
  }

  try {
    const base = resolveRestBase()
    if (!base) {
      throw new Error('rest-base-missing')
    }

    const url = new URL(`${base}/user_roles`)
    url.searchParams.set('select', 'email,display_name')
    url.searchParams.set('email', `eq.${normalized}`)

    const res = await fetch(url.toString(), {
      headers: anonHeaders(),
      cache: 'no-store'
    })

    if (res.status === 401 || res.status === 403) {
      throw new Error('auth-error')
    }

    if (!res.ok) {
      throw new Error(String(res.status))
    }

    const rows = (await res.json()) as Array<{ email: string; display_name: string | null }>
    const resolved = rows?.[0]?.display_name?.trim()
    if (resolved) {
      cache[normalized] = resolved
      saveCache(cache)
      return resolved
    }
  } catch {
    // フォールバックでメールを返す
  }

  return email
}

/** 複数メールの事前解決（他画面で一括取得したい場合） */
export async function prefetchNames(emails: string[]) {
  const normalizedEmails = Array.from(
    new Set(emails.map(value => normalizeEmail(value)).filter((value): value is string => Boolean(value)))
  )

  if (normalizedEmails.length === 0) {
    return
  }

  const cache = loadCache()
  const missing = normalizedEmails.filter(key => !cache[key])
  if (missing.length === 0) {
    return
  }

  try {
    const base = resolveRestBase()
    if (!base) {
      throw new Error('rest-base-missing')
    }

    const headers = anonHeaders()

    for (let index = 0; index < missing.length; index += 200) {
      const chunk = missing.slice(index, index + 200)
      if (chunk.length === 0) {
        continue
      }

      const url = new URL(`${base}/user_roles`)
      url.searchParams.set('select', 'email,display_name')
      url.searchParams.append(
        'email',
        `in.(${chunk.map(value => `"${value}"`).join(',')})`
      )

      const res = await fetch(url.toString(), {
        headers,
        cache: 'no-store'
      })

      if (!res.ok) {
        continue
      }

      const rows = (await res.json()) as Array<{ email: string; display_name: string | null }>
      rows.forEach(row => {
        const key = normalizeEmail(row.email)
        if (key && row.display_name) {
          cache[key] = row.display_name.trim()
        }
      })
    }

    saveCache(cache)
  } catch {
    // 取得に失敗した場合は何もしない（メール表示を継続）
  }
}

/** 勤怠カレンダー専用：必ずメールを返す */
export function nameEmailOnly(email: string | null | undefined): string {
  return (email ?? '').trim()
}
