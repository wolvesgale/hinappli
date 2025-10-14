import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'nodejs'
}

function bad(res: any, status: number, msg: string, extra?: unknown) {
  if (extra) {
    console.error('[attendances-range-node]', msg, extra)
  } else {
    console.error('[attendances-range-node]', msg)
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

  const supabaseUrl =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    'https://fekjhyecepyrrmmbvtwj.supabase.co'
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) {
    bad(res, 500, 'SUPABASE_URL is not set')
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

    const { data, error } = await supabase
      .from('attendances')
      .select('id,user_email,start_time,end_time,companion_checked')
      .gte('start_time', from)
      .lt('start_time', to)
      .order('start_time', { ascending: true })

    if (error) {
      bad(res, 500, 'Fetch attendances failed', {
        message: error.message,
        code: (error as any)?.code ?? null
      })
      return
    }

    const records = Array.isArray(data) ? data : []
    const result = records.map(row => ({
      ...row,
      display_name: row?.user_email ?? null
    }))

    res.status(200).json(result)
  } catch (error: unknown) {
    const payload =
      error && typeof error === 'object'
        ? { message: (error as any)?.message ?? 'Unknown error', stack: (error as any)?.stack ?? null }
        : { message: 'Unknown error' }

    bad(res, 500, 'Unhandled exception', payload)
  }
}
