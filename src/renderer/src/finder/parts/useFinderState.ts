import { useEffect, useState } from 'react'
import {
  FINDER_BAR_HEIGHT,
  FINDER_OUTSET,
  type CaptureSourceKind,
  type EngineState,
  type RecordingStats
} from '@shared/types'

export interface FinderState {
  engine: EngineState
  stats: RecordingStats | null
  size: { width: number; height: number }
  /** 描き込みの窓が開いているか。バーの点灯に使う。 */
  drawingVisible: boolean
  /** 今どの取り込み方に付いているか。範囲指定のときだけ枠を描く。 */
  sourceKind: CaptureSourceKind
}

/** ウィンドウの外形から、いま実際に録れる範囲の大きさを求める。 */
function readSize(): { width: number; height: number } {
  return {
    width: Math.max(0, window.outerWidth - FINDER_OUTSET * 2),
    height: Math.max(0, window.outerHeight - FINDER_OUTSET * 2 - FINDER_BAR_HEIGHT)
  }
}

/**
 * ファインダーが表示に必要とする状態だけを集める。
 * メインウィンドウの store とは独立させる。別ウィンドウなので状態は共有されず、
 * 唯一の情報源は Main から届くイベントとウィンドウ自身の寸法になる。
 */
export function useFinderState(): FinderState {
  const [engine, setEngine] = useState<EngineState>({
    status: 'idle',
    backendVersion: null,
    message: null
  })
  const [stats, setStats] = useState<RecordingStats | null>(null)
  const [size, setSize] = useState(readSize)
  const [drawingVisible, setDrawingVisible] = useState(false)
  const [sourceKind, setSourceKind] = useState<CaptureSourceKind>('region')

  useEffect(() => {
    const unsubscribers = [
      window.capture.events.onEngineState(setEngine),
      window.capture.events.onRecordingStats(setStats),
      window.capture.events.onDrawingVisibility(setDrawingVisible),
      window.capture.events.onFinderMode(setSourceKind)
    ]

    const handleResize = (): void => setSize(readSize())
    window.addEventListener('resize', handleResize)

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return { engine, stats, size, drawingVisible, sourceKind }
}
