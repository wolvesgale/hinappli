import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'

interface AttendanceRecord {
  id: string
  user_email: string
  start_time: string
  created_at: string
}

interface UserPhotosData {
  user_email: string
  records: AttendanceRecord[]
}

const AttendancePhotoAdmin: React.FC = () => {
  const { authUser } = useAuthContext()
  const [userPhotos, setUserPhotos] = useState<UserPhotosData[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])

  const fetchAttendanceRecords = async () => {
    if (!authUser?.user?.email) return

    try {
      setLoading(true)
      
      // 過去3日分の出勤記録を取得
      const threeDaysAgo = new Date()
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
      
      const { data, error } = await supabase
        .from('attendances')
        .select('id, user_email, start_time, created_at')
        .gte('start_time', threeDaysAgo.toISOString())
        .order('start_time', { ascending: false })
      
      if (error) {
        console.error('Error fetching attendance records:', error)
        return
      }

      // ユーザーごとにグループ化
      const groupedData: { [key: string]: AttendanceRecord[] } = {}
      
      data?.forEach((record) => {
        if (!groupedData[record.user_email]) {
          groupedData[record.user_email] = []
        }
        groupedData[record.user_email].push(record)
      })

      // ユーザーごとのデータに変換
      const userRecordsData = Object.entries(groupedData).map(([email, records]) => ({
        user_email: email,
        records: records
      }))

      setUserPhotos(userRecordsData)
    } catch (error) {
      console.error('Error in fetchAttendanceRecords:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAttendanceRecords()
  }, [authUser])

  if (!authUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-white text-xl">ログインが必要です</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link
              to="/admin"
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              ← 管理画面に戻る
            </Link>
            <h1 className="text-3xl font-bold text-white">📸 出退勤写真確認</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 rounded-lg bg-white/20 text-white placeholder-white/70 border border-white/30"
            />
            <button
              onClick={fetchAttendanceRecords}
              className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg transition-colors"
            >
              🔄 更新
            </button>
          </div>
        </div>

        {/* 説明 */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-2">📋 機能説明</h2>
          <p className="text-white/80">
            過去3日分の出勤記録を表示します。写真機能は現在準備中です。
          </p>
        </div>

        {/* ローディング */}
        {loading && (
          <div className="text-center py-8">
            <div className="text-white text-xl">読み込み中...</div>
          </div>
        )}

        {/* 出勤記録一覧 */}
        {!loading && (
          <div className="space-y-6">
            {userPhotos.length === 0 ? (
              <div className="bg-white/10 backdrop-blur-sm rounded-lg p-8 text-center">
                <div className="text-white/80 text-lg">
                  過去3日間の出勤記録がありません
                </div>
              </div>
            ) : (
              userPhotos.map((userData) => (
                <div key={userData.user_email} className="bg-white/10 backdrop-blur-sm rounded-lg p-6">
                  <h3 className="text-xl font-semibold text-white mb-4">
                    👤 {userData.user_email}
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {userData.records.map((record) => (
                      <div key={record.id} className="bg-white/5 rounded-lg p-4">
                        <div className="text-white/80 text-sm mb-2">
                          出勤時刻: {new Date(record.start_time).toLocaleString('ja-JP')}
                        </div>
                        
                        <div className="bg-gray-200 w-full h-48 rounded-lg flex items-center justify-center">
                          <span className="text-gray-500">写真機能準備中</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default AttendancePhotoAdmin