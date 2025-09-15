import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { AccessRequest, UserRole } from '../types/database'

export const Admin: React.FC = () => {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'users'>('requests')
  
  const { authUser } = useAuthContext()

  useEffect(() => {
    fetchAccessRequests()
    fetchUserRoles()
  }, [])

  const fetchAccessRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
      
      if (error) throw error
      setAccessRequests(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUserRoles(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleApproveRequest = async (requestId: string, email: string, displayName: string, role: string) => {
    if (!authUser) return

    try {
      // Add user to user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          email,
          display_name: displayName,
          role: role as 'owner' | 'cast' | 'driver'
        })
      
      if (roleError) throw roleError

      // Update access request status
      const { error: requestError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          approved_by: authUser.user.email!,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (requestError) throw requestError

      fetchAccessRequests()
      fetchUserRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!authUser) return

    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          approved_by: authUser.user.email!,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      fetchAccessRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleRemoveUser = async (email: string) => {
    if (!confirm('このユーザーを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('email', email)
      
      if (error) throw error
      fetchUserRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-600'
      case 'cast': return 'bg-blue-600'
      case 'driver': return 'bg-green-600'
      default: return 'bg-gray-600'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'オーナー'
      case 'cast': return 'キャスト'
      case 'driver': return 'ドライバー'
      default: return role
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-300 hover:text-white">
                ← ホーム
              </Link>
              <h1 className="text-2xl font-bold text-white">管理者設定</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm bg-red-600 px-2 py-1 rounded">
                オーナー専用
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            アクセス申請 ({accessRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ユーザー管理 ({userRoles.length})
          </button>
        </div>

        {/* Access Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">承認待ちのアクセス申請</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : accessRequests.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">承認待ちの申請はありません</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          {request.display_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {request.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(request.requested_role)}`}>
                            {getRoleLabel(request.requested_role)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(request.requested_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRequest(
                            request.id,
                            request.email,
                            request.display_name,
                            request.requested_role
                          )}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          拒否
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">登録済みユーザー</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : userRoles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">登録済みユーザーはいません</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {userRoles.map((user) => (
                    <div
                      key={user.email}
                      className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          {user.display_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {user.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                          <span className="text-xs text-gray-400">
                            登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      {user.email !== authUser?.user.email && (
                        <button
                          onClick={() => handleRemoveUser(user.email)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900 text-red-300 rounded-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}