import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Transaction } from '../types/database'

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    paymentMethod: 'cash',
    memo: ''
  })
  const [error, setError] = useState('')
  const [registerStatus, setRegisterStatus] = useState<'open' | 'closed'>('closed')
  
  const { authUser } = useAuthContext()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchTransactions()
    fetchRegisterStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchRegisterStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('register_sessions')
        .select('status')
        .eq('biz_date', today)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      if (error && error.code !== 'PGRST116') throw error
      const status = data?.status as 'open' | 'closed'
      setRegisterStatus(status || 'closed')
    } catch (err) {
      console.error('Failed to fetch register status:', err)
      setRegisterStatus('closed')
    }
  }

  const fetchTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('biz_date', today)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleAddTransaction = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!authUser) return

    // Check if register is open
    if (registerStatus !== 'open') {
      setError('レジがオープンされていません。売上を入力するにはレジをオープンしてください。')
      return
    }

    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          biz_date: today,
          amount: parseFloat(newTransaction.amount),
          payment_method: newTransaction.paymentMethod,
          memo: newTransaction.memo || null,
          created_by: authUser.user.email!
        })
      
      if (error) throw error
      
      setNewTransaction({ amount: '', paymentMethod: 'cash', memo: '' })
      setShowAddForm(false)
      setError('')
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const totalAmount = transactions.reduce((sum, t) => sum + t.amount, 0)

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-orange-400 relative overflow-hidden">
      {/* Header */}
      <header className="relative z-10 bg-black/30 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-300 hover:text-white">
                ← ホーム
              </Link>
              <h1 className="text-2xl font-bold text-white">売上管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">{today}</span>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  registerStatus === 'open' 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}>
                  レジ{registerStatus === 'open' ? 'オープン' : 'クローズ'}
                </span>
                <button
                  onClick={() => setShowAddForm(true)}
                  disabled={registerStatus !== 'open'}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    registerStatus === 'open'
                      ? 'bg-pink-600 hover:bg-pink-700 text-white'
                      : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  }`}
                  title={registerStatus !== 'open' ? 'レジをオープンしてから売上を追加してください' : ''}
                >
                  売上追加
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今日の売上合計</h3>
            <p className="text-3xl font-bold text-pink-400">¥{totalAmount.toLocaleString()}</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">取引件数</h3>
            <p className="text-3xl font-bold text-pink-400">{transactions.length}件</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">平均単価</h3>
            <p className="text-3xl font-bold text-pink-400">
              ¥{transactions.length > 0 ? Math.round(totalAmount / transactions.length).toLocaleString() : 0}
            </p>
          </div>
        </div>

        {/* Add Transaction Form */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
              <h3 className="text-xl font-bold text-white mb-4">売上追加</h3>
              <form onSubmit={handleAddTransaction} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    金額
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="1"
                    value={newTransaction.amount}
                    onChange={(e) => setNewTransaction({...newTransaction, amount: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="1000"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    支払い方法
                  </label>
                  <select
                    value={newTransaction.paymentMethod}
                    onChange={(e) => setNewTransaction({...newTransaction, paymentMethod: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="cash">現金</option>
                    <option value="card">カード</option>
                    <option value="electronic">電子マネー</option>
                    <option value="other">その他</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    メモ（任意）
                  </label>
                  <input
                    type="text"
                    value={newTransaction.memo}
                    onChange={(e) => setNewTransaction({...newTransaction, memo: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="備考"
                  />
                </div>
                <div className="flex space-x-3">
                  <button
                    type="submit"
                    className="flex-1 bg-pink-600 hover:bg-pink-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-md transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Transactions List */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">取引履歴</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-300">読み込み中...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-300">今日の取引はまだありません</div>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                  >
                    <div>
                      <div className="text-white font-semibold">
                        ¥{transaction.amount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        {transaction.payment_method} • {new Date(transaction.created_at).toLocaleTimeString('ja-JP')}
                      </div>
                      {transaction.memo && (
                        <div className="text-sm text-gray-300 mt-1">
                          {transaction.memo}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400">
                      {transaction.created_by}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-900 text-red-300 rounded-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}