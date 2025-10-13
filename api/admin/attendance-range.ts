import { createClient } from '@supabase/supabase-js'

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' })
    return
  }

  const { from, to } = req.query as { from?: string; to?: string }

  if (!from || !to) {
    res.status(400).json({ error: 'Missing from/to' })
    return
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ error: 'Service role credentials are not configured' })
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
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json(data ?? [])
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({ error: message })
  }
}
