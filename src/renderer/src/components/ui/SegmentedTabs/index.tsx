import type { ReactNode, ReactElement } from 'react'
import { m } from 'framer-motion'
import { cn } from '@renderer/lib/cn'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
  icon?: ReactNode
}

interface SegmentedTabsProps<T extends string> {
  value: T
  options: Array<SegmentedOption<T>>
  onChange: (value: T) => void
  /** レイアウトアニメーションの識別子。同一画面に複数置くときは必ず別の値にする。 */
  layoutGroup: string
  disabled?: boolean
  className?: string
}

/**
 * 選択中の背景が layoutId で滑らかに移動するセグメント。
 * 背景を都度フェードさせるのではなく 1 枚を動かすことで、切り替えが 1 つの動きとして読める。
 */
export function SegmentedTabs<T extends string>({
  value,
  options,
  onChange,
  layoutGroup,
  disabled,
  className
}: SegmentedTabsProps<T>): ReactElement {
  return (
    <div
      role="tablist"
      className={cn(
        'no-drag flex items-center gap-0.5 rounded-md border border-white/[0.06] bg-black/30 p-0.5',
        disabled && 'pointer-events-none opacity-[0.35]',
        className
      )}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative flex flex-1 items-center justify-center gap-1.5 rounded-[5px] px-2 py-1.5',
              'text-fluid-2xs font-medium tracking-wide whitespace-nowrap transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
              active ? 'text-teal-200' : 'text-slate-400 hover:text-slate-300'
            )}
          >
            {active ? (
              <m.span
                layoutId={`segmented-${layoutGroup}`}
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-[5px] border border-teal-500/25 bg-teal-500/10 shadow-accent-glow"
              />
            ) : null}
            <span className="relative z-[1] flex items-center gap-1.5">
              {option.icon}
              {option.label}
            </span>
          </button>
        )
      })}
    </div>
  )
}
