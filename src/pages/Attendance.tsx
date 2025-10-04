import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Attendance as AttendanceRecord } from '../types/database'
import { compressAttendancePhoto } from '../utils/imageCompression'
import { formatWorkTime } from '../utils/timeUtils'

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
  // ★追加: 同伴出勤チェック用のstate
  const [companionChecked, setCompanionChecked] = useState(false)
  // ★追加: 同伴出勤回数のstate
  const [companionCount, setCompanionCount] = useState(0)
  // ★追加: 写真撮影関連の状態
  const [attendancePhoto, setAttendancePhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { authUser, isOwner } = useAuthContext()
  // ★追加: 写真アップロード処理
  const uploadPhoto = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${authUser?.user.id}_${Date.now()}.${fileExt}`
      const filePath = `attendance-photos/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('attendance-photos')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      const { data } = supabase.storage
        .from('attendance-photos')
        .getPublicUrl(filePath)

      return data.publicUrl
    } catch (err) {
      console.error('Photo upload error:', err)
      return null
    }
  }

  const today = new Date().toISOString().split('T')[0]

  // ★追加: 写真選択処理（圧縮機能付き）
  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      try {
        // 画像を圧縮
        const compressedFile = await compressAttendancePhoto(file)
        setAttendancePhoto(compressedFile)
        
        const reader = new FileReader()
        reader.onload = (e) => {
          setPhotoPreview(e.target?.result as string)
        }
        reader.readAsDataURL(compressedFile)
      } catch (error) {
        console.error('画像圧縮エラー:', error)
        setError('画像の処理に失敗しました。別の画像を選択してください。')
      }
    }
  }

  // ★追加: 写真削除処理
  const handlePhotoRemove = () => {
    setAttendancePhoto(null)
    setPhotoPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  useEffect(() => {
    if (authUser) {
      fetchAttendances()
      checkCurrentAttendance()
      if (isOwner) {
        fetchCompanionCount()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, isOwner])

  // 12時の強制退勤処理
  useEffect(() => {
    if (!currentAttendance) return

    const checkAutoCheckout = () => {
      const now = new Date()
      const currentHour = now.getHours()
      const currentMinute = now.getMinutes()
      
      // 12時00分になったら強制退勤
      if (currentHour === 12 && currentMinute === 0) {
        handleAutoCheckout()
      }
    }

    // 1分ごとにチェック
    const interval = setInterval(checkAutoCheckout, 60000)
    
    return () => clearInterval(interval)
  }, [currentAttendance])

  const handleAutoCheckout = async () => {
    if (!authUser || !currentAttendance) return

    try {
      // 12時00分で強制退勤
      const noonTime = new Date()
      noonTime.setHours(12, 0, 0, 0)
      
      const { error } = await supabase
        .from('attendances')
        .update({ end_time: noonTime.toISOString() })
        .eq('id', currentAttendance.id)
      
      if (error) throw error
      
      // 退勤後は現在の出勤記録をクリア
      setCurrentAttendance(null)
      
      // データを再取得
      await fetchAttendances()
      
      // ユーザーに通知
      alert('12時になりましたので、自動的に退勤処理を行いました。')
    } catch (err) {
      console.error('Auto checkout error:', err)
      setError(err instanceof Error ? err.message : '自動退勤処理でエラーが発生しました')
    }
  }

  // ★追加: 同伴出勤回数を取得する関数
  const fetchCompanionCount = async () => {
    if (!authUser || !authUser.user.email) return

    try {
      const now = new Date()
      const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString()
      const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString()
      
      const { data, error } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_email', authUser.user.email)
        .eq('companion_checked', true)
        .gte('start_time', start)
        .lt('start_time', next)
      
      if (error) throw error
      setCompanionCount(data?.length || 0)
    } catch (err) {
      console.error('Error fetching companion count:', err)
    }
  }
  const fetchAttendances = async () => {
    if (!authUser || !authUser.user.email) return

    try {
      // 過去30日間のデータを取得（必要に応じて調整可能）
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      const startDate = thirtyDaysAgo.toISOString().split('T')[0]
      
      const { data, error } = await supabase
        .from('attendances')
        .select('*')
        .eq('user_email', authUser.user.email)
        .gte('start_time', `${startDate}T00:00:00`)
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
        .maybeSingle()
      
      if (error) throw error
      setCurrentAttendance(data ?? null)
    } catch (err) {
      console.error('Error checking current attendance:', err)
      setCurrentAttendance(null)
    }
  }

  const handleClockIn = async () => {
    if (!authUser || !authUser.user.email) return
    
    // 既に出勤中の場合は処理を停止
    if (currentAttendance) {
      setError('既に出勤中です。退勤してから再度出勤してください。')
      return
    }
    
    // 写真が必須
    if (!attendancePhoto) {
      setError('出勤時の写真撮影は必須です。先ずは自身とお店を撮影してください。')
      return
    }

    try {
      // 出勤中の記録をチェック（二重チェック）
      const { data: activeAttendance, error: activeCheckError } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_email', authUser.user.email)
        .is('end_time', null)
        .limit(1)
      
      if (activeCheckError) throw activeCheckError
      
      if (activeAttendance && activeAttendance.length > 0) {
        setError('既に出勤中です。退勤してから再度出勤してください。')
        // 現在の出勤状態を再確認
        await checkCurrentAttendance()
        return
      }

      // 同日中の出勤記録をチェック
      const today = new Date()
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString()
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString()
      
      const { data: existingAttendance, error: checkError } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_email', authUser.user.email)
        .gte('start_time', startOfDay)
        .lt('start_time', endOfDay)
        .limit(1)
      
      if (checkError) throw checkError
      
      if (existingAttendance && existingAttendance.length > 0) {
        setError('本日は既に出勤済みです。1日1回のみ出勤可能です。')
        return
      }

      // 写真をアップロード
      const photoUrl = await uploadPhoto(attendancePhoto)
      if (!photoUrl) {
        setError('写真のアップロードに失敗しました。')
        return
      }

      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: authUser.user.id,
          user_email: authUser.user.email,
          start_time: new Date().toISOString(),
          companion_checked: companionChecked,
          photo_url: photoUrl // ★追加: 写真URLを保存
        })
        .select()
        .maybeSingle()
      
      if (error) throw error
      
      // 新しい出勤記録を即座に状態に反映
      setCurrentAttendance(data)
      
      // 状態をリセット
      setCompanionChecked(false)
      setAttendancePhoto(null)
      setPhotoPreview(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      
      // データを再取得
      await fetchAttendances()
      if (isOwner) {
        fetchCompanionCount()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    }
  }

  const handleManualClockIn = async () => {
    if (!authUser || !authUser.user.email || !manualDate || !manualTime) return

    // 既に出勤中の場合は処理を停止
    if (currentAttendance) {
      setError('既に出勤中です。退勤してから再度出勤してください。')
      return
    }

    try {
      // 出勤中の記録をチェック（二重チェック）
      const { data: activeAttendance, error: activeCheckError } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_email', authUser.user.email)
        .is('end_time', null)
        .limit(1)
      
      if (activeCheckError) throw activeCheckError
      
      if (activeAttendance && activeAttendance.length > 0) {
        setError('既に出勤中です。退勤してから再度出勤してください。')
        // 現在の出勤状態を再確認
        await checkCurrentAttendance()
        return
      }

      const dateTime = new Date(`${manualDate}T${manualTime}:00`)
      
      // 指定日の出勤記録をチェック
      const targetDate = new Date(manualDate)
      const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).toISOString()
      const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1).toISOString()
      
      const { data: existingAttendance, error: checkError } = await supabase
        .from('attendances')
        .select('id')
        .eq('user_email', authUser.user.email)
        .gte('start_time', startOfDay)
        .lt('start_time', endOfDay)
        .limit(1)
      
      if (checkError) throw checkError
      
      if (existingAttendance && existingAttendance.length > 0) {
        setError('指定日は既に出勤済みです。1日1回のみ出勤可能です。')
        return
      }
      
      const { data, error } = await supabase
        .from('attendances')
        .insert({
          user_id: authUser.user.id,
          user_email: authUser.user.email,
          start_time: dateTime.toISOString(),
          companion_checked: companionChecked // ★追加: 同伴チェック状態を保存
        })
        .select()
        .maybeSingle()
      
      if (error) throw error
      
      // 新しい出勤記録を即座に状態に反映
      setCurrentAttendance(data)
      
      setShowManualInput(false)
      setManualTime('')
      setManualDate('')
      setCompanionChecked(false) // 同伴チェックもリセット
      
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
    return formatWorkTime(startTime, endTime)
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
                
                {/* ★追加: 写真撮影関連の状態 */}
                <div className="bg-gray-800/50 rounded-lg p-4 mb-4">
                  <div className="text-center mb-4">
                    <p className="text-pink-300 text-lg font-medium mb-2">
                      📸 おはようございます✨まずは自身とお店を撮影してくださいね♪
                    </p>
                    <p className="text-gray-400 text-sm">
                      出勤時の写真撮影は必須項目です
                    </p>
                  </div>
                  
                  {!photoPreview ? (
                    <div className="text-center">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handlePhotoSelect}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                      >
                        📷 写真を撮影
                      </button>
                    </div>
                  ) : (
                    <div className="text-center">
                      <img
                        src={photoPreview}
                        alt="出勤時写真"
                        className="max-w-full max-h-48 mx-auto rounded-lg mb-3"
                      />
                      <div className="flex justify-center space-x-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                          📷 撮り直し
                        </button>
                        <button
                          onClick={handlePhotoRemove}
                          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                        >
                          🗑️ 削除
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* ★追加: 同伴チェックボックス */}
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <input
                    type="checkbox"
                    id="companionCheck"
                    checked={companionChecked}
                    onChange={(e) => setCompanionChecked(e.target.checked)}
                    className="w-5 h-5 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 focus:ring-2"
                  />
                  <label htmlFor="companionCheck" className="text-white text-lg font-medium">
                    同伴出勤
                  </label>
                </div>
                
                <div className="flex flex-col sm:flex-row justify-center space-y-2 sm:space-y-0 sm:space-x-4">
                  <button
                    onClick={handleClockIn}
                    disabled={!attendancePhoto}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-3 md:py-4 px-6 md:px-8 rounded-lg text-lg md:text-xl transition-colors"
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
                  {/* ★追加: 手動入力時の写真撮影セクション */}
                  {!currentAttendance && (
                    <div className="bg-gray-700/50 rounded-lg p-4 mb-4">
                      <div className="text-center mb-4">
                        <p className="text-pink-300 text-lg font-medium mb-2">
                          📸 おはようございます✨先ずは自身とお店を撮影してくださいね♪
                        </p>
                        <p className="text-gray-400 text-sm">
                          出勤時の写真撮影は必須項目です
                        </p>
                      </div>
                      
                      {!photoPreview ? (
                        <div className="text-center">
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            className="bg-pink-600 hover:bg-pink-700 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                          >
                            📷 写真を撮影
                          </button>
                        </div>
                      ) : (
                        <div className="text-center">
                          <img
                            src={photoPreview}
                            alt="出勤時写真"
                            className="max-w-full max-h-32 mx-auto rounded-lg mb-3"
                          />
                          <div className="flex justify-center space-x-3">
                            <button
                              onClick={() => fileInputRef.current?.click()}
                              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded transition-colors text-sm"
                            >
                              📷 撮り直し
                            </button>
                            <button
                              onClick={handlePhotoRemove}
                              className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-1 px-3 rounded transition-colors text-sm"
                            >
                              🗑️ 削除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* ★追加: 手動入力時の同伴チェックボックス */}
                  {!currentAttendance && (
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        id="manualCompanionCheck"
                        checked={companionChecked}
                        onChange={(e) => setCompanionChecked(e.target.checked)}
                        className="w-4 h-4 text-pink-600 bg-gray-700 border-gray-600 rounded focus:ring-pink-500 focus:ring-2"
                      />
                      <label htmlFor="manualCompanionCheck" className="text-white font-medium">
                        同伴出勤
                      </label>
                    </div>
                  )}
                  
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
                        disabled={!manualDate || !manualTime || !attendancePhoto}
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
                        setCompanionChecked(false)
                        setAttendancePhoto(null)
                        setPhotoPreview(null)
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
            <h3 className="text-lg font-semibold text-white mb-2">
              {isOwner ? '今月の同伴出勤回数' : '平均勤務時間'}
            </h3>
            <p className="text-3xl font-bold text-pink-400">
              {isOwner ? `${companionCount}回` : '0時間'}
            </p>
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
                      {/* ★追加: 同伴出勤表示 */}
                      <div>
                        <div className="text-sm text-gray-400">同伴</div>
                        <div className="text-white font-semibold">
                          {attendance.companion_checked ? (
                            <span className="text-pink-400">✓ 同伴</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
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
          <div className="fixed top-4 right-4 max-w-sm bg-red-900/90 backdrop-blur-sm border border-red-500 text-red-100 rounded-lg p-4 shadow-lg z-50 animate-pulse">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-200">⚠️ 重要なお知らせ</h3>
                <div className="mt-1 text-sm font-medium">{error}</div>
              </div>
              <div className="ml-auto pl-3">
                <button
                  onClick={() => setError('')}
                  className="inline-flex text-red-400 hover:text-red-300 transition-colors"
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