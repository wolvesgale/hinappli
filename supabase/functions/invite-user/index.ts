import { createClient } from '@supabase/supabase-js'
import type { Database } from '../../src/types/database.ts'

type InvitePayload = {
  email?: string
  display_name?: string
  role?: 'owner' | 'cast' | 'driver'
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json'
    }
  })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return jsonResponse({ error: 'Missing authorization header' }, 401)
  }

  const authedClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    global: {
      headers: {
        Authorization: authHeader
      }
    }
  })

  const {
    data: { user },
    error: userError
  } = await authedClient.auth.getUser()

  if (userError || !user?.email) {
    return jsonResponse({ error: '認証情報を確認できません' }, 401)
  }

  const { data: ownerRole, error: roleError } = await authedClient
    .from('user_roles')
    .select('role')
    .eq('email', user.email)
    .maybeSingle()

  if (roleError) {
    console.error('Failed to verify role', roleError)
    return jsonResponse({ error: '権限の確認に失敗しました' }, 500)
  }

  if (ownerRole?.role !== 'owner') {
    return jsonResponse({ error: 'この操作はオーナーのみ実行できます' }, 403)
  }

  let payload: InvitePayload
  try {
    payload = await req.json()
  } catch (err) {
    console.error('Invalid payload', err)
    return jsonResponse({ error: 'JSON形式のリクエストを送信してください' }, 400)
  }

  const { email, display_name, role } = payload

  if (!email || !display_name || !role) {
    return jsonResponse({ error: 'email, display_name, role は必須です' }, 400)
  }

  if (!['owner', 'cast', 'driver'].includes(role)) {
    return jsonResponse({ error: '不正なロールが指定されました' }, 400)
  }

  const adminClient = createClient<Database>(supabaseUrl, serviceRoleKey)

  let inviteWarning: string | null = null
  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { display_name }
  })

  if (inviteError) {
    // Supabase returns a 422 error if the user already exists. Treat it as a warning.
    if (inviteError.message?.toLowerCase().includes('already registered')) {
      inviteWarning = inviteError.message
    } else {
      console.error('Failed to invite user', inviteError)
      return jsonResponse({ error: '招待メールの送信に失敗しました' }, 500)
    }
  }

  const { error: upsertError } = await adminClient
    .from('user_roles')
    .upsert({
      email,
      display_name,
      role,
      created_at: new Date().toISOString()
    })

  if (upsertError) {
    console.error('Failed to upsert user role', upsertError)
    return jsonResponse({ error: 'ユーザーロールの更新に失敗しました' }, 500)
  }

  return jsonResponse({
    message: inviteWarning ? `招待済みユーザーのロールを更新しました: ${inviteWarning}` : 'ユーザーを招待しました',
    warning: inviteWarning
  })
})
