import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { RegisterManager } from '../components/RegisterManager'
import { supabase } from '../lib/supabase'

export const Home: React.FC = () => {
  const { authUser, signOut, isOwner } = useAuthContext()
  const [registerStatus, setRegisterStatus] = useState<'closed' | 'open'>('closed')
  const [cashAmount, setCashAmount] = useState('')
  const [paypayAmount, setPaypayAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attendingMembers, setAttendingMembers] = useState<Array<{
    email: string
    display_name: string
    role: string
    start_time: string
  }>>([])
  const [todaySales, setTodaySales] = useState(0)
  const [monthlySales, setMonthlySales] = useState(0)

  // レジセッションの状態を取得
  useEffect(() => {
    const fetchRegisterStatus = async () => {
      if (!authUser) return

      try {
        const today = new Date().toISOString().split('T')[0]
        const { data, error } = await supabase
          .from('register_sessions')
          .select('*')
          .eq('biz_date', today)
          .eq('status', 'open')
          .single()

        if (error && error.code !== 'PGRST116') {
          console.error('レジ状態取得エラー:', error)
          return
        }

        // オープン中のレジセッションが見つかった場合
        if (data) {
          setRegisterStatus('open')
        } else {
          setRegisterStatus('closed')
        }
      } catch (err) {
        console.error('レジ状態確認エラー:', err)
      }
    }

    const fetchAttendingMembers = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        
        // 今日出勤中のメンバーを取得（end_timeがnullのもの）
        const { data: attendances, error } = await supabase
          .from('attendances')
          .select('user_id, start_time')
          .gte('start_time', `${today}T00:00:00`)
          .lte('start_time', `${today}T23:59:59`)
          .is('end_time', null)
          .order('start_time', { ascending: false })

        if (error) throw error

        if (!attendances || attendances.length === 0) {
          setAttendingMembers([])
          return
        }

        // auth.usersから全ユーザーを取得
        const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
        
        if (authError) {
          console.warn('Could not fetch auth users:', authError)
          setAttendingMembers([])
          return
        }

        // user_rolesから全ユーザー情報を取得
        const { data: userRoles, error: roleError } = await supabase
          .from('user_roles')
          .select('email, display_name, role')

        if (roleError) {
          console.warn('Could not fetch user roles:', roleError)
          setAttendingMembers([])
          return
        }

        // 出勤中のメンバー情報を構築
        const members = []
        for (const attendance of attendances) {
          try {
            // auth.usersからuser_idに対応するemailを取得
            const authUser = authUsers.users.find(u => u.id === attendance.user_id)
            
            if (!authUser?.email) {
              console.warn(`Could not find email for user_id: ${attendance.user_id}`)
              continue
            }

            // user_rolesからdisplay_nameとroleを取得
            const userRole = userRoles?.find(ur => ur.email === authUser.email)

            if (!userRole) {
              console.warn(`Could not find user role for email: ${authUser.email}`)
              continue
            }

            members.push({
              email: authUser.email,
              display_name: userRole.display_name,
              role: userRole.role,
              start_time: attendance.start_time
            })
          } catch (err) {
            console.warn(`Error processing attendance for user_id: ${attendance.user_id}`, err)
          }
        }

        setAttendingMembers(members)
      } catch (err) {
        console.error('出勤メンバー取得エラー:', err)
        setAttendingMembers([])
      }
    }

    const fetchSalesData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0]
        const currentMonth = new Date().toISOString().slice(0, 7) // YYYY-MM format

        // 今日の売上を取得
        const { data: todayTransactions, error: todayError } = await supabase
          .from('transactions')
          .select('amount')
          .gte('created_at', `${today}T00:00:00`)
          .lt('created_at', `${today}T23:59:59`)

        if (todayError) throw todayError

        const todayTotal = todayTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
        setTodaySales(todayTotal)

        // 今月の売上を取得
        const currentDate = new Date()
        const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)
        const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0)
        
        const { data: monthlyTransactions, error: monthlyError } = await supabase
          .from('transactions')
          .select('amount')
          .gte('created_at', firstDayOfMonth.toISOString())
          .lte('created_at', lastDayOfMonth.toISOString())

        if (monthlyError) throw monthlyError

        const monthlyTotal = monthlyTransactions?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
        setMonthlySales(monthlyTotal)
      } catch (err) {
        console.error('売上データ取得エラー:', err)
      }
    }

    fetchRegisterStatus()
    fetchAttendingMembers()
    fetchSalesData()
    
    // 5分ごとに出勤メンバーと売上データを更新
    const interval = setInterval(() => {
      fetchAttendingMembers()
      fetchSalesData()
    }, 5 * 60 * 1000)
    
    return () => clearInterval(interval)
  }, [authUser])

  const handleSignOut = async () => {
    try {
      setLoading(true)
      await signOut()
      // Force navigation to login page
      window.location.href = '/login'
    } catch (error) {
      console.error('Sign out error:', error)
      setError('ログアウトに失敗しました')
    } finally {
      setLoading(false)
    }
  }

  const handleCashSale = async () => {
    if (!authUser) return
    
    if (registerStatus !== 'open') {
      alert('レジがオープンされていません。先にレジをオープンしてください。')
      return
    }
    
    if (cashAmount) {
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
        alert('売上記録に失敗しました。もう一度お試しください。')
      }
    }
  }

  const handlePaypaySale = async () => {
    if (!authUser) return
    
    if (registerStatus !== 'open') {
      alert('レジがオープンされていません。先にレジをオープンしてください。')
      return
    }
    
    if (paypayAmount) {
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
        alert('売上記録に失敗しました。もう一度お試しください。')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-orange-400 relative overflow-hidden">
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
                className="text-gray-300 hover:text-white transition-colors text-sm px-3 py-2 rounded-md active:bg-white/10 touch-manipulation"
                style={{ minHeight: '44px', minWidth: '44px' }}
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 max-w-md mx-auto px-4 py-6">
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
              
              <div className="space-y-4">
                {/* 現金 */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">現金</label>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                      type="number"
                      value={cashAmount}
                      onChange={(e) => setCashAmount(e.target.value)}
                      placeholder="金額"
                      className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm min-w-0"
                    />
                    <button
                      onClick={handleCashSale}
                      disabled={!cashAmount}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-6 py-2 rounded text-sm font-medium whitespace-nowrap"
                    >
                      記録
                    </button>
                  </div>
                </div>

                {/* PayPay */}
                <div className="space-y-2">
                  <label className="text-sm text-gray-300">PayPay</label>
                  <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                    <input
                      type="number"
                      value={paypayAmount}
                      onChange={(e) => setPaypayAmount(e.target.value)}
                      placeholder="金額"
                      className="flex-1 bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm min-w-0"
                    />
                    <button
                      onClick={handlePaypaySale}
                      disabled={!paypayAmount}
                      className="bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white px-6 py-2 rounded text-sm font-medium whitespace-nowrap"
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
            <p className="text-2xl font-bold text-pink-400">¥{todaySales.toLocaleString()}</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">今月の売上</h4>
            <p className="text-2xl font-bold text-pink-400">¥{monthlySales.toLocaleString()}</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 text-center">
            <h4 className="text-sm font-semibold text-white mb-1">出勤中</h4>
            <p className="text-2xl font-bold text-pink-400">{attendingMembers.length}人</p>
          </div>
        </div>

        {/* Feature Cards - モバイル向けに最適化 */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Transactions */}
          <Link
            to="/transactions"
            className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
          >
            <div className="text-4xl mb-2 flex justify-center">
              💰
            </div>
            <h3 className="text-xs font-medium text-white text-center group-hover:text-pink-400 transition-colors">
              売上管理
            </h3>
          </Link>

          {/* Attendance */}
          <Link
            to="/attendance"
            className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
          >
            <div className="text-4xl mb-2 flex justify-center">
              ⏰
            </div>
            <h3 className="text-xs font-medium text-white text-center group-hover:text-pink-400 transition-colors">
              勤怠管理
            </h3>
          </Link>

          {/* Admin (Owner Only) */}
          {isOwner && (
            <Link
              to="/admin"
              className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 hover:bg-black/40 transition-colors group"
            >
              <div className="text-4xl mb-2 flex justify-center">
                👑
              </div>
              <h3 className="text-xs font-medium text-white text-center group-hover:text-pink-400 transition-colors">
                管理者設定
              </h3>
            </Link>
          )}
        </div>

        {/* 出勤メンバー一覧 */}
        <div className="mt-6">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-white mb-3">出勤メンバー</h3>
            {attendingMembers.length === 0 ? (
              <div className="text-gray-300 text-sm text-center py-4">
                現在出勤中のメンバーはいません
              </div>
            ) : (
              <div className="space-y-4">
                {/* キャストメンバー */}
                {attendingMembers.filter(member => member.role === 'cast' || member.role === 'owner').length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-pink-400 mb-2 flex items-center">
                      <span className="w-2 h-2 bg-pink-400 rounded-full mr-2"></span>
                      キャスト
                    </h4>
                    <div className="space-y-2">
                      {attendingMembers
                        .filter(member => member.role === 'cast' || member.role === 'owner')
                        .map((member, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <div>
                            <div className="text-white font-medium">
                              {member.display_name || member.email}
                            </div>
                            <div className="text-gray-400 text-sm">
                              {member.email}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 text-sm font-medium">出勤中</div>
                            <div className="text-gray-400 text-xs">
                              {new Date(member.start_time).toLocaleTimeString('ja-JP', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}から
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ドライバーメンバー */}
                {attendingMembers.filter(member => member.role === 'driver').length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-blue-400 mb-2 flex items-center">
                      <span className="w-2 h-2 bg-blue-400 rounded-full mr-2"></span>
                      ドライバー
                    </h4>
                    <div className="space-y-2">
                      {attendingMembers
                        .filter(member => member.role === 'driver')
                        .map((member, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-gray-800/50 rounded-lg">
                          <div>
                            <div className="text-white font-medium">
                              {member.display_name || member.email}
                            </div>
                            <div className="text-gray-400 text-sm">
                              {member.email}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-green-400 text-sm font-medium">出勤中</div>
                            <div className="text-gray-400 text-xs">
                              {new Date(member.start_time).toLocaleTimeString('ja-JP', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}から
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}