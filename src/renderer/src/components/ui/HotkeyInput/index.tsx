import { useEffect, useState, type ReactElement } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { formatHotkey, type HotkeyBinding } from '@shared/types'
import { cn } from '@renderer/lib/cn'

interface HotkeyInputProps {
  value: HotkeyBinding | null
  disabled?: boolean
  /** 他の操作と同じ入力が割り当てられている場合に警告を出す。 */
  conflicted?: boolean
  onChange: (binding: HotkeyBinding | null) => void
  'aria-label': string
}

/**
 * 入力を実際に押して割り当てる欄。
 *
 * 記録は Main 側の低レベルフックで行う。ブラウザのキーイベントでは
 * マウスのサイドボタンを拾えず、修飾キー単体も押した瞬間には判別できないため。
 * 記録中は照合が止まるので、F9 を割り当てようとして録画が始まることはない。
 */
export function HotkeyInput({
  value,
  disabled,
  conflicted,
  onChange,
  'aria-label': ariaLabel
}: HotkeyInputProps): ReactElement {
  const [recording, setRecording] = useState(false)

  useEffect(() => {
    if (!recording) return

    void window.capture.settings.beginHotkeyCapture()

    const unsubscribe = window.capture.events.onHotkeyCaptured((binding) => {
      onChange(binding)
      setRecording(false)
    })

    // Esc は記録の取り消しに使う。割り当ての対象にはしない。
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setRecording(false)
    }
    window.addEventListener('keydown', handleKey, true)

    return () => {
      unsubscribe()
      window.removeEventListener('keydown', handleKey, true)
      void window.capture.settings.cancelHotkeyCapture()
    }
  }, [recording, onChange])

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {conflicted ? (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" aria-label="他の操作と重複しています" />
      ) : null}

      <button
        type="button"
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setRecording(true)}
        className={cn(
          'no-drag tabular min-w-[9rem] rounded border px-2 py-1 text-fluid-2xs transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
          'disabled:pointer-events-none disabled:opacity-[0.35]',
          recording
            ? 'animate-pulse border-teal-500/50 bg-teal-500/10 text-teal-200 shadow-accent-glow'
            : conflicted
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
              : 'border-white/[0.08] bg-black/40 text-slate-300 shadow-inset-well hover:border-teal-500/30 hover:text-slate-200'
        )}
      >
        {recording ? 'キーかボタンを押す' : formatHotkey(value)}
      </button>

      <button
        type="button"
        aria-label={`${ariaLabel}の割り当てを解除`}
        disabled={disabled || value === null}
        onClick={() => onChange(null)}
        className={cn(
          'no-drag rounded p-1 text-slate-500 transition-colors duration-150 hover:text-rose-300',
          'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
          'disabled:pointer-events-none disabled:opacity-[0.25]'
        )}
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
