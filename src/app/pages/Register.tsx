import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthProvider'
import type { AppRole } from '@/types/database'

export const Register: React.FC = () => {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [requestedRole, setRequestedRole] = useState<AppRole>('cast')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const { submitAccessRequest } = useAuthContext()
  const navigate = useNavigate()

  const validateDisplayName = (name: string): string | null => {
    // 英数字とアンダースコアのみ許可、数字で始まらない
    const validPattern = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!validPattern.test(name)) {
      return '表示名は英字またはアンダースコアで始まり、英数字とアンダースコアのみ使用できます'
    }
    if (name.length < 2 || name.length > 50) {
      return '表示名は2文字以上50文字以下で入力してください'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // 表示名のバリデーション
    const displayNameError = validateDisplayName(displayName)
    if (displayNameError) {
      setError(displayNameError)
      setLoading(false)
      return
    }

    try {
      await submitAccessRequest(email, displayName, requestedRole)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'アクセス申請に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-6xl mb-4">
            ✅
          </div>
          <h2 className="text-2xl font-bold text-white">申請完了</h2>
          <p className="text-gray-300">
            アクセス申請を送信しました。<br />
            管理者の承認をお待ちください。
          </p>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-2 px-4 bg-pink-600 hover:bg-pink-700 text-white font-medium rounded-md transition-colors"
          >
            ログインページに戻る
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">hinappli</h1>
          <h2 className="text-2xl font-semibold text-gray-300">アクセス申請</h2>
          <p className="text-sm text-gray-400 mt-2">
            システムへのアクセス権限を申請してください
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                メールアドレス
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="your@email.com"
              />
            </div>
            
            <div>
              <label htmlFor="displayName" className="block text-sm font-medium text-gray-300">
                表示名
              </label>
              <input
                id="displayName"
                name="displayName"
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="user_name123"
              />
              <p className="text-xs text-gray-400 mt-1">
                英字またはアンダースコアで始まり、英数字とアンダースコアのみ使用可能（2-50文字）
              </p>
            </div>

            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-300">
                希望する役割
              </label>
              <select
                id="role"
                name="role"
                value={requestedRole}
                onChange={(e) => setRequestedRole(e.target.value as AppRole)}
                className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="cast">キャスト</option>
                <option value="driver">ドライバー</option>
                <option value="owner">オーナー</option>
              </select>
              <p className="text-xs text-gray-400 mt-1">
                オーナー申請は既存オーナーの承認が必要です
              </p>
            </div>
          </div>

          {error && (
            <div className="text-sm p-3 rounded bg-red-900 text-red-300">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '申請中...' : 'アクセス申請を送信'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/login"
              className="text-pink-400 hover:text-pink-300 text-sm"
            >
              既にアカウントをお持ちの方はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}
