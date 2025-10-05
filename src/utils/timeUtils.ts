/**
 * 時間計算に関するユーティリティ関数
 */

/**
 * 時間を15分単位に切り上げる関数
 * 例: 6時5分 → 6時15分, 6時16分 → 6時30分
 * @param hours 時間（小数点含む）
 * @returns 15分単位に切り上げられた時間
 */
export const roundUpToQuarterHour = (hours: number): number => {
  // 15分 = 0.25時間なので、4倍して切り上げ、4で割る
  return Math.ceil(hours * 4) / 4
}

/**
 * 勤怠時間を計算し、15分単位に切り上げる関数
 * @param startTime 開始時刻（ISO文字列）
 * @param endTime 終了時刻（ISO文字列）
 * @param userRole ユーザーの役割（ドライバーの特別計算用）
 * @returns 15分単位に切り上げられた勤務時間
 */
export const calculateAttendanceHours = (
  startTime: string, 
  endTime: string | null, 
  userRole?: string
): number => {
  if (!endTime) return 0
  
  const start = new Date(startTime)
  const end = new Date(endTime)
  
  // 基本的な時間計算（実際の勤務時間）
  let hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)
  
  // 負の値の場合は0を返す（データエラー対策）
  if (hours < 0) {
    console.warn('勤務時間が負の値になりました:', { startTime, endTime })
    return 0
  }
  
  // ドライバーの場合の特別な計算ロジック（夜勤対応）
  if (userRole === 'driver') {
    const startHour = start.getHours()
    const endHour = end.getHours()
    
    // 夜勤判定：18時以降に出勤し、翌日の朝（6時以前）に退勤する場合
    const isNightShift = startHour >= 18 && endHour <= 6 && end.getDate() !== start.getDate()
    
    if (isNightShift) {
      // 夜勤の場合：実際の勤務時間をそのまま使用（特別な調整は行わない）
      // 以前のロジック（翌0時基準）は削除し、実際の勤務時間を正確に計算
      console.log('夜勤として処理:', { startTime, endTime, hours: hours.toFixed(2) })
    }
  }
  
  // 15分単位に切り上げ
  return roundUpToQuarterHour(hours)
}

/**
 * 勤務時間を「X時間Y分」形式で表示する関数（15分単位切り上げ適用）
 * @param startTime 開始時刻（ISO文字列）
 * @param endTime 終了時刻（ISO文字列）
 * @param userRole ユーザーの役割
 * @returns 「X時間Y分」形式の文字列
 */
export const formatWorkTime = (
  startTime: string, 
  endTime: string | null, 
  userRole?: string
): string => {
  if (!endTime) return '勤務中'
  
  const totalHours = calculateAttendanceHours(startTime, endTime, userRole)
  const hours = Math.floor(totalHours)
  const minutes = Math.round((totalHours - hours) * 60)
  
  return `${hours}時間${minutes}分`
}

/**
 * 複数の勤怠記録から合計勤務時間を計算する関数（15分単位切り上げ適用）
 * @param attendances 勤怠記録の配列
 * @param userRole ユーザーの役割
 * @returns 合計勤務時間（15分単位切り上げ済み）
 */
export const calculateTotalAttendanceHours = (
  attendances: Array<{ start_time: string; end_time: string | null }>,
  userRole?: string
): number => {
  return attendances.reduce((total, attendance) => {
    return total + calculateAttendanceHours(attendance.start_time, attendance.end_time, userRole)
  }, 0)
}