import React from 'react'
import type { ReactNode } from 'react'
import { useAuthContext } from '../../contexts/AuthProvider'
import { Navigate, useLocation } from 'react-router-dom'

interface RequireAuthProps {
  children: ReactNode
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const { isAuthenticated, loading } = useAuthContext()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}