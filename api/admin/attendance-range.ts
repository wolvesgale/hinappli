import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'nodejs'
}

function bad(res: any, status: number, msg: string, extra?: unknown) {
  if (extra) {
    console.error('[attendance-range]', msg, extra)
  } else {
    console.error('[attendance-range]', msg)
  }

  res.status(status).json({ error: msg, detail: extra ?? null })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    bad(res, 405, 'Method Not Allowed')
    return
  }

  const { from, to } = req.query as { from?: string; to?: string }

  if (!from || !to) {
    bad(res, 400, 'Missing from/to')
    return
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    bad(res, 500, 'Supabase URL env is not set', {
      expected: ['SUPABASE_URL (server)', 'or NEXT_PUBLIC_SUPABASE_URL (public)']
    })
    return
  }

  if (!serviceRoleKey) {
    bad(res, 500, 'SUPABASE_SERVICE_ROLE_KEY is not set')
    return
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    })

    const { data, error } = await supabase.rpc('fetch_attendances_with_names', {
      p_from: from,
      p_to: to
    })

    if (error) {
      bad(res, 500, 'RPC fetch_attendances_with_names failed', {
        message: error.message,
        details: (error as any)?.details ?? null,
        hint: (error as any)?.hint ?? null,
        code: (error as any)?.code ?? null
      })
      return
    }

    const records = Array.isArray(data) ? data : []
    const normalized = records.map((row: any) => ({
      ...row,
      display_name: row?.display_name ?? row?.user_email ?? null
    }))

    res.status(200).json(normalized)
  } catch (error: unknown) {
    const payload =
      error && typeof error === 'object'
        ? { message: (error as any)?.message ?? 'Unknown error', stack: (error as any)?.stack ?? null }
        : { message: 'Unknown error' }

    bad(res, 500, 'Unhandled exception', payload)
  }
}
