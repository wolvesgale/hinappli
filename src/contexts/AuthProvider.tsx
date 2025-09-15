import React, { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../hooks/useAuth'
import type { AuthUser } from '../hooks/useAuth'
import type { AppRole } from '../types/database'

/* eslint-disable @typescript-eslint/no-explicit-any */
interface AuthContextType {
  authUser: AuthUser | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<any>
  signInWithMagicLink: (email: string) => Promise<any>
  signUp: (email: string, password: string) => Promise<any>
  resetPassword: (email: string) => Promise<any>
  updatePassword: (password: string) => Promise<any>
  signOut: () => Promise<void>
  submitAccessRequest: (email: string, displayName: string, requestedRole: AppRole) => Promise<any>
  isOwner: boolean
  isAuthenticated: boolean
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// eslint-disable-next-line react-refresh/only-export-components
export const useAuthContext = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const auth = useAuth()

  return (
    <AuthContext.Provider value={auth}>
      {children}
    </AuthContext.Provider>
  )
}