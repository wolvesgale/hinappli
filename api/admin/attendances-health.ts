import { createClient } from '@supabase/supabase-js'

export const config = {
  runtime: 'nodejs'
}

function respond(res: any, status: number, body: unknown) {
  res.setHeader('Cache-Control', 'no-store')
  res.status(status).json(body)
}

function fail(res: any, status: number, message: string, extra?: unknown) {
  console.error('[att-health]', message, extra ?? '')
  respond(res, status, { ok: false, error: message, detail: extra ?? null })
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    fail(res, 405, 'Method Not Allowed')
    return
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

  if (!supabaseUrl) {
    fail(res, 500, 'SUPABASE_URL not set')
    return
  }
  if (!serviceKey) {
    fail(res, 500, 'SUPABASE_SERVICE_ROLE_KEY not set')
    return
  }

  try {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false }
    })

    const totalQuery = await supabase
      .from('attendances')
      .select('*', { head: true, count: 'exact' })

    if (totalQuery.error) {
      fail(res, 500, 'count failed', totalQuery.error)
      return
    }

    const latest = await supabase
      .from('attendances')
      .select('id,user_email,start_time,created_at')
      .order('created_at', { ascending: false })
      .limit(3)

    if (latest.error) {
      fail(res, 500, 'latest failed', latest.error)
      return
    }

    respond(res, 200, {
      ok: true,
      total: totalQuery.count ?? 0,
      sample: latest.data ?? []
    })
  } catch (error) {
    fail(res, 500, 'Unhandled', error)
  }
}
