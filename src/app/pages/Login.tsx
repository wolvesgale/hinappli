'use client';

import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthContext } from '@/contexts/AuthProvider'

export const Login: React.FC = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [useMagicLink, setUseMagicLink] = useState(false)
  
  const { signIn, signInWithMagicLink } = useAuthContext()
  const navigate = useNavigate()
  const location = useLocation()
  
  const from = location.state?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (useMagicLink) {
        await signInWithMagicLink(email)
        setError('マジックリンクをメールに送信しました。メールをご確認ください。')
      } else {
        await signIn(email, password)
        navigate(from, { replace: true })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ログインに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-2">hinappli</h1>
          <h2 className="text-2xl font-semibold text-gray-300">ログイン</h2>
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
            
            {!useMagicLink && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                  パスワード
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="パスワード"
                />
              </div>
            )}
          </div>

          <div className="flex items-center">
            <input
              id="magic-link"
              name="magic-link"
              type="checkbox"
              checked={useMagicLink}
              onChange={(e) => setUseMagicLink(e.target.checked)}
              className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
            />
            <label htmlFor="magic-link" className="ml-2 block text-sm text-gray-300">
              マジックリンクでログイン
            </label>
          </div>

          {error && (
            <div className={`text-sm p-3 rounded ${error.includes('送信しました') ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '処理中...' : useMagicLink ? 'マジックリンクを送信' : 'ログイン'}
            </button>
          </div>

          <div className="text-center">
            <Link
              to="/register"
              className="text-pink-400 hover:text-pink-300 text-sm"
            >
              アカウント登録はこちら
            </Link>
          </div>
        </form>
      </div>
    </div>
  )
}

export default Login
