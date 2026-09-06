import { useEffect } from 'react'
import { useCaptureStore } from '@renderer/store/useCaptureStore'

const GB = 1024 ** 3

/**
 * 長時間録画の自動停止と、空き容量切れによる保護停止。
 *
 * 統計値は 1 秒ごとに届くので、その到着を判定のきっかけにする。
 * 独自のタイマーを持たないことで、録画が止まった時点で判定も自然に止まる。
 */
export function useAutoStop(): void {
  const stats = useCaptureStore((state) => state.stats)
  const behavior = useCaptureStore((state) => state.settings?.behavior)
  const status = useCaptureStore((state) => state.engine.status)

  useEffect(() => {
    if (!stats || !behavior) return
    if (status !== 'recording' && status !== 'paused') return

    const overTime =
      behavior.autoStopMinutes > 0 && stats.durationMs >= behavior.autoStopMinutes * 60_000
    const lowDisk =
      behavior.minFreeDiskGb > 0 && stats.freeDiskBytes < behavior.minFreeDiskGb * GB

    if (overTime || lowDisk) {
      void useCaptureStore.getState().stopRecording()
    }
  }, [stats, behavior, status])
}
