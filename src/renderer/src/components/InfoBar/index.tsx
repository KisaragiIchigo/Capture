import type { ReactElement } from 'react'
import type {
  CaptureProfile,
  DisplaySource,
  EngineState,
  RecordingStats,
  WindowSource
} from '@shared/types'
import { cn } from '@renderer/lib/cn'
import { formatBytes, formatTimecode } from '@renderer/lib/format'

interface InfoBarProps {
  profile: CaptureProfile
  displays: DisplaySource[]
  windows: WindowSource[]
  engine: EngineState
  stats: RecordingStats | null
}

/**
 * いま何を録るのかを常に 1 行で示す帯。
 * モードを切り替えたときにここだけ見れば対象が確認できる状態を保つ。
 */
export function InfoBar({ profile, displays, windows, engine, stats }: InfoBarProps): ReactElement {
  const isActive = engine.status === 'recording' || engine.status === 'paused'

  return (
    <div className="flex h-8 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-black/20 px-3.5">
      <span className="tabular min-w-0 truncate text-fluid-2xs text-slate-300">
        {describeTarget(profile, displays, windows)}
      </span>

      {isActive && stats ? (
        <span className="flex shrink-0 items-center gap-2.5">
          <span className="tabular text-fluid-2xs text-slate-200">
            {formatTimecode(stats.durationMs)}
          </span>
          <span className="text-slate-600">·</span>
          <span className="tabular text-fluid-2xs text-slate-400">
            {formatBytes(stats.bytesWritten)}
          </span>
          <span
            className={cn(
              'h-1.5 w-1.5 rounded-full bg-tally-rec',
              engine.status === 'recording' ? 'animate-tally-breathe' : 'opacity-40'
            )}
          />
        </span>
      ) : null}
    </div>
  )
}

/** モードごとに意味のある情報を組み立てる。Bandicam の座標表示にあたる部分。 */
function describeTarget(
  profile: CaptureProfile,
  displays: DisplaySource[],
  windows: WindowSource[]
): string {
  switch (profile.sourceKind) {
    case 'display': {
      const monitor = resolveMonitor(profile, displays)
      if (!monitor) return 'モニタが選択されていません'
      return `${monitor.label} — ${monitor.width}×${monitor.height} @ ${monitor.x}, ${monitor.y}`
    }
    case 'region': {
      const region = profile.region
      if (!region) return '録画する範囲が指定されていません'
      const right = region.x + region.width
      const bottom = region.y + region.height
      return `${region.width}×${region.height} — (${region.x}, ${region.y}), (${right}, ${bottom})`
    }
    case 'window': {
      const target = windows.find((w) => w.id === profile.sourceId)
      if (!target) return 'ウィンドウが選択されていません'
      return `${target.title || target.executable} — ${target.executable}`
    }
    case 'game': {
      if (!profile.sourceId) return 'ゲーム録画 — 自動（前面のフルスクリーン）'
      const target = windows.find((w) => w.id === profile.sourceId)
      return `ゲーム録画 — ${target?.title || target?.executable || '選択中のウィンドウ'}`
    }
  }
}

function resolveMonitor(
  profile: CaptureProfile,
  displays: DisplaySource[]
): DisplaySource | undefined {
  return (
    displays.find((d) => d.id === profile.sourceId) ??
    displays.find((d) => d.isPrimary) ??
    displays[0]
  )
}
