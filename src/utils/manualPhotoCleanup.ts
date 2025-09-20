import { supabase, supabaseAdmin } from '../lib/supabase'

/**
 * 手動で出勤写真のクリーンアップを実行する関数
 * 管理者が必要に応じて呼び出すことができる
 */
export const manualAttendancePhotoCleanup = async (daysOld: number = 3): Promise<{
  success: boolean
  deletedCount: number
  error?: string
}> => {
  try {
    // 指定日数前の日付を計算
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysOld)
    cutoffDate.setHours(23, 59, 59, 999)

    console.log(`Manual cleanup: removing attendance photos older than ${daysOld} days (${cutoffDate.toISOString()})`)

    // 古い出勤記録を取得
    const { data: oldRecords, error: fetchError } = await supabase
      .from('attendances')
      .select('id, start_time, user_email')
      .lt('start_time', cutoffDate.toISOString())

    if (fetchError) {
      console.error('Error fetching old attendance records:', fetchError)
      return {
        success: false,
        deletedCount: 0,
        error: fetchError.message
      }
    }

    if (!oldRecords || oldRecords.length === 0) {
      console.log('No old attendance records to clean up')
      return {
        success: true,
        deletedCount: 0
      }
    }

    console.log(`Found ${oldRecords.length} old attendance records to clean up`)

    let deletedCount = 0
    const errors: string[] = []
    const adminClient = supabaseAdmin || supabase

    // 各レコードを処理
    for (const record of oldRecords) {
      try {
        // ストレージから関連する写真ファイルを削除
        // attendance-photosバケットから該当するファイルを検索して削除
        const { data: files, error: listError } = await adminClient.storage
          .from('attendance-photos')
          .list('', {
            limit: 1000,
            search: record.id
          })

        if (listError) {
          console.warn(`Failed to list files for record ${record.id}:`, listError)
          errors.push(`File listing failed for ${record.id}: ${listError.message}`)
        } else if (files && files.length > 0) {
          // 該当するファイルを削除
          const filePaths = files.map(file => file.name)
          const { error: storageError } = await adminClient.storage
            .from('attendance-photos')
            .remove(filePaths)

          if (storageError) {
            console.warn(`Failed to delete storage files for ${record.id}:`, storageError)
            errors.push(`Storage deletion failed for ${record.id}: ${storageError.message}`)
          } else {
            console.log(`Deleted ${filePaths.length} storage files for record: ${record.id}`)
          }
        }

        // データベースからレコードを削除
        const { error: dbError } = await supabase
          .from('attendances')
          .delete()
          .eq('id', record.id)

        if (dbError) {
          console.error(`Failed to delete attendance record ${record.id}:`, dbError)
          errors.push(`Database deletion failed for ${record.id}: ${dbError.message}`)
        } else {
          console.log(`Deleted attendance record: ${record.id} (${record.user_email}, ${record.start_time})`)
          deletedCount++
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        console.error(`Error processing record ${record.id}:`, error)
        errors.push(`Processing error for ${record.id}: ${errorMessage}`)
      }
    }

    const result = {
      success: errors.length === 0,
      deletedCount,
      error: errors.length > 0 ? errors.join('; ') : undefined
    }

    console.log(`Manual attendance photo cleanup completed. Deleted: ${deletedCount}, Errors: ${errors.length}`)
    return result

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Error in manualAttendancePhotoCleanup:', error)
    return {
      success: false,
      deletedCount: 0,
      error: errorMessage
    }
  }
}