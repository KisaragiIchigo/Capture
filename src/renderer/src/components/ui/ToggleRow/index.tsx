import type { ReactElement } from 'react'
import { Switch } from '@renderer/components/ui/Switch'

interface ToggleRowProps {
  label: string
  /** 何が起きるかを推測させないため、説明は必ず添える。です・ます調で書くこと。 */
  description: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** チェックボックス相当の 1 行。ラベルと説明を左、トグルを右端に置く。 */
export function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange
}: ToggleRowProps): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-fluid-xs font-medium text-slate-200">{label}</span>
        <span className="text-fluid-xs leading-relaxed text-slate-400">{description}</span>
      </span>
      <Switch aria-label={label} checked={checked} disabled={disabled} onChange={onChange} />
    </div>
  )
}
