import { useEffect } from 'react'
import type { EngineStatus } from '@shared/types'
import { useCaptureStore } from '@renderer/store/useCaptureStore'

/** この状態のときだけ静止画を撮れる。エンジンが応答しない間は撮りに行かない。 */
const OPERABLE: ReadonlySet<EngineStatus> = new Set<EngineStatus>(['ready', 'recording', 'paused'])

/**
 * 定期キャプチャーの実行役。
 *
 * 待ち時間を setInterval ではなく撮影後の setTimeout で作るのは、1 枚の保存が
 * 間隔より長引いたときに撮影が積み重なるのを避けるため。高解像度の PNG では
 * 保存に数百ミリ秒かかることがあり、間隔だけで刻むと呼び出しが渋滞する。
 *
 * 設定はオブジェクトではなく値で受け取る。他の窓が書き換えた設定を取り込むと
 * profile ごと作り直されるため、参照で依存すると中身が同じでも撮り直しが走る。
 */
export function useIntervalCapture(): void {
  const active = useCaptureStore((state) => state.intervalActive)
  const enabled = useCaptureStore((state) => state.settings?.profile.stillImage.interval.enabled ?? false)
  const intervalSec = useCaptureStore(
    (state) => state.settings?.profile.stillImage.interval.intervalSec ?? 0
  )
  const maxShots = useCaptureStore((state) => state.settings?.profile.stillImage.interval.maxShots ?? 0)

  useEffect(() => {
    if (!active || !enabled || intervalSec <= 0) return

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const stop = (): void => {
      cancelled = true
      useCaptureStore.getState().setIntervalActive(false)
    }

    const shoot = async (): Promise<void> => {
      const store = useCaptureStore.getState()

      // エンジンが操作できない状態になったら、撮り続けずに自分から降りる。
      if (!OPERABLE.has(store.engine.status)) {
        stop()
        return
      }

      await store.takeScreenshot()
      if (cancelled) return

      // 保存に失敗したまま撮り続けても、同じ失敗を繰り返してエラーを上書きするだけ。
      if (useCaptureStore.getState().error) {
        stop()
        return
      }

      store.noteIntervalShot()
      if (maxShots > 0 && useCaptureStore.getState().intervalShots >= maxShots) {
        stop()
        return
      }

      timer = setTimeout(() => void shoot(), intervalSec * 1000)
    }

    // 1 枚目もタイマー越しに撮る。直に呼ぶと、開発時の二重実行で撮影だけが 2 回走る。
    timer = setTimeout(() => void shoot(), 0)

    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [active, enabled, intervalSec, maxShots])
}
