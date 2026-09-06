import type { ReactNode, ReactElement } from 'react'
import { cn } from '@renderer/lib/cn'

interface PanelProps {
  title: string
  /** 見出し右端に置く操作系。更新ボタンなど。 */
  action?: ReactNode
  children: ReactNode
  className?: string
}

/** インスペクタの 1 区画。見出しは小さく大文字、本体は高密度に詰める。 */
export function Panel({ title, action, children, className }: PanelProps): ReactElement {
  return (
    <section className={cn('panel flex shrink-0 flex-col', className)}>
      <header className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-white/[0.04] px-3">
        <h2 className="rail-label">{title}</h2>
        {action}
      </header>
      {/* スクロールはページ側が担当する。ここで overflow を持つと入れ子スクロールになる。 */}
      <div className="px-3 py-2.5">{children}</div>
    </section>
  )
}
