import { useEffect } from 'react'
import { useCaptureStore } from '@renderer/store/useCaptureStore'

/**
 * Main から届く状態通知を store へ流し込む。
 * 返される解除関数はアンマウント時に必ず呼ぶ。呼ばないと HMR のたびにリスナーが積み上がる。
 */
export function useEngineEvents(): void {
  useEffect(() => {
    const {
      setEngineState,
      setStats,
      setResult,
      setFinderVisible,
      setDrawingVisible,
      applyExternalRegion,
      setSetupProgress,
      adoptSettings
    } = useCaptureStore.getState()

    const unsubscribers = [
      window.capture.events.onEngineState(setEngineState),
      window.capture.events.onRecordingStats(setStats),
      window.capture.events.onRecordingFinished(setResult),
      window.capture.events.onRegionChanged(applyExternalRegion),
      window.capture.events.onFinderVisibility(setFinderVisible),
      window.capture.events.onDrawingVisibility(setDrawingVisible),
      window.capture.events.onSetupProgress(setSetupProgress),
      // ファインダーの操作バーからも設定を変えられる。片方の切り替えがもう片方に映るようにする。
      window.capture.events.onSettingsChanged(adoptSettings)
    ]

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [])
}
