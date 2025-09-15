import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  global: {
    headers: {
      'X-Client-Info': 'hinappli-web'
    }
  },
  db: {
    schema: 'public'
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Service role client for admin operations (bypasses RLS)
export const supabaseAdmin = supabaseServiceKey 
  ? createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })
  : null

// Helper function to get current user
export const getCurrentUser = async () => {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

// Helper function to sign out
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

// Helper function to get user role
export const getUserRole = async (email: string) => {
  console.log('getUserRole called with email:', email)
  
  try {
    // Use admin client to bypass RLS if available, otherwise use regular client
    const client = supabaseAdmin || supabase
    
    // Add timeout and retry logic
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout after 10 seconds')), 10000)
    })
    
    const queryPromise = client
      .from('user_roles')
      .select('role, display_name')
      .eq('email', email)
      .single()
    
    const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any
    
    console.log('getUserRole result:', { data, error })
    
    if (error && error.code !== 'PGRST116') throw error
    return data
  } catch (err) {
    console.error('Error in getUserRole:', err)
    throw err
  }
}

// Helper function to check if user is owner
export const isOwner = async (email: string) => {
  const role = await getUserRole(email)
  return role?.role === 'owner'
}