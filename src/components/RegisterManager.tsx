import React, { useState, useRef } from 'react'
import { useAuthContext } from '../contexts/AuthProvider'
import { supabase } from '../lib/supabase'

interface RegisterManagerProps {
  registerStatus: 'closed' | 'open'
  onStatusChange: (status: 'closed' | 'open') => void
}

export const RegisterManager: React.FC<RegisterManagerProps> = ({
  registerStatus,
  onStatusChange
}) => {
  const { authUser } = useAuthContext()
  const [loading, setLoading] = useState(false)
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handlePhotoUpload = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop()
    const fileName = `register_${Date.now()}.${fileExt}`
    const filePath = `register-photos/${fileName}`

    // Check if bucket exists, create if not
    const { data: buckets } = await supabase.storage.listBuckets()
    const bucketExists = buckets?.some(bucket => bucket.id === 'register-photos')
    
    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket('register-photos', {
        public: true
      })
      if (bucketError) {
        console.error('Failed to create bucket:', bucketError)
        throw new Error('ストレージバケットの作成に失敗しました')
      }
    }

    const { error: uploadError } = await supabase.storage
      .from('register-photos')
      .upload(filePath, file)

    if (uploadError) throw uploadError

    const { data } = supabase.storage
      .from('register-photos')
      .getPublicUrl(filePath)

    return data.publicUrl
  }

  const handleRegisterToggle = async () => {
    if (!authUser) return

    const fileInput = fileInputRef.current
    if (!fileInput?.files?.[0]) {
      setError('写真をアップロードしてください')
      return
    }

    if (registerStatus === 'closed' && !amount) {
      setError('レジ金額を入力してください')
      return
    }

    setLoading(true)
    setError('')

    try {
      const photoUrl = await handlePhotoUpload(fileInput.files[0])
      const today = new Date().toISOString().split('T')[0]

      if (registerStatus === 'closed') {
        // レジオープン
        const { error } = await supabase
          .from('register_sessions')
          .insert({
            biz_date: today,
            status: 'open',
            open_photo_url: photoUrl,
            close_amount: parseFloat(amount),
            created_by: authUser.user.email!
          })

        if (error) throw error
        onStatusChange('open')
      } else {
        // レジクローズ
        const { error } = await supabase
          .from('register_sessions')
          .update({
            status: 'closed',
            close_photo_url: photoUrl,
            close_amount: parseFloat(amount)
          })
          .eq('biz_date', today)
          .eq('status', 'open')

        if (error) throw error
        onStatusChange('closed')
      }

      setAmount('')
      if (fileInput) fileInput.value = ''
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-black/30 backdrop-blur-sm border border-white/20 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">レジ管理</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-300">
            {registerStatus === 'open' ? 'オープン中' : 'クローズ中'}
          </span>
          <div className={`w-3 h-3 rounded-full ${registerStatus === 'open' ? 'bg-green-400' : 'bg-red-400'}`}></div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {/* 写真アップロード */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            レジ写真 <span className="text-red-400">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white text-sm file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-pink-600 file:text-white hover:file:bg-pink-700"
          />
        </div>

        {/* 金額入力 */}
        <div>
          <label className="block text-sm text-gray-300 mb-2">
            レジ金額 <span className="text-red-400">*</span>
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="金額を入力"
            className="w-full bg-black/30 border border-white/20 rounded px-3 py-2 text-white placeholder-gray-400 text-sm"
          />
        </div>

        {/* アクションボタン */}
        <button
          onClick={handleRegisterToggle}
          disabled={loading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            registerStatus === 'closed' 
              ? 'bg-green-600 hover:bg-green-700 text-white' 
              : 'bg-red-600 hover:bg-red-700 text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? (
            <div className="flex items-center justify-center">
              <div className="spinner mr-2"></div>
              処理中...
            </div>
          ) : (
            registerStatus === 'closed' ? 'レジオープン' : 'レジクローズ'
          )}
        </button>
      </div>
    </div>
  )
}