import React from 'react'
import type { ReactNode } from 'react'
import { useAuthContext } from '../../contexts/AuthProvider'
import { Navigate } from 'react-router-dom'

interface RequireOwnerProps {
  children: ReactNode
}

export const RequireOwner: React.FC<RequireOwnerProps> = ({ children }) => {
  const { isOwner, loading, isAuthenticated } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-xl">読み込み中...</div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white text-center">
          <h1 className="text-2xl font-bold mb-4">アクセス権限がありません</h1>
          <p className="text-gray-300">この機能はオーナーのみ利用可能です。</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}