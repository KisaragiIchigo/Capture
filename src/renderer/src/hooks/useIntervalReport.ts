import { useEffect } from 'react'
import { useCaptureStore } from '@renderer/store/useCaptureStore'

/**
 * 定期キャプチャーの実行状況を Main へ知らせる。
 *
 * 通知領域のアイコンと、撮影開始に伴うウィンドウの引っ込めは Main にしかできない。
 * 実行状態は Renderer が持っているため、変わるたびに事実だけを渡す。
 */
export function useIntervalReport(): void {
  const active = useCaptureStore((state) => state.intervalActive)
  const shots = useCaptureStore((state) => state.intervalShots)

  useEffect(() => {
    // 知らせられなくても撮影は続く。通知領域の見た目のために撮影を止めない。
    window.capture.intervalCapture.report({ active, shots }).catch(() => undefined)
  }, [active, shots])
}
