import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Transaction, UserRole } from '../types/database'

const PAYMENT_METHOD_LABELS: Record<Transaction['payment_method'], string> = {
  cash: '現金',
  paypay_credit: 'PayPay / クレジット',
  tsuke: 'ツケ'
}

export const Transactions: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTransaction, setNewTransaction] = useState({
    amount: '',
    paymentMethod: 'cash' as Transaction['payment_method'],
    memo: '',
    attributedToEmail: '' // Single selection instead of array
  })
  const [error, setError] = useState('')
  const [registerStatus, setRegisterStatus] = useState<'open' | 'closed'>('closed')
  const [castMembers, setCastMembers] = useState<UserRole[]>([])
  
  const { authUser } = useAuthContext()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    fetchTransactions()
    fetchRegisterStatus()
    fetchCastMembers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fetchCastMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .eq('role', 'cast')
        .order('display_name', { ascending: true })
      
      if (error) throw error
      setCastMembers(data || [])
    } catch (err) {
      console.error('Failed to fetch cast members:', err)
    }
  }

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

  const getCastDisplayName = (email: string | null) => {
    if (!email) return null
    const cast = castMembers.find(c => c.email === email)
    return cast?.display_name || email
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
          attributed_to_email: newTransaction.attributedToEmail || null,
          created_by: authUser.user.email!
        })
      
      if (error) throw error
      
      setNewTransaction({ amount: '', paymentMethod: 'cash', memo: '', attributedToEmail: '' })
      setShowAddForm(false)
      setError('')
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleAttributionChange = (email: string) => {
    setNewTransaction({
      ...newTransaction,
      attributedToEmail: email
    })
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

        {/* Transactions List */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">売上詳細</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-300">読み込み中...</div>
              </div>
            ) : transactions.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-300">該当期間の売上データはありません</div>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div
                    key={transaction.id}
                    className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="text-white font-semibold">
                        ¥{transaction.amount.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-400">
                        {PAYMENT_METHOD_LABELS[transaction.payment_method]} • {new Date(transaction.created_at).toLocaleTimeString('ja-JP')}
                      </div>
                      {transaction.memo && (
                        <div className="text-sm text-gray-300 mt-1">
                          {transaction.memo}
                        </div>
                      )}
                      {transaction.attributed_to_email && (
                        <div className="text-sm text-pink-400 mt-1 flex items-center">
                          <span className="mr-1">👤</span>
                          帰属: {getCastDisplayName(transaction.attributed_to_email)}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-400 text-right">
                      <div>{transaction.created_by}</div>
                      {!transaction.attributed_to_email && (
                        <div className="text-xs text-gray-500 mt-1">共通売上</div>
                      )}
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