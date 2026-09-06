import type { ReactElement } from 'react'
import * as RadixSlider from '@radix-ui/react-slider'
import { cn } from '@renderer/lib/cn'

interface SliderProps {
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  onChange: (value: number) => void
  className?: string
}

/** 極細トラックのスライダー。つまみは小さく、掴んだときだけティールで発光する。 */
export function Slider({
  value,
  min,
  max,
  step = 1,
  disabled,
  onChange,
  className
}: SliderProps): ReactElement {
  return (
    <RadixSlider.Root
      className={cn(
        'no-drag relative flex h-4 w-full touch-none select-none items-center',
        disabled && 'pointer-events-none opacity-[0.35]',
        className
      )}
      value={[value]}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onValueChange={(next) => {
        const head = next[0]
        if (head !== undefined) onChange(head)
      }}
    >
      <RadixSlider.Track className="relative h-[3px] w-full grow overflow-hidden rounded-full bg-black/50 shadow-inset-well">
        <RadixSlider.Range className="absolute h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500" />
      </RadixSlider.Track>
      <RadixSlider.Thumb
        className={cn(
          'block h-3 w-3 rounded-full border border-teal-300/50 bg-slate-200 transition-shadow duration-150',
          'hover:shadow-accent-glow focus-visible:shadow-accent-glow focus-visible:outline-none',
          'active:shadow-accent-glow'
        )}
        aria-label="値"
      />
    </RadixSlider.Root>
  )
}
