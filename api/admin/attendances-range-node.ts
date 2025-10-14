import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'nodejs'
}

function respond(res: any, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store, max-age=0')
  res.status(status).json(body)
}

function fail(res: any, status: number, message: string, extra?: unknown) {
  console.error('[att-range-node]', message, extra ?? '')
  respond(res, status, { error: message, detail: extra ?? null })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    fail(res, 405, 'Method Not Allowed')
    return
  }

  try {
    const { from, to } = (req.query ?? {}) as { from?: string; to?: string }
    if (!from || !to) {
      fail(res, 400, 'Missing from/to')
      return
    }

    const supabaseUrl = process.env.SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

    if (!supabaseUrl) {
      fail(res, 500, 'SUPABASE_URL not set')
      return
    }
    if (!serviceKey) {
      fail(res, 500, 'SUPABASE_SERVICE_ROLE_KEY not set')
      return
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const { data, error } = await supabase
      .from('attendances')
      .select('id,user_email,start_time,end_time,companion_checked')
      .gte('start_time', from)
      .lt('start_time', to)
      .order('start_time', { ascending: true })

    if (error) {
      fail(res, 500, 'Fetch failed', { message: error.message, code: (error as any)?.code ?? null })
      return
    }

    respond(res, 200, (data ?? []).map(record => ({ ...record })))
  } catch (error) {
    const payload =
      error && typeof error === 'object'
        ? { message: (error as any)?.message ?? 'Unknown error', stack: (error as any)?.stack ?? null }
        : { message: 'Unknown error' }
    fail(res, 500, 'Unhandled', payload)
  }
}
