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
              <h1 className="text-2xl font-bold text-white">TRAE POS</h1>
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
            ようこそ、TRAE POSへ
          </h2>
          <p className="text-xl text-gray-300">
            小規模店舗向けレジ管理システム
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
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
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
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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