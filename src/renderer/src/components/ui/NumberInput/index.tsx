import { useEffect, useState, type ReactElement } from 'react'
import { cn } from '@renderer/lib/cn'

interface NumberInputProps {
  value: number
  min?: number
  max?: number
  step?: number
  suffix?: string
  disabled?: boolean
  onChange: (value: number) => void
  'aria-label': string
  className?: string
}

/**
 * 井戸型の数値入力。
 *
 * 入力途中の文字列をローカルに持つのは、"12" を消して "8" を打つ途中の空文字で
 * 親の値が 0 に飛ぶのを避けるため。確定（blur / Enter）でのみ親へ返す。
 */
export function NumberInput({
  value,
  min,
  max,
  step = 1,
  suffix,
  disabled,
  onChange,
  'aria-label': ariaLabel,
  className
}: NumberInputProps): ReactElement {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => {
    setDraft(String(value))
  }, [value])

  const commit = (): void => {
    const parsed = Number(draft)
    if (!Number.isFinite(parsed)) {
      setDraft(String(value))
      return
    }
    const clamped = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? -Number.MAX_SAFE_INTEGER, Math.round(parsed / step) * step))
    setDraft(String(clamped))
    if (clamped !== value) onChange(clamped)
  }

  return (
    <div
      className={cn(
        'well well-focus no-drag flex h-8 items-center gap-1.5 px-2.5 focus-within:border-teal-500/50',
        disabled && 'pointer-events-none opacity-[0.35]',
        className
      )}
    >
      <input
        type="text"
        inputMode="numeric"
        aria-label={ariaLabel}
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur()
        }}
        className="tabular w-full bg-transparent text-fluid-xs text-slate-200 outline-none"
      />
      {suffix ? <span className="text-fluid-2xs text-slate-400">{suffix}</span> : null}
    </div>
  )
}
