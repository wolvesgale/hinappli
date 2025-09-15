import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})

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
  
  const { data, error } = await supabase
    .from('user_roles')
    .select('role, display_name')
    .eq('email', email)
    .single()
  
  console.log('getUserRole result:', { data, error })
  
  if (error && error.code !== 'PGRST116') throw error
  return data
}

// Helper function to check if user is owner
export const isOwner = async (email: string) => {
  const role = await getUserRole(email)
  return role?.role === 'owner'
}