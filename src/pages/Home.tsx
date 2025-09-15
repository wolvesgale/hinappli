import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'

export const Home: React.FC = () => {
  const { authUser, signOut, isOwner } = useAuthContext()

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-white">hinappli</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">
                {authUser?.displayName || authUser?.user.email}
              </span>
              <span className="text-xs bg-pink-600 px-2 py-1 rounded">
                {authUser?.role || 'ゲスト'}
              </span>
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white transition-colors"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-white mb-4">
            ようこそ、hinappliへ
          </h2>
          <p className="text-xl text-gray-300">
            ガールズバー向け管理システム
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Transactions */}
          <Link
            to="/transactions"
            className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="text-pink-400 mb-4">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors">
              売上管理
            </h3>
            <p className="text-gray-300">
              日々の売上を記録・管理します
            </p>
          </Link>

          {/* Attendance */}
          <Link
            to="/attendance"
            className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
          >
            <div className="text-pink-400 mb-4">
              <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9M19 9H14V4H19V9Z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors">
              勤怠管理
            </h3>
            <p className="text-gray-300">
              出勤・退勤時間を記録します
            </p>
          </Link>

          {/* Admin (Owner Only) */}
          {isOwner && (
            <Link
              to="/admin"
              className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 hover:bg-black/30 transition-colors group"
            >
              <div className="text-pink-400 mb-4">
                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5L8.5 12L12 4L15.5 12L21 5L19 16H5ZM12 18C13.1 18 14 18.9 14 20S13.1 22 12 22 10 21.1 10 20 10.9 18 12 18Z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 group-hover:text-pink-400 transition-colors">
                管理者設定
              </h3>
              <p className="text-gray-300">
                ユーザー管理・システム設定
              </p>
            </Link>
          )}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
            <h4 className="text-lg font-semibold text-white mb-2">今日の売上</h4>
            <p className="text-3xl font-bold text-pink-400">¥0</p>
          </div>
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
            <h4 className="text-lg font-semibold text-white mb-2">今月の売上</h4>
            <p className="text-3xl font-bold text-pink-400">¥0</p>
          </div>
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6 text-center">
            <h4 className="text-lg font-semibold text-white mb-2">出勤中</h4>
            <p className="text-3xl font-bold text-pink-400">0人</p>
          </div>
        </div>
      </main>
    </div>
  )
}