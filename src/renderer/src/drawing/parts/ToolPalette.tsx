import type { ReactElement, ReactNode } from 'react'
import {
  ArrowUpRight,
  Eraser,
  Highlighter,
  Minus,
  MousePointer2,
  Pencil,
  Square,
  Trash2,
  Type,
  Undo2,
  X
} from 'lucide-react'
import { DRAW_COLORS, DRAW_WIDTHS, type DrawTool } from '@shared/types'
import { cn } from '@renderer/lib/cn'

interface ToolPaletteProps {
  tool: DrawTool
  color: string
  width: number
  onToolChange: (tool: DrawTool) => void
  onColorChange: (color: string) => void
  onWidthChange: (width: number) => void
  onUndo: () => void
  onClear: () => void
  onClose: () => void
}

const TOOLS: Array<{ tool: DrawTool; label: string; icon: ReactNode }> = [
  { tool: 'select', label: '操作に戻す', icon: <MousePointer2 className="h-4 w-4" /> },
  { tool: 'pen', label: 'ペン', icon: <Pencil className="h-4 w-4" /> },
  { tool: 'marker', label: '蛍光マーカー', icon: <Highlighter className="h-4 w-4" /> },
  { tool: 'line', label: '直線', icon: <Minus className="h-4 w-4" /> },
  { tool: 'arrow', label: '矢印', icon: <ArrowUpRight className="h-4 w-4" /> },
  { tool: 'rect', label: '四角', icon: <Square className="h-4 w-4" /> },
  { tool: 'text', label: '文字', icon: <Type className="h-4 w-4" /> },
  { tool: 'eraser', label: '消しゴム', icon: <Eraser className="h-4 w-4" /> }
]

/**
 * 描画ツールの一覧。
 *
 * パレット自体はクリックを受け取る必要があるので、描画面より手前へ置く。
 * 画面の端に寄せるのは、描きたい対象の上へ被せないため。
 */
export function ToolPalette({
  tool,
  color,
  width,
  onToolChange,
  onColorChange,
  onWidthChange,
  onUndo,
  onClear,
  onClose
}: ToolPaletteProps): ReactElement {
  return (
    <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col gap-1 rounded-lg border border-white/[0.08] bg-base-alt/95 p-1.5 shadow-panel backdrop-blur-md">
      {TOOLS.map((entry) => (
        <PaletteButton
          key={entry.tool}
          label={entry.label}
          active={tool === entry.tool}
          onClick={() => onToolChange(entry.tool)}
        >
          {entry.icon}
        </PaletteButton>
      ))}

      <span className="my-0.5 h-px bg-white/[0.08]" />

      <div className="grid grid-cols-2 gap-1 px-0.5">
        {DRAW_COLORS.map((entry) => (
          <button
            key={entry}
            aria-label={`色 ${entry}`}
            title={entry}
            onClick={() => onColorChange(entry)}
            style={{ background: entry }}
            className={cn(
              'h-4 w-4 rounded-sm border transition-transform duration-150 hover:scale-110',
              color === entry ? 'border-white ring-1 ring-teal-400' : 'border-white/20'
            )}
          />
        ))}
      </div>

      <span className="my-0.5 h-px bg-white/[0.08]" />

      <div className="flex flex-col items-center gap-1">
        {DRAW_WIDTHS.map((entry) => (
          <button
            key={entry}
            aria-label={`太さ ${entry}`}
            title={`太さ ${entry}`}
            onClick={() => onWidthChange(entry)}
            className={cn(
              'flex h-5 w-8 items-center justify-center rounded transition-colors duration-150',
              width === entry ? 'bg-teal-500/20' : 'hover:bg-white/[0.06]'
            )}
          >
            <span
              className="rounded-full bg-slate-200"
              style={{ width: '1.25rem', height: Math.min(entry, 10) }}
            />
          </button>
        ))}
      </div>

      <span className="my-0.5 h-px bg-white/[0.08]" />

      <PaletteButton label="ひとつ戻す" onClick={onUndo}>
        <Undo2 className="h-4 w-4" />
      </PaletteButton>
      <PaletteButton label="すべて消す" onClick={onClear}>
        <Trash2 className="h-4 w-4" />
      </PaletteButton>
      <PaletteButton label="描画を終える" danger onClick={onClose}>
        <X className="h-4 w-4" />
      </PaletteButton>
    </div>
  )
}

interface PaletteButtonProps {
  label: string
  active?: boolean
  danger?: boolean
  onClick: () => void
  children: ReactNode
}

function PaletteButton({
  label,
  active,
  danger,
  onClick,
  children
}: PaletteButtonProps): ReactElement {
  return (
    <button
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded transition-colors duration-150',
        active
          ? 'bg-teal-500/15 text-teal-300 shadow-accent-glow'
          : danger
            ? 'text-slate-400 hover:bg-rose-500/70 hover:text-white'
            : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
      )}
    >
      {children}
    </button>
  )
}
