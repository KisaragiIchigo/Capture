import type { ReactElement } from 'react'
import * as RadixSelect from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export interface SelectOption {
  value: string
  label: string
  disabled?: boolean
  /** 選択できない理由。です・ます調で書き、項目の下に薄く添える。 */
  note?: string
}

interface SelectProps {
  value: string
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
}

/** 背景へ沈み込む井戸型のセレクト。フォーカスでティールの縁に遷移する。 */
export function Select({
  value,
  options,
  placeholder = '選択してください',
  disabled,
  onChange,
  className
}: SelectProps): ReactElement {
  return (
    <RadixSelect.Root value={value} onValueChange={onChange} disabled={disabled}>
      <RadixSelect.Trigger
        className={cn(
          'well well-focus no-drag flex h-8 w-full items-center justify-between gap-2 px-2.5',
          'text-fluid-xs text-slate-200 data-[placeholder]:text-slate-400',
          'disabled:pointer-events-none disabled:opacity-[0.35]',
          className
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </RadixSelect.Icon>
      </RadixSelect.Trigger>

      <RadixSelect.Portal>
        <RadixSelect.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'z-50 max-h-72 min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-md',
            'border border-white/[0.08] bg-base-alt/95 shadow-panel backdrop-blur-md'
          )}
        >
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-default select-none flex-col gap-0.5 rounded px-2 py-1.5 pr-7',
                  'text-fluid-xs text-slate-300 outline-none',
                  'data-[highlighted]:bg-teal-500/10 data-[highlighted]:text-teal-200',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-[0.35]'
                )}
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
                {option.note ? (
                  <span className="text-fluid-2xs text-slate-400">{option.note}</span>
                ) : null}
                <RadixSelect.ItemIndicator className="absolute right-2 top-1.5">
                  <Check className="h-3.5 w-3.5 text-teal-300" />
                </RadixSelect.ItemIndicator>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  )
}
