import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { AccessRequest, UserRole } from '../types/database'

interface Transaction {
  id: string
  amount: number
  payment_method: string
  created_at: string
}

interface AttendanceRecord {
  id: string
  user_id: string
  start_time: string
  end_time: string | null
  created_at: string
}

interface UserWithAttendance {
  email: string
  display_name: string
  role: string
  total_hours: number
  total_pay: number
  attendance_records: AttendanceRecord[]
}

export const Admin: React.FC = () => {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [attendanceData, setAttendanceData] = useState<UserWithAttendance[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'sales' | 'payroll'>('requests')
  const [dateRange, setDateRange] = useState<'week' | 'month'>('month')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  const { authUser } = useAuthContext()

  useEffect(() => {
    fetchAccessRequests()
    fetchUserRoles()
    fetchTransactions()
    fetchAttendanceData()
  }, [selectedDate, dateRange])

  const fetchAccessRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('access_requests')
        .select('*')
        .eq('status', 'pending')
        .order('requested_at', { ascending: false })
      
      if (error) throw error
      setAccessRequests(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchUserRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUserRoles(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const fetchTransactions = async () => {
    try {
      const startDate = getDateRange()
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', startDate.start)
        .lte('created_at', startDate.end)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setTransactions(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchAttendanceData = async () => {
    try {
      const startDate = getDateRange()
      
      // ユーザーロールと勤怠データを取得
      const { data: users, error: usersError } = await supabase
        .from('user_roles')
        .select('*')
      
      if (usersError) throw usersError

      const { data: attendances, error: attendanceError } = await supabase
        .from('attendances')
        .select('*')
        .gte('start_time', startDate.start)
        .lte('start_time', startDate.end)
        .not('end_time', 'is', null)
      
      if (attendanceError) throw attendanceError

      // ユーザーごとの勤怠データを計算
      const userAttendanceData: UserWithAttendance[] = users.map(user => {
        const userAttendances = attendances.filter(att => att.user_id === user.email)
        const totalHours = calculateTotalHours(userAttendances)
        const hourlyRate = getHourlyRate(user.role)
        const totalPay = Math.ceil(totalHours * 4) / 4 * hourlyRate // 15分単位で切り上げ

        return {
          email: user.email,
          display_name: user.display_name,
          role: user.role,
          total_hours: totalHours,
          total_pay: totalPay,
          attendance_records: userAttendances
        }
      })

      setAttendanceData(userAttendanceData)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const getDateRange = () => {
    const selected = new Date(selectedDate)
    
    if (dateRange === 'week') {
      const startOfWeek = new Date(selected)
      startOfWeek.setDate(selected.getDate() - selected.getDay())
      const endOfWeek = new Date(startOfWeek)
      endOfWeek.setDate(startOfWeek.getDate() + 6)
      
      return {
        start: startOfWeek.toISOString().split('T')[0] + 'T00:00:00',
        end: endOfWeek.toISOString().split('T')[0] + 'T23:59:59'
      }
    } else {
      const startOfMonth = new Date(selected.getFullYear(), selected.getMonth(), 1)
      const endOfMonth = new Date(selected.getFullYear(), selected.getMonth() + 1, 0)
      
      return {
        start: startOfMonth.toISOString().split('T')[0] + 'T00:00:00',
        end: endOfMonth.toISOString().split('T')[0] + 'T23:59:59'
      }
    }
  }

  const calculateTotalHours = (attendances: AttendanceRecord[]) => {
    return attendances.reduce((total, attendance) => {
      if (!attendance.end_time) return total
      
      const start = new Date(attendance.start_time)
      const end = new Date(attendance.end_time)
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
      
      return total + hours
    }, 0)
  }

  const getHourlyRate = (role: string) => {
    switch (role) {
      case 'cast': return 1500
      case 'driver': return 1200
      case 'owner': return 2000
      default: return 1000
    }
  }

  const handleApproveRequest = async (requestId: string, email: string, displayName: string, role: string) => {
    if (!authUser) return

    try {
      // Add user to user_roles table
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          email,
          display_name: displayName,
          role: role as 'owner' | 'cast' | 'driver'
        })
      
      if (roleError) throw roleError

      // Update access request status
      const { error: requestError } = await supabase
        .from('access_requests')
        .update({
          status: 'approved',
          approved_by: authUser.user.email!,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (requestError) throw requestError

      fetchAccessRequests()
      fetchUserRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!authUser) return

    try {
      const { error } = await supabase
        .from('access_requests')
        .update({
          status: 'rejected',
          approved_by: authUser.user.email!,
          approved_at: new Date().toISOString()
        })
        .eq('id', requestId)
      
      if (error) throw error
      fetchAccessRequests()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleRemoveUser = async (email: string) => {
    if (!confirm('このユーザーを削除しますか？')) return

    try {
      const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('email', email)
      
      if (error) throw error
      fetchUserRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-600'
      case 'cast': return 'bg-blue-600'
      case 'driver': return 'bg-green-600'
      default: return 'bg-gray-600'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'owner': return 'オーナー'
      case 'cast': return 'キャスト'
      case 'driver': return 'ドライバー'
      default: return role
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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-gray-300 hover:text-white">
                ← ホーム
              </Link>
              <h1 className="text-2xl font-bold text-white">管理者設定</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm bg-red-600 px-2 py-1 rounded">
                オーナー専用
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'requests'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            アクセス申請 ({accessRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            ユーザー管理 ({userRoles.length})
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'sales'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            売上推移
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-md font-medium transition-colors whitespace-nowrap ${
              activeTab === 'payroll'
                ? 'bg-pink-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            給与計算
          </button>
        </div>

        {/* Date Range Controls */}
        {(activeTab === 'sales' || activeTab === 'payroll') && (
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-4 mb-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex space-x-2">
                <button
                  onClick={() => setDateRange('week')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    dateRange === 'week'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  週間
                </button>
                <button
                  onClick={() => setDateRange('month')}
                  className={`px-3 py-1 rounded text-sm transition-colors ${
                    dateRange === 'month'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  月間
                </button>
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>
        )}

        {/* Access Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">承認待ちのアクセス申請</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : accessRequests.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">承認待ちの申請はありません</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {accessRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          {request.display_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {request.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(request.requested_role)}`}>
                            {getRoleLabel(request.requested_role)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {new Date(request.requested_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApproveRequest(
                            request.id,
                            request.email,
                            request.display_name,
                            request.requested_role
                          )}
                          className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          承認
                        </button>
                        <button
                          onClick={() => handleRejectRequest(request.id)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          拒否
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">登録済みユーザー</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : userRoles.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">登録済みユーザーはいません</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {userRoles.map((user) => (
                    <div
                      key={user.email}
                      className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg"
                    >
                      <div>
                        <div className="text-white font-semibold">
                          {user.display_name}
                        </div>
                        <div className="text-sm text-gray-400">
                          {user.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                            {getRoleLabel(user.role)}
                          </span>
                          <span className="text-xs text-gray-400">
                            登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      {user.email !== authUser?.user.email && (
                        <button
                          onClick={() => handleRemoveUser(user.email)}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                        >
                          削除
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">総売上</h3>
                <p className="text-3xl font-bold text-green-400">
                  ¥{transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">現金売上</h3>
                <p className="text-3xl font-bold text-blue-400">
                  ¥{transactions.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">PayPay売上</h3>
                <p className="text-3xl font-bold text-purple-400">
                  ¥{transactions.filter(t => t.payment_method === 'paypay').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Sales Details */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
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
                        <div className="flex space-x-6">
                          <div>
                            <div className="text-sm text-gray-400">金額</div>
                            <div className="text-white font-semibold">
                              ¥{transaction.amount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-400">支払方法</div>
                            <div className="text-white font-semibold">
                              {transaction.payment_method === 'cash' ? '現金' : 'PayPay'}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400">
                          {new Date(transaction.created_at).toLocaleString('ja-JP')}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Payroll Tab */}
        {activeTab === 'payroll' && (
          <div className="space-y-6">
            {/* Payroll Summary */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">総給与支払額</h3>
                <p className="text-3xl font-bold text-green-400">
                  ¥{attendanceData.reduce((sum, user) => sum + user.total_pay, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">総勤務時間</h3>
                <p className="text-3xl font-bold text-blue-400">
                  {attendanceData.reduce((sum, user) => sum + user.total_hours, 0).toFixed(1)}時間
                </p>
              </div>
            </div>

            {/* Individual Payroll */}
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-lg">
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">個別給与計算（15分単位切り上げ）</h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">読み込み中...</div>
                  </div>
                ) : attendanceData.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">該当期間の勤怠データはありません</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceData.map((user) => (
                      <div
                        key={user.email}
                        className="p-4 bg-gray-800/50 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="text-white font-semibold">
                              {user.display_name}
                            </div>
                            <div className="text-sm text-gray-400">
                              {user.email}
                            </div>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                                {getRoleLabel(user.role)}
                              </span>
                              <span className="text-xs text-gray-400">
                                時給: ¥{getHourlyRate(user.role).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-green-400">
                              ¥{user.total_pay.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-400">
                              {user.total_hours.toFixed(1)}時間 → {Math.ceil(user.total_hours * 4) / 4}時間
                            </div>
                          </div>
                        </div>
                        
                        {/* Attendance Details */}
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-sm text-gray-400 mb-2">勤怠詳細:</div>
                          <div className="space-y-1">
                            {user.attendance_records.map((record) => (
                              <div key={record.id} className="flex justify-between text-xs text-gray-300">
                                <span>
                                  {new Date(record.start_time).toLocaleDateString('ja-JP')}
                                </span>
                                <span>
                                  {new Date(record.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - 
                                  {record.end_time ? new Date(record.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '勤務中'}
                                </span>
                                <span>
                                  {record.end_time ? 
                                    `${((new Date(record.end_time).getTime() - new Date(record.start_time).getTime()) / (1000 * 60 * 60)).toFixed(1)}h` 
                                    : '勤務中'
                                  }
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 bg-red-900 text-red-300 rounded-lg">
            {error}
          </div>
        )}
      </main>
    </div>
  )
}