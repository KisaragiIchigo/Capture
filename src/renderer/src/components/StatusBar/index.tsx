import type { ReactElement } from 'react'
import { Lightbulb, Timer } from 'lucide-react'
import type { EngineState, RecordingResult, RecordingStats } from '@shared/types'
import { cn } from '@renderer/lib/cn'
import { droppedRatio, formatBytes } from '@renderer/lib/format'

/** 実行中の定期キャプチャーの様子。止まっているときは渡さない。 */
export interface IntervalStatus {
  shots: number
  intervalSec: number
  maxShots: number
}

interface StatusBarProps {
  engine: EngineState
  stats: RecordingStats | null
  lastResult: RecordingResult | null
  targetFps: number
  interval: IntervalStatus | null
  onRevealResult: () => void
}

/** ドロップがこの割合を超えたら体感でカクつきが分かる。 */
const DROP_WARNING_RATIO = 0.01

/**
 * 最下段の 1 行。録画中は実測値、それ以外は状況に応じた案内を出す。
 * 常に何かが書いてある帯にはせず、伝えるべきことがある時だけ意味のある文を置く。
 */
export function StatusBar({
  engine,
  stats,
  lastResult,
  targetFps,
  interval,
  onRevealResult
}: StatusBarProps): ReactElement {
  const isActive = engine.status === 'recording' || engine.status === 'paused'

  if (isActive && stats) {
    const ratio = droppedRatio(stats.droppedFrames, stats.totalFrames)
    const fpsBelowTarget = stats.fps < targetFps * 0.95

    return (
      <div className="flex h-8 shrink-0 items-center gap-1 border-t border-white/[0.06] bg-black/20 px-3">
        <Metric label="FPS" value={stats.fps.toFixed(1)} warning={fpsBelowTarget} />
        <Divider />
        <Metric
          label="DROP"
          value={`${stats.droppedFrames}`}
          suffix={`${(ratio * 100).toFixed(2)}%`}
          warning={ratio > DROP_WARNING_RATIO}
        />
        <Divider />
        <Metric label="SIZE" value={formatBytes(stats.bytesWritten)} />
        <Divider />
        <Metric label="CPU" value={`${stats.cpuUsage.toFixed(1)}%`} />
        <Divider />
        <Metric label="DISK" value={formatBytes(stats.freeDiskBytes)} />
        {/* 録画中でも定期キャプチャーは動く。実測値の列に混ぜず、動いているときだけ足す。 */}
        {interval ? (
          <>
            <Divider />
            <Metric label="SHOT" value={shotCount(interval)} />
          </>
        ) : null}
      </div>
    )
  }

  // 録画していないときは、保存先の案内より実行中の撮影を先に伝える。
  if (interval) {
    return (
      <div className="flex h-8 shrink-0 items-center gap-2 border-t border-white/[0.06] bg-black/20 px-3">
        <Timer className="h-3.5 w-3.5 shrink-0 text-teal-300" />
        <span className="truncate text-fluid-2xs text-slate-300">
          定期キャプチャー中です。{interval.intervalSec} 秒ごとに
          <span className="tabular mx-1 rounded bg-teal-500/10 px-1.5 py-0.5 font-medium text-teal-300">
            {shotCount(interval)}
          </span>
          枚を保存しました。
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-8 shrink-0 items-center gap-2 border-t border-white/[0.06] bg-black/20 px-3">
      <Lightbulb className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      {lastResult && lastResult.filePath ? (
        <button
          onClick={onRevealResult}
          className="no-drag min-w-0 truncate text-fluid-2xs text-slate-400 transition-colors duration-150 hover:text-teal-300"
        >
          保存しました： {lastResult.filePath}
        </button>
      ) : (
        <span className="truncate text-fluid-2xs text-slate-400">{hintFor(engine)}</span>
      )}
    </div>
  )
}

/** 上限があるときは分母も出す。あと何枚で止まるかが読めないと停止操作の判断ができない。 */
function shotCount(interval: IntervalStatus): string {
  return interval.maxShots > 0 ? `${interval.shots} / ${interval.maxShots}` : `${interval.shots}`
}

function hintFor(engine: EngineState): string {
  switch (engine.status) {
    case 'launching':
    case 'connecting':
      return 'キャプチャエンジンを準備しています。しばらくお待ちください。'
    case 'error':
      // 本文と対処のボタンは上の帯が持つ。ここで繰り返さず、そこを見るよう促す。
      return 'キャプチャエンジンが停止しています。上の案内から接続をやり直せます。'
    case 'ready':
      return '［ゲーム録画］モードでは、対象を選ばなくても前面のフルスクリーンアプリを自動的に捕捉します。'
    default:
      return 'キャプチャエンジンが停止しています。'
  }
}

function Divider(): ReactElement {
  return <span className="h-4 w-px shrink-0 bg-white/[0.06]" />
}

interface MetricProps {
  label: string
  value: string
  suffix?: string
  warning?: boolean
}

function Metric({ label, value, suffix, warning }: MetricProps): ReactElement {
  return (
    <div className="flex min-w-0 flex-1 items-baseline gap-2 px-2">
      <span className="rail-label shrink-0">{label}</span>
      <span
        className={cn(
          'tabular truncate text-fluid-2xs font-medium',
          warning ? 'text-amber-300' : 'text-slate-200'
        )}
      >
        {value}
      </span>
      {suffix ? <span className="tabular text-fluid-2xs text-slate-400">{suffix}</span> : null}
    </div>
  )
}
