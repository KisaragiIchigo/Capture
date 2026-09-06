import type { ReactElement } from 'react'
import * as RadixSwitch from '@radix-ui/react-switch'
import { cn } from '@renderer/lib/cn'

interface SwitchProps {
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
  'aria-label': string
}

/** 小さめのトグル。オンのときだけティールのグローを背後に置く。 */
export function Switch({
  checked,
  disabled,
  onChange,
  'aria-label': ariaLabel
}: SwitchProps): ReactElement {
  return (
    <RadixSwitch.Root
      checked={checked}
      disabled={disabled}
      onCheckedChange={onChange}
      aria-label={ariaLabel}
      className={cn(
        'no-drag relative h-[18px] w-8 shrink-0 rounded-full border transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
        'disabled:pointer-events-none disabled:opacity-[0.35]',
        checked
          ? 'border-teal-400/40 bg-teal-600/40 shadow-accent-glow'
          : 'border-white/[0.08] bg-black/40 shadow-inset-well'
      )}
    >
      <RadixSwitch.Thumb
        className={cn(
          'block h-3 w-3 translate-x-[3px] rounded-full transition-transform duration-200',
          'data-[state=checked]:translate-x-[17px]',
          checked ? 'bg-teal-100' : 'bg-slate-500'
        )}
      />
    </RadixSwitch.Root>
  )
}
