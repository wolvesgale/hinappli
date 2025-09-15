import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { RegisterManager } from '../components/RegisterManager'
import { supabase } from '../lib/supabase'

export const Home: React.FC = () => {
  const { authUser, signOut, isOwner } = useAuthContext()
  const [registerStatus, setRegisterStatus] = useState<'closed' | 'open'>('closed')
  const [cashAmount, setCashAmount] = useState('')
  const [paypayAmount, setPaypayAmount] = useState('')

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const handleCashSale = async () => {
    if (cashAmount && authUser) {
      try {
        const today = new Date().toISOString().split('T')[0]
        const { error } = await supabase
          .from('transactions')
          .insert({
            biz_date: today,
            payment_method: 'cash',
            amount: parseFloat(cashAmount),
            created_by: authUser.user.email!
          })

        if (error) throw error
        setCashAmount('')
        console.log('現金売上を記録しました:', cashAmount)
      } catch (error) {
        console.error('現金売上記録エラー:', error)
      }
    }
  }

  const handlePaypaySale = async () => {
    if (paypayAmount && authUser) {
      try {
        const today = new Date().toISOString().split('T')[0]
        const { error } = await supabase
          .from('transactions')
          .insert({
            biz_date: today,
            payment_method: 'paypay',
            amount: parseFloat(paypayAmount),
            created_by: authUser.user.email!
          })

        if (error) throw error
        setPaypayAmount('')
        console.log('PayPay売上を記録しました:', paypayAmount)
      } catch (error) {
        console.error('PayPay売上記録エラー:', error)
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-pink-900 relative overflow-hidden">
      {/* 星空背景 */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars"></div>
        <div className="twinkling"></div>
      </div>
      
      {/* Header */}
      <header className="relative z-10 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-white">hinappli</h1>
            </div>
            <div className="flex items-center space-x-3">
              <span className="text-gray-300 text-sm">
                {authUser?.displayName || authUser?.user.email}
              </span>
              <span className="text-xs bg-pink-600 px-2 py-1 rounded">
                {authUser?.role || 'ゲスト'}
              </span>
              <button
                onClick={handleSignOut}
                className="text-gray-300 hover:text-white transition-colors text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* レジ管理 */}
        <div className="mb-6">
          <RegisterManager 
            registerStatus={registerStatus}
            onStatusChange={setRegisterStatus}
          />
        </div>

        {/* レジ入力機能 */}
        {registerStatus === 'open' && (
          <div className="mb-6">
            <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-white mb-4">売上入力</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 現金 */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">現金</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="金額"
                      className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                    />
                    <button
                      onClick={handleCashSale}
                      disabled={!cashAmount}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      記録
                    </button>
                  </div>
                </div>

                {/* PayPay */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">PayPay</label>
                  <div className="flex space-x-2">
                    <input
                      type="number"
                      value={paypayAmount}
                      onChange={(e) => setPaypayAmount(e.target.value)}
                      placeholder="金額"
                      className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
                    />
                    <button
                      onClick={handlePaypaySale}
                      disabled={!paypayAmount}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-4 py-2 rounded text-sm font-medium"
                    >
                      記録
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">今日の売上</h4>
            <p className="text-2xl font-bold text-pink-400">¥0</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">今月の売上</h4>
            <p className="text-2xl font-bold text-pink-400">¥0</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">出勤中</h4>
            <p className="text-2xl font-bold text-pink-400">0人</p>
          </div>
        </div>

        {/* Feature Cards - モバイル向けに最適化 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Transactions */}
          <Link
            to="/transactions"
            className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
          >
            <div className="text-pink-400 mb-2 flex justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white text-center group-hover:text-pink-400 transition-colors">
              売上管理
            </h3>
          </Link>

          {/* Attendance */}
          <Link
            to="/attendance"
            className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
          >
            <div className="text-pink-400 mb-2 flex justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C13.1 2 14 2.9 14 4C14 5.1 13.1 6 12 6C10.9 6 10 5.1 10 4C10 2.9 10.9 2 12 2ZM21 9V7L15 1H5C3.9 1 3 1.9 3 3V21C3 22.1 3.9 23 5 23H19C20.1 23 21 22.1 21 21V9M19 9H14V4H19V9Z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-white text-center group-hover:text-pink-400 transition-colors">
              勤怠管理
            </h3>
          </Link>

          {/* Admin (Owner Only) */}
          {isOwner && (
            <Link
              to="/admin"
              className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
            >
              <div className="text-pink-400 mb-2 flex justify-center">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5L8.5 12L12 4L15.5 12L21 5L19 16H5ZM12 18C13.1 18 14 18.9 14 20S13.1 22 12 22 10 21.1 10 20 10.9 18 12 18Z" />
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-white text-center group-hover:text-pink-400 transition-colors">
                管理者設定
              </h3>
            </Link>
          )}
        </div>

        {/* 出勤メンバー一覧 */}
        <div className="mt-6">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">出勤メンバー</h3>
            <div className="text-gray-300 text-sm text-center py-4">
              現在出勤中のメンバーはいません
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}