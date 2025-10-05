import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase, supabaseAdmin } from '../lib/supabase'
import { cleanupOldRegisterPhotos } from '../utils/photoCleanup'
import { calculateAttendanceHours, calculateTotalAttendanceHours } from '../utils/timeUtils'
import type { AccessRequest, UserRole } from '../types/database'

interface Transaction {
  id: string
  amount: number
  payment_method: string
  created_at: string
  attributed_to_email?: string | null
}

interface AttendanceRecord {
  id: string
  user_id: string
  user_email?: string // 新しく追加されたフィールド（オプショナー）
  start_time: string
  end_time: string | null
  companion_checked?: boolean // 同伴出勤フラグ
  photo_url?: string // 出勤時写真URL
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
  const [monthlyTransactions, setMonthlyTransactions] = useState<Transaction[]>([])
  const [attendanceData, setAttendanceData] = useState<UserWithAttendance[]>([])
  const [registerSessions, setRegisterSessions] = useState<RegisterSession[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState<'requests' | 'users' | 'sales' | 'payroll' | 'register' | 'photos'>('requests')
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
  
  // Edit attendance state
  const [editingAttendance, setEditingAttendance] = useState<string | null>(null)
  const [editAttendanceForm, setEditAttendanceForm] = useState({
    start_time: '',
    end_time: '',
    companion_checked: false
  })

  // Edit register session state
  const [editingRegisterSession, setEditingRegisterSession] = useState<string | null>(null)
  const [editRegisterSessionForm, setEditRegisterSessionForm] = useState({
    biz_date: '',
    close_amount: 0
  })

  // Password change state
  const [showPasswordChange, setShowPasswordChange] = useState(false)
  const [passwordChangeForm, setPasswordChangeForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false)

  // Sales data state
  const [todaySales, setTodaySales] = useState(0)
  const [monthlySales, setMonthlySales] = useState(0)

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
    fetchSalesData()
    
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

      // 月間取引データも取得（個別売上カード用）
      const today = new Date()
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString()
      
      const { data: monthlyData, error: monthlyError } = await supabase
        .from('transactions')
        .select('*')
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
        .order('created_at', { ascending: false })
      
      if (monthlyError) throw monthlyError
      setMonthlyTransactions(monthlyData || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const fetchSalesData = async () => {
    try {
      const today = new Date()
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
      
      // 今日の売上を取得
      const { data: todayData, error: todayError } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', todayStart)
        .lt('created_at', todayEnd)
      
      if (todayError) throw todayError
      
      const todayTotal = todayData?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
      setTodaySales(todayTotal)
      
      // 今月の売上を取得
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString()
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1).toISOString()
      
      const { data: monthData, error: monthError } = await supabase
        .from('transactions')
        .select('amount')
        .gte('created_at', monthStart)
        .lt('created_at', monthEnd)
      
      if (monthError) throw monthError
      
      const monthlyTotal = monthData?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0
      setMonthlySales(monthlyTotal)
      
    } catch (err) {
      console.error('売上データ取得エラー:', err)
    }
  }

  const fetchAttendanceData = async () => {
    try {
      console.log('Fetching attendance data for payroll with email-based approach...')
      
      // Use payroll-specific date range for attendance data
      const startDate = getPayrollDateRange()
      console.log('Date range:', startDate)
      
      // Use admin client to bypass RLS for attendance data
      const client = supabaseAdmin || supabase
      
      // Get attendance records with user_email
      const { data: attendanceData, error: attendanceError } = await client
        .from('attendances')
        .select('*, user_email, companion_checked')
        .gte('start_time', startDate.start)
        .lte('start_time', startDate.end)
        .order('start_time', { ascending: false })
      
      if (attendanceError) throw attendanceError
      console.log('Attendance records found:', attendanceData?.length || 0)

      // Filter out records without user_email (old records)
      const validAttendanceData = attendanceData?.filter(record => record.user_email) || []
      console.log('Valid attendance records with user_email:', validAttendanceData.length)

      // Get unique emails from attendance data
      const uniqueEmails = [...new Set(validAttendanceData.map(record => record.user_email))]
      console.log('Unique emails in attendance:', uniqueEmails.length)

      // Get user roles for the emails found in attendance using admin client
      const { data: userRoles, error: userRolesError } = await client
        .from('user_roles')
        .select('*')
        .in('email', uniqueEmails)
      
      if (userRolesError) throw userRolesError
      console.log('User roles found:', userRoles?.length || 0)

      // Create user mapping based on email
      const userMap = new Map<string, UserWithAttendance>()
      
      // Initialize user map with user_roles data
      userRoles?.forEach((userRole) => {
        userMap.set(userRole.email, {
          email: userRole.email,
          display_name: userRole.display_name,
          role: userRole.role,
          total_hours: 0,
          total_pay: 0,
          attendance_records: []
        })
      })

      // Process attendance records using email directly
      validAttendanceData.forEach((record: any) => {
        const user = userMap.get(record.user_email)
        
        if (user) {
          user.attendance_records.push(record)
          
          if (record.end_time) {
            // 15分単位計算を使用
            const hours = calculateAttendanceHours(record.start_time, record.end_time, user.role)
            
            user.total_hours += hours
            // Set total_pay to 0 as requested
            user.total_pay = 0
          }
        } else {
          console.warn('No user role found for email:', record.user_email)
        }
      })

      // Convert map to array and filter out users with no attendance
      const resultData = Array.from(userMap.values()).filter(user => user.attendance_records.length > 0)
      
      console.log('Final attendance data:', resultData.length, 'users with attendance')
      setAttendanceData(resultData)
      
    } catch (err) {
      console.error('Error fetching attendance data:', err)
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
      setAttendanceData([])
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

  const calculateTotalHours = (attendances: AttendanceRecord[], userRole?: string) => {
    return calculateTotalAttendanceHours(attendances, userRole)
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
      // Use admin client to bypass RLS for role updates
      const client = supabaseAdmin || supabase
      const { error } = await client
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
      console.log('Updating transaction:', transactionId, editTransactionForm)
      
      // Use admin client to bypass RLS for update operations
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }
      
      const { error } = await supabaseAdmin
        .from('transactions')
        .update({
          amount: editTransactionForm.amount,
          payment_method: editTransactionForm.payment_method
        })
        .eq('id', transactionId)
      
      if (error) {
        console.error('Update error:', error)
        throw error
      }
      
      console.log('Transaction updated successfully')
      setEditingTransaction(null)
      await fetchTransactions()
    } catch (err) {
      console.error('Update transaction error:', err)
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

  // 日本時間（JST）でのdatetime-local形式に変換する関数
  const toJSTDateTimeLocal = (dateString: string): string => {
    const date = new Date(dateString)
    // JavaScriptのDateオブジェクトは自動的にローカルタイムゾーンで処理されるため
    // 追加のタイムゾーン変換は不要
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    
    return `${year}-${month}-${day}T${hours}:${minutes}`
  }

  // Attendance management functions
  const handleEditAttendance = (record: AttendanceRecord) => {
    setEditingAttendance(record.id)
    setEditAttendanceForm({
      start_time: toJSTDateTimeLocal(record.start_time),
      end_time: record.end_time ? toJSTDateTimeLocal(record.end_time) : '',
      companion_checked: record.companion_checked || false
    })
  }

  const handleUpdateAttendance = async (attendanceId: string) => {
    try {
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }

      // datetime-localの値をそのままUTCとして扱う（ユーザーが入力した時間をそのまま保存）
      const startTimeUTC = new Date(editAttendanceForm.start_time).toISOString()

      const updateData: any = {
        start_time: startTimeUTC,
        companion_checked: editAttendanceForm.companion_checked
      }

      if (editAttendanceForm.end_time) {
        const endTimeUTC = new Date(editAttendanceForm.end_time).toISOString()
        updateData.end_time = endTimeUTC
      }

      const { error } = await supabaseAdmin
        .from('attendances')
        .update(updateData)
        .eq('id', attendanceId)
      
      if (error) throw error
      
      setEditingAttendance(null)
      fetchAttendanceData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '勤怠データの更新でエラーが発生しました')
    }
  }

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!confirm('この勤怠記録を削除しますか？この操作は取り消せません。')) return
    
    try {
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }
      
      const { error } = await supabaseAdmin
        .from('attendances')
        .delete()
        .eq('id', attendanceId)
      
      if (error) throw error
      
      fetchAttendanceData()
    } catch (err) {
      setError(err instanceof Error ? err.message : '勤怠データの削除でエラーが発生しました')
    }
  }

  const handleEditRegisterSession = (session: RegisterSession) => {
    setEditingRegisterSession(session.id)
    setEditRegisterSessionForm({
      biz_date: session.biz_date,
      close_amount: session.close_amount || 0
    })
  }

  const handleUpdateRegisterSession = async (sessionId: string) => {
    try {
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }

      const { error } = await supabaseAdmin
        .from('register_sessions')
        .update({
          biz_date: editRegisterSessionForm.biz_date,
          close_amount: editRegisterSessionForm.close_amount
        })
        .eq('id', sessionId)
      
      if (error) throw error
      
      setEditingRegisterSession(null)
      fetchRegisterSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レジセッションの更新でエラーが発生しました')
    }
  }

  const handleDeleteRegisterSession = async (sessionId: string) => {
    if (!confirm('このレジセッションを削除しますか？この操作は取り消せません。')) return
    
    try {
      if (!supabaseAdmin) {
        throw new Error('管理者権限が必要です')
      }
      
      const { error } = await supabaseAdmin
        .from('register_sessions')
        .delete()
        .eq('id', sessionId)
      
      if (error) throw error
      
      fetchRegisterSessions()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'レジセッションの削除でエラーが発生しました')
    }
  }

  // Password change functions
  const handlePasswordChange = async () => {
    if (passwordChangeForm.newPassword !== passwordChangeForm.confirmPassword) {
      setError('新しいパスワードと確認用パスワードが一致しません')
      return
    }

    if (passwordChangeForm.newPassword.length < 6) {
      setError('パスワードは6文字以上で入力してください')
      return
    }

    setPasswordChangeLoading(true)
    try {
      // 現在のパスワードで再認証
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: authUser?.user.email || '',
        password: passwordChangeForm.currentPassword
      })

      if (signInError) {
        throw new Error('現在のパスワードが正しくありません')
      }

      // パスワードを更新
      const { error: updateError } = await supabase.auth.updateUser({
        password: passwordChangeForm.newPassword
      })

      if (updateError) throw updateError

      setShowPasswordChange(false)
      setPasswordChangeForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      })
      alert('パスワードが正常に変更されました')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'パスワード変更でエラーが発生しました')
    } finally {
      setPasswordChangeLoading(false)
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
              <button
                onClick={() => setShowPasswordChange(true)}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
              >
                パスワード変更
              </button>
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
          <button
            onClick={() => setActiveTab('photos')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'photos'
                ? 'bg-pink-600 text-white'
                : 'bg-black/30 text-gray-300 hover:bg-black/40 border border-white/20'
            }`}
          >
            出退勤写真
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">今日の売上</h3>
                <p className="text-3xl font-bold text-pink-400">
                  ¥{todaySales.toLocaleString()}
                </p>
              </div>
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-2">今月の売上</h3>
                <p className="text-3xl font-bold text-pink-400">
                  ¥{monthlySales.toLocaleString()}
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

            {/* Individual Cast Sales Cards */}
            <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-bold text-white mb-4">個別売上</h3>
                
                {loading ? (
                  <div className="text-center py-8">
                    <div className="text-gray-300">読み込み中...</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
                    {/* 共通売上カード */}
                    <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4">
                      <div className="flex items-center justify-between mb-2 sm:mb-3">
                        <h4 className="text-sm sm:text-lg font-semibold text-white">共通売上</h4>
                        <span className="text-lg sm:text-2xl">🏪</span>
                      </div>
                      <div className="space-y-1 sm:space-y-2">
                        <div className="text-xs sm:text-sm text-gray-400 mb-1">本日売上</div>
                        <div className="text-lg sm:text-xl font-bold text-green-400">
                          ¥{transactions
                            .filter(t => !t.attributed_to_email)
                            .reduce((sum, t) => sum + t.amount, 0)
                            .toLocaleString()}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-400 mb-1">月間累計</div>
                        <div className="text-base sm:text-lg font-bold text-green-300">
                          ¥{monthlyTransactions
                            .filter(t => !t.attributed_to_email)
                            .reduce((sum, t) => sum + t.amount, 0)
                            .toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* オーナーとキャストの売上カード */}
                    {users
                      .filter(user => user.role === 'owner' || user.role === 'cast')
                      .sort((a, b) => {
                        // オーナーを最初に表示
                        if (a.role === 'owner' && b.role !== 'owner') return -1
                        if (a.role !== 'owner' && b.role === 'owner') return 1
                        return a.display_name.localeCompare(b.display_name)
                      })
                      .map(user => {
                        const todayTransactions = transactions.filter(t => t.attributed_to_email === user.email)
                        const monthlyUserTransactions = monthlyTransactions.filter(t => t.attributed_to_email === user.email)
                        const todayAmount = todayTransactions.reduce((sum, t) => sum + t.amount, 0)
                        const monthlyAmount = monthlyUserTransactions.reduce((sum, t) => sum + t.amount, 0)
                        
                        return (
                          <div key={user.email} className="bg-gray-800/50 rounded-lg p-3 sm:p-4">
                            <div className="flex items-center justify-between mb-2 sm:mb-3">
                              <h4 className="text-sm sm:text-lg font-semibold text-white truncate pr-2">{user.display_name}</h4>
                              <span className="text-lg sm:text-2xl">{user.role === 'owner' ? '👑' : '👤'}</span>
                            </div>
                            <div className="space-y-1 sm:space-y-2">
                              <div className="text-xs sm:text-sm text-gray-400 mb-1">本日売上</div>
                              <div className="text-lg sm:text-xl font-bold text-pink-400">
                                ¥{todayAmount.toLocaleString()}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-400 mb-1">月間累計</div>
                              <div className="text-base sm:text-lg font-bold text-pink-300">
                                ¥{monthlyAmount.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                )}
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
                    .reduce((sum, user) => sum + user.total_hours, 0).toFixed(1)}時間
                </p>
              </div>
            </div>

            {/* Calendar View - 個別ユーザー選択時のみ表示 */}
            {selectedUser !== 'all' && (
              <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-4">
                  勤怠カレンダー
                  <span className="text-sm text-gray-400 ml-2">
                    - {users.find(u => u.email === selectedUser)?.display_name}
                  </span>
                </h3>
                
                {(() => {
                  const selectedUserData = attendanceData.find(user => user.email === selectedUser)
                  if (!selectedUserData || selectedUserData.attendance_records.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <div className="text-gray-300">該当期間の勤怠データはありません</div>
                      </div>
                    )
                  }

                  // 勤怠データを日付ごとにグループ化（日付跨ぎ対応）
                  const attendanceByDate = selectedUserData.attendance_records.reduce((acc, record) => {
                    // 出勤日を基準として日付を決定（夜勤対応）
                    const startDate = new Date(record.start_time)
                    const date = startDate.toLocaleDateString('ja-JP')
                    
                    if (!acc[date]) {
                      acc[date] = []
                    }
                    acc[date].push(record)
                    return acc
                  }, {} as Record<string, AttendanceRecord[]>)

                  // カレンダー表示用の日付範囲を計算
                  const startDate = new Date(payrollSelectedDate)
                  const endDate = new Date(startDate)
                  
                  if (payrollDateRange === 'week') {
                    // 週次の場合：選択日を含む週の日曜日から土曜日まで
                    const dayOfWeek = startDate.getDay() // 0=日曜日, 1=月曜日, ..., 6=土曜日
                    startDate.setDate(startDate.getDate() - dayOfWeek) // 週の始まり（日曜日）に設定
                    endDate.setDate(startDate.getDate() + 6) // 週の終わり（土曜日）に設定
                  } else {
                    // 月次の場合：選択月の全日
                    startDate.setDate(1)
                    endDate.setMonth(startDate.getMonth() + 1)
                    endDate.setDate(0)
                  }

                  const calendarDays = []
                  const currentDate = new Date(startDate)
                  
                  while (currentDate <= endDate) {
                    calendarDays.push(new Date(currentDate))
                    currentDate.setDate(currentDate.getDate() + 1)
                  }

                  return (
                    <div className="grid grid-cols-7 gap-2">
                      {/* 曜日ヘッダー */}
                      {['日', '月', '火', '水', '木', '金', '土'].map((day, index) => (
                        <div key={day} className={`text-center text-sm font-semibold py-2 ${
                          index === 0 ? 'text-red-400' : index === 6 ? 'text-blue-400' : 'text-gray-300'
                        }`}>
                          {day}
                        </div>
                      ))}
                      
                      {/* カレンダー日付 */}
                      {calendarDays.map((date, index) => {
                        const dateStr = date.toLocaleDateString('ja-JP')
                        const dayAttendances = attendanceByDate[dateStr] || []
                        const totalHours = dayAttendances.reduce((sum, record) => {
                          return sum + (record.end_time ? calculateAttendanceHours(record.start_time, record.end_time, selectedUserData.role) : 0)
                        }, 0)
                        const hasAttendance = dayAttendances.length > 0
                        const isToday = date.toDateString() === new Date().toDateString()
                        const dayOfWeek = date.getDay()

                        return (
                          <div
                            key={index}
                            className={`
                              relative min-h-[60px] p-2 rounded border text-center
                              ${hasAttendance 
                                ? 'bg-blue-600/30 border-blue-400/50' 
                                : 'bg-gray-800/30 border-gray-600/30'
                              }
                              ${isToday ? 'ring-2 ring-yellow-400' : ''}
                            `}
                          >
                            <div className={`text-sm font-semibold ${
                              dayOfWeek === 0 ? 'text-red-400' : 
                              dayOfWeek === 6 ? 'text-blue-400' : 
                              'text-white'
                            }`}>
                              {date.getDate()}
                            </div>
                            
                            {hasAttendance && (
                              <div className="mt-1">
                                <div className="text-xs text-blue-300 font-bold">
                                  {totalHours.toFixed(1)}h
                                </div>
                                {dayAttendances.some(record => record.companion_checked) && (
                                  <div className="text-xs text-pink-300 mt-1">
                                    同伴
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}

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
                            <div className="text-sm text-gray-400">15分単位切り上げ時間</div>
                            <div className="text-lg font-bold text-blue-400">
                              {user.total_hours.toFixed(1)}時間
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                              期間: {payrollDateRange === 'week' ? '週次' : '月次'} ({payrollSelectedDate}基準)
                            </div>
                            <div className="text-sm text-pink-400 mt-1">
                              同伴出勤: {user.attendance_records.filter(record => record.companion_checked).length}回
                            </div>
                          </div>
                        </div>
                        
                        {/* Attendance Details */}
                        <div className="mt-3 pt-3 border-t border-gray-700">
                          <div className="text-sm text-gray-400 mb-2">勤怠詳細:</div>
                          <div className="space-y-2">
                            {user.attendance_records.map((record) => (
                              <div key={record.id} className="bg-gray-700/50 rounded p-3">
                                {editingAttendance === record.id ? (
                                  // Edit mode
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">出勤時間</label>
                                        <input
                                          type="datetime-local"
                                          value={editAttendanceForm.start_time}
                                          onChange={(e) => setEditAttendanceForm({
                                            ...editAttendanceForm,
                                            start_time: e.target.value
                                          })}
                                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                      <div>
                                        <label className="block text-xs text-gray-400 mb-1">退勤時間</label>
                                        <input
                                          type="datetime-local"
                                          value={editAttendanceForm.end_time}
                                          onChange={(e) => setEditAttendanceForm({
                                            ...editAttendanceForm,
                                            end_time: e.target.value
                                          })}
                                          className="w-full px-2 py-1 bg-gray-600 border border-gray-500 rounded text-white text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                        />
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                      <label className="flex items-center space-x-2 text-xs text-gray-300">
                                        <input
                                          type="checkbox"
                                          checked={editAttendanceForm.companion_checked}
                                          onChange={(e) => setEditAttendanceForm({
                                            ...editAttendanceForm,
                                            companion_checked: e.target.checked
                                          })}
                                          className="w-4 h-4 text-pink-600 bg-gray-600 border-gray-500 rounded focus:ring-pink-500 focus:ring-2"
                                        />
                                        <span>同伴出勤</span>
                                      </label>
                                    </div>
                                    <div className="flex space-x-2">
                                      <button
                                        onClick={() => handleUpdateAttendance(record.id)}
                                        className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                      >
                                        保存
                                      </button>
                                      <button
                                        onClick={() => setEditingAttendance(null)}
                                        className="bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                      >
                                        キャンセル
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  // View mode
                                  <div className="flex justify-between items-center">
                                    <div className="flex space-x-4 text-xs text-gray-300">
                                      <span>
                                        {new Date(record.start_time).toLocaleDateString('ja-JP')}
                                      </span>
                                      <span>
                                        {new Date(record.start_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} - 
                                        {record.end_time ? new Date(record.end_time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' }) : '勤務中'}
                                      </span>
                                      <span>
                                        {record.end_time ? 
                                          `${calculateAttendanceHours(record.start_time, record.end_time, user.role).toFixed(1)}h (15分単位)` 
                                          : '勤務中'
                                        }
                                      </span>
                                      {record.companion_checked && (
                                        <span className="px-2 py-1 bg-pink-600 text-white rounded-full">
                                          同伴
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex space-x-1">
                                      <button
                                        onClick={() => handleEditAttendance(record)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                      >
                                        編集
                                      </button>
                                      <button
                                        onClick={() => handleDeleteAttendance(record.id)}
                                        className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  </div>
                                )}
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
                      {editingRegisterSession === session.id ? (
                        // Edit mode
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">営業日</label>
                              <input
                                type="date"
                                value={editRegisterSessionForm.biz_date}
                                onChange={(e) => setEditRegisterSessionForm({
                                  ...editRegisterSessionForm,
                                  biz_date: e.target.value
                                })}
                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                            <div>
                              <label className="block text-sm text-gray-400 mb-2">クローズ金額</label>
                              <input
                                type="number"
                                value={editRegisterSessionForm.close_amount}
                                onChange={(e) => setEditRegisterSessionForm({
                                  ...editRegisterSessionForm,
                                  close_amount: Number(e.target.value)
                                })}
                                className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleUpdateRegisterSession(session.id)}
                              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition-colors"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingRegisterSession(null)}
                              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition-colors"
                            >
                              キャンセル
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display mode
                        <>
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
                              <button
                                onClick={() => handleEditRegisterSession(session)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                              >
                                編集
                              </button>
                              <button
                                onClick={() => handleDeleteRegisterSession(session.id)}
                                className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm transition-colors"
                              >
                                削除
                              </button>
                            </div>
                          </div>
                        </>
                      )}

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

        {/* Photos Tab */}
        {activeTab === 'photos' && (
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
            <div className="p-6">
              <h3 className="text-xl font-bold text-white mb-4">出退勤写真確認（過去7日間）</h3>
              
              {loading ? (
                <div className="text-center py-8">
                  <div className="text-gray-300">読み込み中...</div>
                </div>
              ) : (
                <div className="space-y-6">
                   {/* 写真付き出勤記録の表示 */}
                   {attendanceData.length === 0 ? (
                     <div className="text-center py-8">
                       <div className="text-gray-300">写真付きの出勤記録がありません</div>
                     </div>
                   ) : (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                       {attendanceData
                         .flatMap(user => user.attendance_records)
                         .filter((record: AttendanceRecord) => record.photo_url) // 写真がある記録のみ表示
                         .map((record: AttendanceRecord) => (
                           <div
                             key={record.id}
                             className="bg-gray-800/50 rounded-lg border border-gray-700 overflow-hidden"
                           >
                             <div className="p-4">
                               <div className="flex items-center justify-between mb-3">
                                 <div className="text-sm text-gray-400">
                                   {record.user_email}
                                 </div>
                                 <div className="text-xs text-gray-500">
                                   {new Date(record.start_time).toLocaleDateString('ja-JP')}
                                 </div>
                               </div>
                               
                               <div className="text-sm text-white mb-3">
                                 出勤: {new Date(record.start_time).toLocaleTimeString('ja-JP', {
                                   hour: '2-digit',
                                   minute: '2-digit'
                                 })}
                                 {record.end_time && (
                                   <>
                                     <br />
                                     退勤: {new Date(record.end_time).toLocaleTimeString('ja-JP', {
                                       hour: '2-digit',
                                       minute: '2-digit'
                                     })}
                                   </>
                                 )}
                               </div>

                               {record.companion_checked && (
                                 <div className="text-xs text-pink-400 mb-3">
                                   🤝 同伴出勤
                                 </div>
                               )}
                               
                               {record.photo_url && (
                                 <div className="aspect-video bg-gray-700 rounded-lg overflow-hidden">
                                   <img
                                     src={record.photo_url}
                                     alt={`${record.user_email}の出勤写真`}
                                     className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                     onClick={() => window.open(record.photo_url, '_blank')}
                                   />
                                 </div>
                               )}
                             </div>
                           </div>
                         ))}
                     </div>
                   )}
                   
                   {/* 写真なしの記録がある場合の注意書き */}
                   {attendanceData.some(user => 
                     user.attendance_records.some((record: AttendanceRecord) => !record.photo_url)
                   ) && (
                    <div className="mt-6 p-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <h4 className="text-sm font-medium text-yellow-300 mb-1">注意</h4>
                          <p className="text-sm text-yellow-200">
                            写真が登録されていない出勤記録があります。写真機能は最近追加されたため、古い記録には写真がない場合があります。
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
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

      {/* Password Change Modal */}
      {showPasswordChange && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-white mb-4">パスワード変更</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  現在のパスワード
                </label>
                <input
                  type="password"
                  value={passwordChangeForm.currentPassword}
                  onChange={(e) => setPasswordChangeForm(prev => ({
                    ...prev,
                    currentPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pink-500"
                  placeholder="現在のパスワードを入力"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  新しいパスワード
                </label>
                <input
                  type="password"
                  value={passwordChangeForm.newPassword}
                  onChange={(e) => setPasswordChangeForm(prev => ({
                    ...prev,
                    newPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pink-500"
                  placeholder="新しいパスワードを入力（6文字以上）"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  新しいパスワード（確認）
                </label>
                <input
                  type="password"
                  value={passwordChangeForm.confirmPassword}
                  onChange={(e) => setPasswordChangeForm(prev => ({
                    ...prev,
                    confirmPassword: e.target.value
                  }))}
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pink-500"
                  placeholder="新しいパスワードを再入力"
                />
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowPasswordChange(false)
                  setPasswordChangeForm({
                    currentPassword: '',
                    newPassword: '',
                    confirmPassword: ''
                  })
                  setError('')
                }}
                className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                disabled={passwordChangeLoading}
              >
                キャンセル
              </button>
              <button
                onClick={handlePasswordChange}
                disabled={passwordChangeLoading || !passwordChangeForm.currentPassword || !passwordChangeForm.newPassword || !passwordChangeForm.confirmPassword}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordChangeLoading ? '変更中...' : '変更'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}