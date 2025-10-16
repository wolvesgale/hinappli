'use client';

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthProvider'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

type RoleFilter = 'all' | 'owner' | 'cast' | 'driver'

type InviteRole = 'owner' | 'cast' | 'driver'

export const UsersAdmin: React.FC = () => {
  const { authUser } = useAuthContext()
  const [users, setUsers] = useState<UserRole[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    displayName: '',
    role: 'cast' as InviteRole
  })

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: fetchError } = await supabase
          .from('user_roles')
          .select('*')
          .order('created_at', { ascending: false })

        if (fetchError) throw fetchError
        setUsers(data || [])
      } catch (err) {
        console.error(err)
        setError('ユーザー一覧の取得に失敗しました')
      } finally {
        setLoading(false)
      }
    }

    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const keyword = searchTerm.trim().toLowerCase()
      const matchesSearch =
        keyword.length === 0 ||
        user.email.toLowerCase().includes(keyword) ||
        user.display_name.toLowerCase().includes(keyword)
      return matchesRole && matchesSearch
    })
  }, [roleFilter, searchTerm, users])

  const resetInviteForm = () => {
    setInviteForm({ email: '', displayName: '', role: 'cast' })
  }

  const refreshUsers = async () => {
    const { data } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers(data || [])
  }

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (!inviteForm.email) {
      setError('メールアドレスを入力してください')
      return
    }
    if (!inviteForm.displayName) {
      setError('表示名を入力してください')
      return
    }

    setInviteLoading(true)

    try {
      const { data, error: functionError } = await supabase.functions.invoke('invite-user', {
        body: {
          email: inviteForm.email,
          display_name: inviteForm.displayName,
          role: inviteForm.role
        }
      })

      if (functionError) throw functionError

      if (data?.error) {
        throw new Error(data.error)
      }

      setSuccess(data?.message || '招待メールを送信しました')
      resetInviteForm()
      await refreshUsers()
    } catch (err) {
      console.error(err)
      setError(err instanceof Error ? err.message : '招待処理でエラーが発生しました')
    } finally {
      setInviteLoading(false)
    }
  }

  const roleCount = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc[user.role] = (acc[user.role] ?? 0) + 1
        return acc
      },
      { owner: 0, cast: 0, driver: 0 } as Record<InviteRole, number>
    )
  }, [users])

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 flex items-center justify-center">
        <div className="text-white">認証情報を確認できませんでした。</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">ユーザー管理</h1>
            <p className="text-sm text-gray-300 mt-1">オーナー権限で新しいユーザーを招待できます。</p>
          </div>
          <Link
            to="/admin"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 transition"
          >
            ← 管理トップに戻る
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white/10 rounded-lg px-4 py-3 border border-white/10">
            <div className="text-sm text-gray-300">オーナー</div>
            <div className="text-2xl font-semibold text-white mt-1">{roleCount.owner}</div>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-3 border border-white/10">
            <div className="text-sm text-gray-300">キャスト</div>
            <div className="text-2xl font-semibold text-white mt-1">{roleCount.cast}</div>
          </div>
          <div className="bg-white/10 rounded-lg px-4 py-3 border border-white/10">
            <div className="text-sm text-gray-300">ドライバー</div>
            <div className="text-2xl font-semibold text-white mt-1">{roleCount.driver}</div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex-1">
                <input
                  type="search"
                  placeholder="メールアドレスまたは表示名で検索"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-gray-300">ロール</label>
                <select
                  value={roleFilter}
                  onChange={event => setRoleFilter(event.target.value as RoleFilter)}
                  className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                >
                  <option value="all">すべて</option>
                  <option value="owner">オーナー</option>
                  <option value="cast">キャスト</option>
                  <option value="driver">ドライバー</option>
                </select>
              </div>
            </div>

            <div className="mt-6">
              {loading ? (
                <div className="text-center text-gray-300 py-10">読み込み中...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center text-gray-300 py-10">該当するユーザーが見つかりませんでした</div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map(user => (
                    <div key={user.email} className="bg-black/30 border border-white/10 rounded-lg px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                      <div>
                        <div className="text-base font-semibold text-white">{user.display_name}</div>
                        <div className="text-sm text-gray-300">{user.email}</div>
                      </div>
                      <div className="text-sm text-gray-300">
                        {user.role === 'owner' ? 'オーナー' : user.role === 'cast' ? 'キャスト' : 'ドライバー'}
                      </div>
                      <div className="text-xs text-gray-500">登録日: {new Date(user.created_at).toLocaleString('ja-JP')}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-5 shadow-xl">
            <h2 className="text-lg font-semibold">ユーザー招待</h2>
            <p className="text-sm text-gray-300 mt-1">SERVICE_ROLEを使った招待機能で新規ユーザーを登録できます。</p>

            {error && <div className="mt-4 bg-red-500/20 text-red-200 px-3 py-2 rounded">{error}</div>}
            {success && <div className="mt-4 bg-emerald-500/20 text-emerald-200 px-3 py-2 rounded">{success}</div>}

            <form className="mt-6 space-y-4" onSubmit={handleInvite}>
              <div>
                <label className="block text-sm text-gray-300 mb-1">メールアドレス</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={event => setInviteForm(prev => ({ ...prev, email: event.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                  placeholder="example@example.com"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">表示名</label>
                <input
                  type="text"
                  value={inviteForm.displayName}
                  onChange={event => setInviteForm(prev => ({ ...prev, displayName: event.target.value }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                  placeholder="ユーザーの名前"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">ロール</label>
                <select
                  value={inviteForm.role}
                  onChange={event => setInviteForm(prev => ({ ...prev, role: event.target.value as InviteRole }))}
                  className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white"
                >
                  <option value="owner">オーナー</option>
                  <option value="cast">キャスト</option>
                  <option value="driver">ドライバー</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-pink-600 hover:bg-pink-700 transition px-4 py-2 rounded text-white font-semibold disabled:opacity-60"
                disabled={inviteLoading}
              >
                {inviteLoading ? '送信中...' : '招待メールを送信'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UsersAdmin

