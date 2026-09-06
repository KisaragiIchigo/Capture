import type { ReactElement, ReactNode } from 'react'
import { HelpCircle, Minus, Square, X } from 'lucide-react'
import type { EngineState } from '@shared/types'
import { cn } from '@renderer/lib/cn'

interface TitleBarProps {
  engine: EngineState
  onOpenHelp: () => void
}

/** エンジン状態ごとの表示文言と色。録画中だけタリーの赤を使う。 */
const STATUS_PRESENTATION: Record<
  EngineState['status'],
  { label: string; dot: string; text: string }
> = {
  idle: { label: '停止中', dot: 'bg-slate-600', text: 'text-slate-400' },
  launching: { label: 'エンジン起動中', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' },
  connecting: { label: '接続中', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' },
  ready: { label: '待機', dot: 'bg-teal-400 shadow-accent-glow', text: 'text-teal-300' },
  recording: {
    label: '録画中',
    dot: 'bg-tally-rec animate-tally-breathe',
    text: 'text-rose-300'
  },
  paused: { label: '一時停止', dot: 'bg-tally-pause', text: 'text-amber-300' },
  stopping: { label: '停止処理中', dot: 'bg-amber-400 animate-pulse', text: 'text-amber-300' },
  error: { label: 'エラー', dot: 'bg-rose-500', text: 'text-rose-300' }
}

/**
 * 枠なしウィンドウのタイトルバー。
 * 背景全体をドラッグ領域にし、ボタンにだけ no-drag を当てる。逆にすると窓が動かせなくなる。
 */
export function TitleBar({ engine, onOpenHelp }: TitleBarProps): ReactElement {
  const presentation = STATUS_PRESENTATION[engine.status]

  return (
    <header className="drag-region flex h-10 shrink-0 items-center justify-between border-b border-white/[0.06] bg-base-alt/60 pl-4 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="font-display text-fluid-sm font-semibold tracking-widestest text-slate-200">
          CAPTURE
        </span>
        <span className="h-3 w-px bg-white/[0.08]" />
        <span className="flex items-center gap-1.5">
          <span className={cn('h-1.5 w-1.5 rounded-full', presentation.dot)} />
          <span className={cn('text-fluid-2xs uppercase tracking-wider', presentation.text)}>
            {presentation.label}
          </span>
        </span>
        {engine.backendVersion ? (
          <span className="tabular text-fluid-2xs text-slate-400">
            engine {engine.backendVersion}
          </span>
        ) : null}
      </div>

      <div className="no-drag flex h-full items-center gap-1 pr-1">
        {/*
          使い方はウィンドウの操作より前に置く。窓を閉じる並びに混ぜると、
          閉じるつもりで開いてしまう。丸で囲って役割の違いを形で示す。
        */}
        <button
          aria-label="使い方"
          title="使い方"
          onClick={onOpenHelp}
          className="flex h-7 w-7 items-center justify-center rounded-full border border-white/[0.08] text-slate-400 transition-colors duration-150 hover:border-teal-500/40 hover:bg-teal-500/10 hover:text-teal-300"
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="no-drag flex h-full items-stretch">
        <WindowButton label="最小化" onClick={() => void window.capture.window.minimize()}>
          <Minus className="h-3.5 w-3.5" />
        </WindowButton>
        <WindowButton
          label="最大化"
          onClick={() => void window.capture.window.toggleMaximize()}
        >
          <Square className="h-3 w-3" />
        </WindowButton>
        <WindowButton label="閉じる" danger onClick={() => void window.capture.window.close()}>
          <X className="h-3.5 w-3.5" />
        </WindowButton>
      </div>
    </header>
  )
}

interface WindowButtonProps {
  label: string
  danger?: boolean
  onClick: () => void
  children: ReactNode
}

function WindowButton({ label, danger, onClick, children }: WindowButtonProps): ReactElement {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={cn(
        'flex w-11 items-center justify-center text-slate-400 transition-colors duration-150',
        danger ? 'hover:bg-rose-500/80 hover:text-white' : 'hover:bg-white/[0.06] hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}
