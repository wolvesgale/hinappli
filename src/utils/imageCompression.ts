/**
 * 画像圧縮ユーティリティ
 * 出勤写真とレジ写真の容量を削減するための機能
 */

export interface CompressionOptions {
  maxWidth?: number
  maxHeight?: number
  quality?: number
  maxSizeKB?: number
}

/**
 * 画像ファイルを圧縮する
 * @param file 元の画像ファイル
 * @param options 圧縮オプション
 * @returns 圧縮された画像ファイル
 */
export const compressImage = async (
  file: File,
  options: CompressionOptions = {}
): Promise<File> => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    maxSizeKB = 500
  } = options

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()

    img.onload = () => {
      // 元の画像サイズを取得
      let { width, height } = img

      // アスペクト比を保持しながらリサイズ
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height)
        width *= ratio
        height *= ratio
      }

      // キャンバスサイズを設定
      canvas.width = width
      canvas.height = height

      // 画像を描画
      ctx?.drawImage(img, 0, 0, width, height)

      // 品質を調整しながら圧縮
      let currentQuality = quality
      const tryCompress = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('画像の圧縮に失敗しました'))
              return
            }

            const sizeKB = blob.size / 1024

            // 目標サイズ以下になったか、品質が最低値に達した場合は完了
            if (sizeKB <= maxSizeKB || currentQuality <= 0.1) {
              const compressedFile = new File([blob], file.name, {
                type: file.type,
                lastModified: Date.now()
              })
              resolve(compressedFile)
            } else {
              // 品質を下げて再試行
              currentQuality -= 0.1
              tryCompress()
            }
          },
          file.type,
          currentQuality
        )
      }

      tryCompress()
    }

    img.onerror = () => {
      reject(new Error('画像の読み込みに失敗しました'))
    }

    // 画像を読み込み
    img.src = URL.createObjectURL(file)
  })
}

/**
 * 出勤写真用の圧縮設定
 */
export const compressAttendancePhoto = (file: File): Promise<File> => {
  return compressImage(file, {
    maxWidth: 1000,
    maxHeight: 1000,
    quality: 0.7,
    maxSizeKB: 400
  })
}

/**
 * レジ写真用の圧縮設定
 */
export const compressRegisterPhoto = (file: File): Promise<File> => {
  return compressImage(file, {
    maxWidth: 800,
    maxHeight: 800,
    quality: 0.6,
    maxSizeKB: 300
  })
}