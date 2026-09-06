import { useEffect, useState } from 'react'
import { SHOT_NOTICE_MS } from '@shared/types'

export interface ShutterFlash {
  /**
   * 撮るたびに 1 つ増える。
   * 同じ状態が続いても値が変わるため、連写でも発光を撮り直せる。まだ 1 枚も撮っていなければ 0。
   */
  flashKey: number
  /** 直近に保存したファイル名。時間が経つと null へ戻る。 */
  fileName: string | null
}

/** 保存先のフルパスから、表示に使うファイル名だけを取り出す。 */
function baseName(path: string): string {
  const separator = Math.max(path.lastIndexOf('\\'), path.lastIndexOf('/'))
  return separator < 0 ? path : path.slice(separator + 1)
}

/**
 * 静止画が保存されたことを受け取る。
 *
 * 撮影の起点はホットキー・メインウィンドウ・ファインダーのバーと複数あり、
 * どこから撮っても同じ合図が出なければ「撮れたのか分からない」状態は解消しない。
 * そのため起点側の戻り値ではなく、Main が保存を終えてから配る通知だけを見る。
 */
export function useShutterFlash(): ShutterFlash {
  const [flashKey, setFlashKey] = useState(0)
  const [fileName, setFileName] = useState<string | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const unsubscribe = window.capture.events.onScreenshotSaved((file) => {
      setFlashKey((current) => current + 1)
      setFileName(baseName(file))

      // 連写では前の予約を捨てて数え直す。残したままだと、2 枚目の表示が
      // 1 枚目の予約で早々に消える。
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setFileName(null), SHOT_NOTICE_MS)
    })

    return () => {
      unsubscribe()
      if (timer) clearTimeout(timer)
    }
  }, [])

  return { flashKey, fileName }
}
