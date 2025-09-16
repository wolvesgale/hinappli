import { supabase, supabaseAdmin } from '../lib/supabase'

/**
 * 一週間より古いレジ写真を自動削除する関数
 */
export const cleanupOldRegisterPhotos = async () => {
  try {
    // 一週間前の日付を計算
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const cutoffDate = oneWeekAgo.toISOString().split('T')[0]

    console.log(`Cleaning up register photos older than ${cutoffDate}`)

    // 一週間より古いレジセッションを取得
    const { data: oldSessions, error: fetchError } = await supabase
      .from('register_sessions')
      .select('id, biz_date, open_photo_url, close_photo_url')
      .lt('biz_date', cutoffDate)

    if (fetchError) {
      console.error('Failed to fetch old register sessions:', fetchError)
      return { success: false, error: fetchError.message }
    }

    if (!oldSessions || oldSessions.length === 0) {
      console.log('No old register sessions found to clean up')
      return { success: true, deletedCount: 0 }
    }

    let deletedPhotosCount = 0
    const adminClient = supabaseAdmin || supabase

    // 各セッションの写真を削除
    for (const session of oldSessions) {
      // オープン写真の削除
      if (session.open_photo_url) {
        try {
          const openPhotoPath = extractPhotoPath(session.open_photo_url)
          if (openPhotoPath) {
            const { error: deleteError } = await adminClient.storage
              .from('register-photos')
              .remove([openPhotoPath])
            
            if (deleteError) {
              console.error(`Failed to delete open photo ${openPhotoPath}:`, deleteError)
            } else {
              deletedPhotosCount++
              console.log(`Deleted open photo: ${openPhotoPath}`)
            }
          }
        } catch (err) {
          console.error('Error deleting open photo:', err)
        }
      }

      // クローズ写真の削除
      if (session.close_photo_url) {
        try {
          const closePhotoPath = extractPhotoPath(session.close_photo_url)
          if (closePhotoPath) {
            const { error: deleteError } = await adminClient.storage
              .from('register-photos')
              .remove([closePhotoPath])
            
            if (deleteError) {
              console.error(`Failed to delete close photo ${closePhotoPath}:`, deleteError)
            } else {
              deletedPhotosCount++
              console.log(`Deleted close photo: ${closePhotoPath}`)
            }
          }
        } catch (err) {
          console.error('Error deleting close photo:', err)
        }
      }
    }

    // データベースから写真URLを削除（セッション自体は履歴として保持）
    const sessionIds = oldSessions.map(s => s.id)
    const { error: updateError } = await supabase
      .from('register_sessions')
      .update({
        open_photo_url: null,
        close_photo_url: null
      })
      .in('id', sessionIds)

    if (updateError) {
      console.error('Failed to update register sessions:', updateError)
      return { success: false, error: updateError.message }
    }

    console.log(`Successfully cleaned up ${deletedPhotosCount} photos from ${oldSessions.length} sessions`)
    return { 
      success: true, 
      deletedCount: deletedPhotosCount,
      sessionsUpdated: oldSessions.length
    }

  } catch (error) {
    console.error('Error in cleanupOldRegisterPhotos:', error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }
  }
}

/**
 * Supabase Storage URLからファイルパスを抽出する関数
 */
const extractPhotoPath = (photoUrl: string): string | null => {
  try {
    // Supabase Storage URLの形式: https://xxx.supabase.co/storage/v1/object/public/register-photos/filename
    const url = new URL(photoUrl)
    const pathParts = url.pathname.split('/')
    const bucketIndex = pathParts.findIndex(part => part === 'register-photos')
    
    if (bucketIndex !== -1 && bucketIndex < pathParts.length - 1) {
      return pathParts.slice(bucketIndex + 1).join('/')
    }
    
    return null
  } catch (error) {
    console.error('Failed to extract photo path from URL:', photoUrl, error)
    return null
  }
}

/**
 * 定期的な写真クリーンアップを実行する関数
 * アプリケーション起動時やスケジュールされたタスクで呼び出す
 */
export const schedulePhotoCleanup = () => {
  // 即座に一度実行
  cleanupOldRegisterPhotos()

  // 24時間ごとに実行
  const interval = setInterval(() => {
    cleanupOldRegisterPhotos()
  }, 24 * 60 * 60 * 1000) // 24時間

  return interval
}