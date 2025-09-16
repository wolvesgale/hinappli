import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Attendance as AttendanceRecord } from '../types/database'

export const Attendance: React.FC = () => {
  const [attendances, setAttendances] = useState<AttendanceRecord[]>([])
  const [currentAttendance, setCurrentAttendance] = useState<AttendanceRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualTime, setManualTime] = useState('')
  const [manualDate, setManualDate] = useState('')
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editStartTime, setEditStartTime] = useState('')
  const [editEndTime, setEditEndTime] = useState('')
  const [editDate, setEditDate] = useState('')
  const { authUser, isOwner } = useAuthContext()
  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    if (authUser) {
      fetchAttendances()
      checkCurrentAttendance()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser])

  const fetchAttendances = async () => {
    if (!authUser || !authUser.user.email) return

    try {
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_email', authUser.user.email)
        .gte('start_time', `${today}T00:00:00`)
        .order('start_time', { ascending: false })
      
      if (error) throw error
      setAttendances(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const checkCurrentAttendance = async () => {
    if (!authUser || !authUser.user.email) return

    try {
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_email', authUser.user.email)
        .is('end_time', null)
        .single()
      
      if (error && error.code !== 'PGRST116') throw error
      setCurrentAttendance(data)
    } catch (err) {
      console.error('Error checking current attendance:', err)
    }
  }

  const handleClockIn = async () => {
    if (!authUser) return

    try {
      // 分数単位の現在時刻を取得
      const now = new Date()
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: authUser.user.id,
          user_email: authUser.user.email, // ★追加: user_emailも保存
          start_time: now.toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      // 新しい出勤記録を即座に状態に反映
      setCurrentAttendance(data)
      
      // データを再取得
      await fetchAttendances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleManualClockIn = async () => {
    if (!authUser || !manualDate || !manualTime) return

    try {
      const dateTime = new Date(`${manualDate}T${manualTime}:00`)
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: authUser.user.id,
          user_email: authUser.user.email, // ★追加: user_emailも保存
          start_time: dateTime.toISOString()
        })
        .select()
        .single()
      
      if (error) throw error
      
      // 新しい出勤記録を即座に状態に反映
      setCurrentAttendance(data)
      
      setShowManualInput(false)
      setManualTime('')
      setManualDate('')
      
      // データを再取得
      await fetchAttendances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleClockOut = async () => {
    if (!authUser || !currentAttendance) return

    try {
      // 分数単位の現在時刻を取得
      const now = new Date()
      const { error } = await supabase
        .from('attendances')
        .update({ end_time: now.toISOString() })
        .eq('id', currentAttendance.id)
      
      if (error) throw error
      
      // 退勤後は現在の出勤記録をクリア
      setCurrentAttendance(null)
      
      // データを再取得
      await fetchAttendances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleManualClockOut = async () => {
    if (!authUser || !currentAttendance || !manualDate || !manualTime) return

    try {
      const dateTime = new Date(`${manualDate}T${manualTime}:00`)
      const { error } = await supabase
        .from('attendances')
        .update({ end_time: dateTime.toISOString() })
        .eq('id', currentAttendance.id)
      
      if (error) throw error
      
      // 退勤後は現在の出勤記録をクリア
      setCurrentAttendance(null)
      
      setShowManualInput(false)
      setManualTime('')
      setManualDate('')
      
      // データを再取得
      await fetchAttendances()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('ja-JP', {
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const calculateWorkTime = (startTime: string, endTime: string | null) => {
    if (!endTime) return '勤務中'
    
    const start = new Date(startTime)
    const end = new Date(endTime)
    const diffMs = end.getTime() - start.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    return `${diffHours}時間${diffMinutes}分`
  }

  const handleEditAttendance = (attendance: AttendanceRecord) => {
    setEditingAttendance(attendance)
    const startDate = new Date(attendance.start_time)
    setEditDate(startDate.toISOString().split('T')[0])
    setEditStartTime(startDate.toTimeString().slice(0, 5))
    
    if (attendance.end_time) {
      const endDate = new Date(attendance.end_time)
      setEditEndTime(endDate.toTimeString().slice(0, 5))
    } else {
      setEditEndTime('')
    }
    
    setShowEditModal(true)
  }

  const handleUpdateAttendance = async () => {
    if (!authUser || !editingAttendance || !editDate || !editStartTime) return

    try {
      const startDateTime = new Date(`${editDate}T${editStartTime}:00`)
      const updateData: any = {
        start_time: startDateTime.toISOString()
      }

      if (editEndTime) {
        const endDateTime = new Date(`${editDate}T${editEndTime}:00`)
        updateData.end_time = endDateTime.toISOString()
      } else {
        updateData.end_time = null
      }

      const { error } = await supabase
        .from('attendances')
        .update(updateData)
        .eq('id', editingAttendance.id)
      
      if (error) throw error
      
      setShowEditModal(false)
      setEditingAttendance(null)
      setEditDate('')
      setEditStartTime('')
      setEditEndTime('')
      fetchAttendances()
      checkCurrentAttendance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleDeleteAttendance = async (attendanceId: string) => {
    if (!authUser || !confirm('この勤怠記録を削除しますか？')) return

    try {
      const { error } = await supabase
        .from('attendances')
        .delete()
        .eq('id', attendanceId)
      
      if (error) throw error
      
      // 削除された記録が現在の出勤記録だった場合、状態をクリア
      if (currentAttendance?.id === attendanceId) {
        setCurrentAttendance(null)
      }
      
      // データを再取得
      await fetchAttendances()
      await checkCurrentAttendance()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
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
              <h1 className="text-2xl font-bold text-white">勤怠管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-300">{today}</span>
              <span className="text-sm bg-pink-600 px-2 py-1 rounded">
                {authUser?.displayName || authUser?.user.email}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-4 py-8">
        {/* Clock In/Out Section */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6 md:p-8 mb-8">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold text-white mb-4">
              {new Date().toLocaleTimeString('ja-JP')}
            </div>
            
            {currentAttendance ? (
              <div className="space-y-4">
                <div className="text-green-400 text-lg">
                  出勤中 - {formatTime(currentAttendance.start_time)}から
                </div>
                <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={handleClockOut}
                    className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg text-lg md:text-xl transition-colors"
                  >
                    退勤
                  </button>
                  <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg text-lg md:text-xl transition-colors"
                  >
                    時刻指定退勤
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-gray-400 text-lg">
                  未出勤
                </div>
                <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={handleClockIn}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg text-lg md:text-xl transition-colors"
                  >
                    出勤
                  </button>
                  <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg text-lg md:text-xl transition-colors"
                  >
                    時刻指定出勤
                  </button>
                </div>
              </div>
            )}

            {/* Manual Time Input */}
            {showManualInput && (
              <div className="mt-6 p-6 bg-gray-800/50 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-4">時刻を指定</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      日付
                    </label>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={(e) => setManualDate(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      時刻（分単位まで）
                    </label>
                    <input
                      type="time"
                      value={manualTime}
                      onChange={(e) => setManualTime(e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                  <div className="flex space-x-4">
                    {currentAttendance ? (
                      <button
                        onClick={handleManualClockOut}
                        disabled={!manualDate || !manualTime}
                        className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                      >
                        指定時刻で退勤
                      </button>
                    ) : (
                      <button
                        onClick={handleManualClockIn}
                        disabled={!manualDate || !manualTime}
                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                      >
                        指定時刻で出勤
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowManualInput(false)
                        setManualTime('')
                        setManualDate('')
                      }}
                      className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                    >
                      キャンセル
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Today's Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今日の出勤時間</h3>
            <p className="text-2xl font-bold text-pink-400">
              {attendances.length > 0 && attendances[0].start_time.startsWith(today) 
                ? formatTime(attendances[0].start_time)
                : '未出勤'
              }
            </p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今日の退勤時間</h3>
            <p className="text-2xl font-bold text-pink-400">
              {attendances.length > 0 && attendances[0].end_time
                ? formatTime(attendances[0].end_time)
                : currentAttendance ? '勤務中' : '未退勤'
              }
            </p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今日の勤務時間</h3>
            <p className="text-2xl font-bold text-pink-400">
              {attendances.length > 0
                ? calculateWorkTime(attendances[0].start_time, attendances[0].end_time)
                : '0時間0分'
              }
            </p>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今月の勤務時間</h3>
            <p className="text-3xl font-bold text-pink-400">0時間</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">今月の勤務日数</h3>
            <p className="text-3xl font-bold text-pink-400">0日</p>
          </div>
          <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-white mb-2">平均勤務時間</h3>
            <p className="text-3xl font-bold text-pink-400">0時間</p>
          </div>
        </div>

        {/* Attendance History */}
        <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg">
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-4">今日の勤怠履歴</h3>
            
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-300">読み込み中...</div>
              </div>
            ) : attendances.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-300">今日の勤怠記録はありません</div>
              </div>
            ) : (
              <div className="space-y-3">
                {attendances.map((attendance) => (
                  <div
                    key={attendance.id}
                    className="flex flex-col md:flex-row justify-between items-start md:items-center p-4 bg-gray-800/50 rounded-lg space-y-2 md:space-y-0"
                  >
                    <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-6 w-full md:w-auto">
                      <div>
                        <div className="text-sm text-gray-400">出勤</div>
                        <div className="text-white font-semibold">
                          {formatTime(attendance.start_time)}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">退勤</div>
                        <div className="text-white font-semibold">
                          {attendance.end_time ? formatTime(attendance.end_time) : '勤務中'}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">勤務時間</div>
                        <div className="text-white font-semibold">
                          {calculateWorkTime(attendance.start_time, attendance.end_time)}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto">
                      <div className="text-sm text-gray-400">
                        {new Date(attendance.created_at).toLocaleDateString('ja-JP')}
                      </div>
                      {isOwner && (
                        <div className="flex space-x-2">
                          <button
                            onClick={() => handleEditAttendance(attendance)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded text-xs transition-colors"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteAttendance(attendance.id)}
                            className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded text-xs transition-colors"
                          >
                            削除
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="fixed top-4 right-4 max-w-sm bg-red-900/90 backdrop-blur-sm border border-red-500 text-red-100 rounded-lg p-4 shadow-lg z-50">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium">エラーが発生しました</h3>
                <div className="mt-1 text-sm">{error}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="inline-flex text-red-400 hover:text-red-300"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && editingAttendance && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-white mb-4">勤怠記録を編集</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    日付
                  </label>
                  <input
                    type="date"
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    出勤時刻
                  </label>
                  <input
                    type="time"
                    value={editStartTime}
                    onChange={(e) => setEditStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    退勤時刻（空白の場合は勤務中）
                  </label>
                  <input
                    type="time"
                    value={editEndTime}
                    onChange={(e) => setEditEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                  />
                </div>
                
                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={handleUpdateAttendance}
                    disabled={!editDate || !editStartTime}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    更新
                  </button>
                  <button
                    onClick={() => {
                      setShowEditModal(false)
                      setEditingAttendance(null)
                      setEditDate('')
                      setEditStartTime('')
                      setEditEndTime('')
                    }}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    キャンセル
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}