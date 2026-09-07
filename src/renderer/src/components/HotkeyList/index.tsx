import type { ReactElement } from 'react'
import { isSameHotkey, type HotkeyAction, type HotkeyBinding, type HotkeyConfig } from '@shared/types'
import { HotkeyInput } from '@renderer/components/ui/HotkeyInput'

export interface HotkeyEntry {
  action: HotkeyAction
  label: string
}

interface HotkeyListProps {
  entries: HotkeyEntry[]
  hotkeys: HotkeyConfig
  disabled?: boolean
  onChange: (action: HotkeyAction, binding: HotkeyBinding | null) => void
}

/**
 * ホットキーの一覧と編集。
 *
 * 重複はここで見つけて印を付ける。同じ入力が 2 つの操作に割り当たっていると、
 * どちらが働くか分からないまま「たまに効かない」という形で表面化する。
 */
export function HotkeyList({
  entries,
  hotkeys,
  disabled,
  onChange
}: HotkeyListProps): ReactElement {
  const isConflicted = (action: HotkeyAction): boolean => {
    const target = hotkeys[action]
    if (!target) return false

    return (Object.keys(hotkeys) as HotkeyAction[]).some(
      (other) => other !== action && isSameHotkey(hotkeys[other], target)
    )
  }

  const hasConflict = entries.some((entry) => isConflicted(entry.action))

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => (
        <div
          key={entry.action}
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5"
        >
          <span className="min-w-[11rem] flex-1 text-fluid-xs text-slate-300">{entry.label}</span>
          <HotkeyInput
            aria-label={entry.label}
            value={hotkeys[entry.action]}
            conflicted={isConflicted(entry.action)}
            disabled={disabled}
            onChange={(binding) => onChange(entry.action, binding)}
          />
        </div>
      ))}

      <p className="text-fluid-xs leading-relaxed text-slate-400">
        欄をクリックしてから、割り当てたいキーかマウスのボタンを押してください。
        Ctrl や Shift を押しながら押すと、組み合わせで登録できます。マウスのサイドボタンや、
        修飾キーだけを押して離した場合の単体指定にも対応しています。Esc で取り消せます。
        {hasConflict ? (
          <span className="text-amber-300">
            {' '}
            オレンジ色の項目は、他の操作と同じ入力が割り当てられています。
          </span>
        ) : null}
      </p>
    </div>
  )
}
