import type { ReactElement } from 'react'
import type { OverlayAnchor } from '@shared/types'
import { cn } from '@renderer/lib/cn'

interface AnchorPickerProps {
  value: OverlayAnchor
  disabled?: boolean
  onChange: (anchor: OverlayAnchor) => void
}

/** 9 分割の並び。画面上の位置とボタンの位置が一致するよう、行優先で並べる。 */
const ANCHORS: OverlayAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
]

const LABEL: Record<OverlayAnchor, string> = {
  'top-left': '左上',
  'top-center': '上中央',
  'top-right': '右上',
  'middle-left': '左中央',
  'middle-center': '中央',
  'middle-right': '右中央',
  'bottom-left': '左下',
  'bottom-center': '下中央',
  'bottom-right': '右下'
}

/**
 * 配置を 9 分割で選ぶ。
 * 画面の縮図として見せることで、座標を意識せずに位置を決められる。
 */
export function AnchorPicker({ value, disabled, onChange }: AnchorPickerProps): ReactElement {
  return (
    <div
      role="radiogroup"
      aria-label="配置"
      className={cn(
        'grid aspect-video w-[7.5rem] grid-cols-3 grid-rows-3 gap-px overflow-hidden rounded border border-white/[0.08] bg-black/40 p-px shadow-inset-well',
        disabled && 'pointer-events-none opacity-[0.35]'
      )}
    >
      {ANCHORS.map((anchor) => {
        const active = anchor === value
        return (
          <button
            key={anchor}
            role="radio"
            aria-checked={active}
            aria-label={LABEL[anchor]}
            title={LABEL[anchor]}
            onClick={() => onChange(anchor)}
            className={cn(
              'no-drag flex items-center justify-center rounded-[2px] transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
              active ? 'bg-teal-500/25' : 'bg-white/[0.02] hover:bg-white/[0.06]'
            )}
          >
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-[1px]',
                active ? 'bg-teal-300 shadow-accent-glow' : 'bg-slate-600'
              )}
            />
          </button>
        )
      })}
    </div>
  )
}
