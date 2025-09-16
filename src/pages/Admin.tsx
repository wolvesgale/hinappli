import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { cleanupOldRegisterPhotos } from '../utils/photoCleanup'
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

interface RegisterSession {
  id: string
  biz_date: string
  status: string
  open_photo_url: string | null
  close_photo_url: string | null
  close_amount: number | null
  created_by: string
  created_at: string
}

export const Admin: React.FC = () => {
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([])
  const [userRoles, setUserRoles] = useState<UserRole[]>([])
  const [users, setUsers] = useState<UserRole[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [attendanceData, setAttendanceData] = useState<UserWithAttendance[]>([])
  const [registerSessions, setRegisterSessions] = useState<RegisterSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'sales' | 'payroll' | 'register'>('requests')
  const [dateRange, setDateRange] = useState<'week' | 'month'>('month')
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // Payroll specific states
  const [selectedUser, setSelectedUser] = useState<string>('all')
  const [payrollDateRange, setPayrollDateRange] = useState<'week' | 'month'>('week')
  const [payrollSelectedDate, setPayrollSelectedDate] = useState(new Date().toISOString().split('T')[0])
  
  // New user form state
  const [showAddUserModal, setShowAddUserModal] = useState(false)
  const [newUserForm, setNewUserForm] = useState({
    email: '',
    display_name: '',
    role: 'cast' as 'owner' | 'cast' | 'driver'
  })
  
  // Edit transaction state
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null)
  const [editTransactionForm, setEditTransactionForm] = useState({
    amount: 0,
    payment_method: 'cash' as 'cash' | 'paypay'
  })
  
  // Edit user role state
  const [editingUserRole, setEditingUserRole] = useState<string | null>(null)
  const [editUserRoleForm, setEditUserRoleForm] = useState({
    role: 'cast' as 'owner' | 'cast' | 'driver'
  })
  
  const { authUser, loading: authLoading, isOwner } = useAuthContext()

  // 認証とオーナー権限の確認
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-300">認証情報を確認中...</p>
        </div>
      </div>
    )
  }

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">アクセス権限がありません</h1>
          <p className="text-gray-300 mb-6">ログインが必要です。</p>
          <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
            ログインページへ
          </Link>
        </div>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-400 mb-4">アクセス権限がありません</h1>
          <p className="text-gray-300 mb-2">この機能はオーナーのみ利用可能です。</p>
          <p className="text-sm text-gray-400 mb-6">
            現在のロール: {authUser.role || '未設定'}
          </p>
          <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors">
            ホームに戻る
          </Link>
        </div>
      </div>
    )
  }

  useEffect(() => {
    fetchAccessRequests()
    fetchUserRoles()
    fetchTransactions()
    fetchAttendanceData()
    fetchRegisterSessions()
    
    // 写真クリーンアップを実行
    cleanupOldRegisterPhotos()
  }, [selectedDate, dateRange, payrollSelectedDate, payrollDateRange])

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
      console.error('Access requests fetch error:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchUserRoles = async () => {
    try {
      // Use admin client to bypass RLS for fetching all users
      const client = supabaseAdmin || supabase
      const { data, error } = await client
        .from('user_roles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setUserRoles(data || [])
      setUsers(data || [])
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
      // Use payroll-specific date range for attendance data
      const startDate = getPayrollDateRange()
      
      // First, get attendance records
      const { data: attendanceData, error: attendanceError } = await supabase
        .from('attendances')
        .select('*')
        .gte('start_time', startDate.start)
        .lte('start_time', startDate.end)
        .order('start_time', { ascending: false })
      
      if (attendanceError) throw attendanceError

      // Get all user roles
      const { data: userRoles, error: userRolesError } = await supabase
        .from('user_roles')
        .select('*')
      
      if (userRolesError) throw userRolesError

      // Get all auth users to map user_id to email
      const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
      
      if (authError) {
        console.warn('Could not fetch auth users, using simplified approach')
        setAttendanceData([])
        return
      }

      // Create user mapping
      const userMap = new Map<string, UserWithAttendance>()
      
      attendanceData?.forEach((record: any) => {
        // Find the auth user by user_id
        const authUser = authUsers.users.find(u => u.id === record.user_id)
        if (!authUser?.email) return
        
        // Find the user role by email
        const userRole = userRoles?.find(ur => ur.email === authUser.email)
        if (!userRole) return
        
        const userEmail = userRole.email
        if (!userMap.has(userEmail)) {
          userMap.set(userEmail, {
            email: userEmail,
            display_name: userRole.display_name,
            role: userRole.role,
            total_hours: 0,
            total_pay: 0,
            attendance_records: []
          })
        }
        
        const user = userMap.get(userEmail)!
        user.attendance_records.push(record)
        
        if (record.end_time) {
          const start = new Date(record.start_time)
          const end = new Date(record.end_time)
          const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
          user.total_hours += hours
          // Remove hourly wage calculation
          user.total_pay = 0
        }
      })
      
      setAttendanceData(Array.from(userMap.values()))
    } catch (err) {
      console.error('Attendance data fetch error:', err)
      setError(err instanceof Error ? err.message : '勤怠データの取得でエラーが発生しました')
    }
  }

  const fetchRegisterSessions = async () => {
    try {
      // 過去一週間のレジセッションを取得
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      const startDate = oneWeekAgo.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('register_sessions')
        .select('*')
        .gte('biz_date', startDate)
        .order('biz_date', { ascending: false })
      
      if (error) throw error
      setRegisterSessions(data || [])
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

  const getPayrollDateRange = () => {
    const selected = new Date(payrollSelectedDate)
    
    if (payrollDateRange === 'week') {
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

  // Remove hourly rate function - no longer needed
  // const getHourlyRate = (role: string) => {
  //   switch (role) {
  //     case 'cast': return 1500
  //     case 'driver': return 1200
  //     case 'owner': return 2000
  //     default: return 1000
  //   }
  // }

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

  const handleEditUserRole = async (email: string) => {
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: editUserRoleForm.role })
        .eq('email', email)
      
      if (error) throw error
      
      setEditingUserRole(null)
      fetchUserRoles()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const startEditUserRole = (user: UserRole) => {
    setEditingUserRole(user.email)
    setEditUserRoleForm({ role: user.role })
  }

  const cancelEditUserRole = () => {
    setEditingUserRole(null)
    setEditUserRoleForm({ role: 'cast' })
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // Add user to user_roles table first
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          email: newUserForm.email,
          display_name: newUserForm.display_name,
          role: newUserForm.role
        })
      
      if (roleError) throw roleError
      
      // Reset form and close modal
      setNewUserForm({
        email: '',
        display_name: '',
        role: 'cast'
      })
      setShowAddUserModal(false)
      
      fetchUserRoles()
      alert('ユーザーが正常に追加されました。ユーザーは通常の登録プロセスでアカウントを作成できます。')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ユーザー追加でエラーが発生しました')
    }
  }

  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction.id)
    setEditTransactionForm({
      amount: transaction.amount,
      payment_method: transaction.payment_method as 'cash' | 'paypay'
    })
  }

  const handleUpdateTransaction = async (transactionId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          amount: editTransactionForm.amount,
          payment_method: editTransactionForm.payment_method
        })
        .eq('id', transactionId)
      
      if (error) throw error
      
      setEditingTransaction(null)
      fetchTransactions()
    } catch (err) {
      setError(err instanceof Error ? err.message : '売上データの更新でエラーが発生しました')
    }
  }

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('この売上データを削除しますか？')) return
    
    try {
      console.log('Deleting transaction:', transactionId)
      
      // Use admin client to bypass RLS for delete operations
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }
      
      const { error } = await supabaseAdmin
        .from('transactions')
        .delete()
        .eq('id', transactionId)
      
      if (error) {
        console.error('Delete error:', error)
        throw error
      }
      
      console.log('Transaction deleted successfully')
      // Refresh the transactions list
      await fetchTransactions()
    } catch (err) {
      console.error('Delete transaction error:', err)
      setError(err instanceof Error ? err.message : '売上データの削除でエラーが発生しました')
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
    <div className="min-h-screen bg-gradient-to-br from-pink-400 via-purple-500 to-orange-400 relative overflow-hidden">
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
        <div className="flex flex-wrap gap-2 mb-6">
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'requests'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            アクセス申請
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'users'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            ユーザー管理
          </button>
          <button
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'sales'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            売上管理
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'payroll'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            給与計算
          </button>
          <button
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'register'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            レジ管理
          </button>
        </div>

        {/* Date Range Controls */}
        {(activeTab === 'sales' || activeTab === 'payroll') && (
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4 mb-6">
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
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
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
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">登録済みユーザー</h3>
                <button
                  onClick={() => setShowAddUserModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                >
                  ユーザー追加
                </button>
              </div>
              
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
                      className="flex justify-between items-center p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                    >
                      <div className="flex-1">
                        <div className="text-white font-semibold text-lg">
                          {user.display_name}
                        </div>
                        <div className="text-sm text-gray-400 mt-1">
                          {user.email}
                        </div>
                        <div className="flex items-center space-x-2 mt-2">
                          {editingUserRole === user.email ? (
                            <div className="flex items-center space-x-2">
                              <select
                                value={editUserRoleForm.role}
                                onChange={(e) => setEditUserRoleForm({ role: e.target.value as 'owner' | 'cast' | 'driver' })}
                                className="bg-gray-700 text-white px-2 py-1 rounded text-xs"
                              >
                                <option value="cast">キャスト</option>
                                <option value="driver">ドライバー</option>
                                <option value="owner">オーナー</option>
                              </select>
                              <button
                                onClick={() => handleEditUserRole(user.email)}
                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                              >
                                保存
                              </button>
                              <button
                                onClick={cancelEditUserRole}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          ) : (
                            <span className={`text-xs px-2 py-1 rounded ${getRoleBadgeColor(user.role)}`}>
                              {getRoleLabel(user.role)}
                            </span>
                          )}
                          <span className="text-xs text-gray-400">
                            登録日: {new Date(user.created_at).toLocaleDateString('ja-JP')}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {user.email !== authUser?.user.email && (
                          <>
                            {editingUserRole !== user.email && (
                              <button
                                onClick={() => startEditUserRole(user)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                              >
                                編集
                              </button>
                            )}
                            <button
                              onClick={() => handleRemoveUser(user.email)}
                              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              削除
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-xl font-bold text-white mb-4">新規ユーザー追加</h3>
              <form onSubmit={handleAddUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    メールアドレス
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserForm.email}
                    onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    表示名
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserForm.display_name}
                    onChange={(e) => setNewUserForm({...newUserForm, display_name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    権限
                  </label>
                  <select
                    value={newUserForm.role}
                    onChange={(e) => setNewUserForm({...newUserForm, role: e.target.value as 'owner' | 'cast' | 'driver'})}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="cast">キャスト</option>
                    <option value="driver">ドライバー</option>
                    <option value="owner">オーナー</option>
                  </select>
                </div>
                <div className="flex space-x-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors"
                  >
                    追加
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddUserModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            {/* Sales Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">総売上</h3>
                <p className="text-3xl font-bold text-green-400">
                  ¥{transactions.reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">現金売上</h3>
                <p className="text-3xl font-bold text-blue-400">
                  ¥{transactions.filter(t => t.payment_method === 'cash').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">PayPay売上</h3>
                <p className="text-3xl font-bold text-purple-400">
                  ¥{transactions.filter(t => t.payment_method === 'paypay').reduce((sum, t) => sum + t.amount, 0).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Sales Details */}
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
                        {editingTransaction === transaction.id ? (
                          // Edit mode
                          <div className="flex-1 flex items-center space-x-4">
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">金額</label>
                              <input
                                type="number"
                                value={editTransactionForm.amount}
                                onChange={(e) => setEditTransactionForm({
                                  ...editTransactionForm,
                                  amount: Number(e.target.value)
                                })}
                                className="w-24 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-400 mb-1">支払方法</label>
                              <select
                                value={editTransactionForm.payment_method}
                                onChange={(e) => setEditTransactionForm({
                                  ...editTransactionForm,
                                  payment_method: e.target.value as 'cash' | 'paypay'
                                })}
                                className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                              >
                                <option value="cash">現金</option>
                                <option value="paypay">PayPay</option>
                              </select>
                            </div>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleUpdateTransaction(transaction.id)}
                                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm transition-colors"
                              >
                                保存
                              </button>
                              <button
                                onClick={() => setEditingTransaction(null)}
                                className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-1 rounded text-sm transition-colors"
                              >
                                キャンセル
                              </button>
                            </div>
                          </div>
                        ) : (
                          // View mode
                          <>
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
                            <div className="flex items-center space-x-4">
                              <div className="text-sm text-gray-400">
                                {new Date(transaction.created_at).toLocaleString('ja-JP')}
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleEditTransaction(transaction)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  編集
                                </button>
                                <button
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                  className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                                >
                                  削除
                                </button>
                              </div>
                            </div>
                          </>
                        )}
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
            {/* User Selection and Date Range Controls */}
            <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
              <h3 className="text-xl font-bold text-white mb-4">給与計算設定</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    対象ユーザー
                  </label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">全ユーザー</option>
                    {users.map((user) => (
                      <option key={user.email} value={user.email}>
                        {user.display_name} ({getRoleLabel(user.role)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    期間
                  </label>
                  <select
                    value={payrollDateRange}
                    onChange={(e) => setPayrollDateRange(e.target.value as 'week' | 'month')}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="week">週次</option>
                    <option value="month">月次</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    基準日
                  </label>
                  <input
                    type="date"
                    value={payrollSelectedDate}
                    onChange={(e) => setPayrollSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Payroll Summary - 時給データ削除 */}
            <div className="grid grid-cols-1 gap-6">
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">総勤務時間（15分単位切り上げ）</h3>
                <p className="text-3xl font-bold text-blue-400">
                  {attendanceData
                    .filter(user => selectedUser === 'all' || user.email === selectedUser)
                    .reduce((sum, user) => sum + Math.ceil(user.total_hours * 4) / 4, 0).toFixed(1)}時間
                </p>
              </div>
            </div>

            {/* Individual Payroll - 時給データ削除 */}
            <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
              <div className="p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  個別勤務時間（15分単位切り上げ）
                  {selectedUser !== 'all' && (
                    <span className="text-sm text-gray-400 ml-2">
                      - {users.find(u => u.email === selectedUser)?.display_name}
                    </span>
                  )}
                </h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">読み込み中...</div>
                  </div>
                ) : attendanceData.filter(user => selectedUser === 'all' || user.email === selectedUser).length === 0 ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">該当期間の勤怠データはありません</div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {attendanceData
                      .filter(user => selectedUser === 'all' || user.email === selectedUser)
                      .map((user) => (
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
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-400">実働時間 → 切り上げ時間</div>
                            <div className="text-lg font-bold text-blue-400">
                              {user.total_hours.toFixed(1)}時間 → {Math.ceil(user.total_hours * 4) / 4}時間
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              期間: {payrollDateRange === 'week' ? '週次' : '月次'} ({payrollSelectedDate}基準)
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

        {/* Register Tab */}
        {activeTab === 'register' && (
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">レジ管理履歴（過去一週間）</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : registerSessions.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">レジセッションの履歴がありません</div>
                </div>
              ) : (
                <div className="space-y-6">
                  {registerSessions.map((session) => (
                    <div
                      key={session.id}
                      className="p-6 bg-gray-800/50 rounded-lg border border-gray-700"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <div className="text-lg font-semibold text-white">
                            {new Date(session.biz_date).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              weekday: 'short'
                            })}
                          </div>
                          <div className="text-sm text-gray-400 mt-1">
                            作成者: {session.created_by}
                          </div>
                          <div className="text-sm text-gray-400">
                            作成日時: {new Date(session.created_at).toLocaleString('ja-JP')}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            session.status === 'open' 
                              ? 'bg-green-600 text-white' 
                              : 'bg-red-600 text-white'
                          }`}>
                            {session.status === 'open' ? 'オープン中' : 'クローズ済み'}
                          </span>
                          {session.close_amount && (
                            <span className="text-lg font-bold text-green-400">
                              ¥{session.close_amount.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* オープン写真 */}
                        {session.open_photo_url && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-300">オープン時の写真</h4>
                            <div className="relative group">
                              <img
                                src={session.open_photo_url}
                                alt="レジオープン時の写真"
                                className="w-full h-48 object-cover rounded-lg border border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(session.open_photo_url!, '_blank')}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* クローズ写真 */}
                        {session.close_photo_url && (
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-gray-300">クローズ時の写真</h4>
                            <div className="relative group">
                              <img
                                src={session.close_photo_url}
                                alt="レジクローズ時の写真"
                                className="w-full h-48 object-cover rounded-lg border border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => window.open(session.close_photo_url!, '_blank')}
                              />
                              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-lg transition-colors flex items-center justify-center">
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* 写真がない場合の表示 */}
                      {!session.open_photo_url && !session.close_photo_url && (
                        <div className="text-center py-8 text-gray-400">
                          写真が登録されていません
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {error && (
        <div className="fixed top-4 right-4 z-50 p-4 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 max-w-md">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-red-300 mb-1">エラーが発生しました</h4>
              <p className="text-sm text-red-200">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}