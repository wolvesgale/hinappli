// 互換性のための再エクスポート - components/guardsへの段階的移行用
// TODO: 全ての参照をcomponents/guardsに移行後、このファイルを削除予定

export { RequireAuth } from '../components/guards/RequireAuth'
export { RequireOwner } from '../components/guards/RequireOwner'

// RedirectIfAuthedは現在components/guardsに存在しないため、一時的に実装を維持
import React from 'react'
import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'

export function RedirectIfAuthed({ children }: { children: ReactNode }) {
  const { authUser, loading } = useAuthContext()
  if (loading) return null
  if (authUser) return <Navigate to="/" replace />
  return <>{children}</>
}