import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import type { AppRole } from '../types/database'

export const Register: React.FC = () => {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [requestedRole, setRequestedRole] = useState<AppRole>('cast')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  
  const { submitAccessRequest } = useAuthContext()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await submitAccessRequest(email, displayName, requestedRole)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'アクセス申請に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="text-green-400 mb-4">
            <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
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
          <h1 className="text-4xl font-bold text-white mb-2">TRAE POS</h1>
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
                placeholder="山田太郎"
              />
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