import type { ReactNode, ReactElement } from 'react'
import { cn } from '@renderer/lib/cn'

interface FieldProps {
  label: string
  /** 補足説明。です・ます調で書くこと。視認性のため text-xs 以上・透過なしで描く。 */
  description?: string
  /** ラベル右端に出す現在値。数値は等幅で桁を揃える。 */
  readout?: ReactNode
  /** コントロールを持たず、ラベルと readout だけの行にすることもある。 */
  children?: ReactNode
  className?: string
}

/** ラベル + 値表示 + コントロール + 説明の 1 行ぶん。 */
export function Field({
  label,
  description,
  readout,
  children,
  className
}: FieldProps): ReactElement {
  return (
    <div className={cn('flex flex-col gap-1.5 py-1.5', className)}>
      <div className="flex min-h-[1.25rem] items-center justify-between gap-3">
        <span className="rail-label">{label}</span>
        {readout}
      </div>
      {children}
      {description ? (
        <p className="text-fluid-xs leading-relaxed text-slate-400">{description}</p>
      ) : null}
    </div>
  )
}

interface ReadoutProps {
  children: ReactNode
  /** 注意を引きたい値（ドロップ発生など）を暖色へ寄せる。 */
  tone?: 'accent' | 'warning' | 'muted'
}

/** 数値バッジ。上品に発光させ、桁が変わっても幅が動かないよう等幅で描く。 */
export function Readout({ children, tone = 'accent' }: ReadoutProps): ReactElement {
  return (
    <span
      className={cn(
        'tabular rounded px-1.5 py-0.5 text-fluid-2xs font-medium',
        tone === 'accent' && 'bg-teal-500/10 text-teal-300',
        tone === 'warning' && 'bg-amber-500/10 text-amber-300',
        tone === 'muted' && 'bg-white/[0.04] text-slate-400'
      )}
    >
      {children}
    </span>
  )
}
