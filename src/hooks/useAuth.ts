import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase, getUserRole } from '../lib/supabase'
import type { AppRole } from '../types/database'

export interface AuthUser {
  user: User
  role: AppRole | null
  displayName: string | null
}

export const useAuth = () => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await loadUserWithRole(session.user)
      } else {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          await loadUserWithRole(session.user)
        } else {
          setAuthUser(null)
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const loadUserWithRole = async (user: User) => {
    try {
      console.log('loadUserWithRole called for user:', user.email)
      
      // タイムアウト付きでユーザーロールを取得
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), 5000)
      )
      
      const rolePromise = getUserRole(user.email!)
      const roleData = await Promise.race([rolePromise, timeoutPromise]) as any
      
      console.log('Role data received:', roleData)
      
      setAuthUser({
        user,
        role: roleData?.role || null,
        displayName: roleData?.display_name || null
      })
    } catch (error) {
      console.error('Error loading user role:', error)
      // エラーが発生してもユーザーは認証済みとして扱う
      setAuthUser({
        user,
        role: null,
        displayName: null
      })
    } finally {
      // 必ずローディングを終了
      setLoading(false)
    }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    if (error) throw error
    return data
  }

  const signInWithMagicLink = async (email: string) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })
    if (error) throw error
    return data
  }

  const signUp = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`
      }
    })
    if (error) throw error
    return data
  }

  const resetPassword = async (email: string) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
    return data
  }

  const updatePassword = async (password: string) => {
    const { data, error } = await supabase.auth.updateUser({ password })
    if (error) throw error
    return data
  }

  const signOut = async () => {
    try {
      console.log('Starting sign out process...')
      
      // ユーザー状態をクリア
      setAuthUser(null)
      setLoading(false)
      
      // Supabaseからサインアウト（scope: 'local'を指定してローカルセッションのみクリア）
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) {
        console.error('Supabase sign out error:', error)
        // エラーが発生してもローカル状態はクリアする
      }
      
      // ローカルストレージをクリア（念のため）
      localStorage.clear()
      sessionStorage.clear()
      
      console.log('Sign out completed successfully')
      
    } catch (error) {
      console.error('Sign out error:', error)
      // エラーが発生してもユーザー状態はクリアする
      setAuthUser(null)
      setLoading(false)
      throw error
    }
  }

  const submitAccessRequest = async (email: string, displayName: string, requestedRole: AppRole) => {
    const { data, error } = await supabase
      .from('access_requests')
      .insert({
        email,
        display_name: displayName,
        requested_role: requestedRole
      })
    if (error) throw error
    return data
  }

  return {
    authUser,
    loading,
    signIn,
    signInWithMagicLink,
    signUp,
    resetPassword,
    updatePassword,
    signOut,
    submitAccessRequest,
    isOwner: authUser?.role === 'owner',
    isAuthenticated: !!authUser
  }
}