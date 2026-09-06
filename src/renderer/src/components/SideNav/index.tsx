import type { ReactElement, ReactNode } from 'react'
import { m } from 'framer-motion'
import { Home, Image, Info, Layers, Settings, Video } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

export type PageKey = 'home' | 'general' | 'video' | 'overlay' | 'still' | 'about'

interface SideNavProps {
  value: PageKey
  onChange: (page: PageKey) => void
}

const PAGES: Array<{ key: PageKey; label: string; icon: ReactNode }> = [
  { key: 'home', label: 'ホーム', icon: <Home className="h-4 w-4" /> },
  { key: 'general', label: '一般', icon: <Settings className="h-4 w-4" /> },
  { key: 'video', label: 'ビデオ', icon: <Video className="h-4 w-4" /> },
  { key: 'overlay', label: 'オーバーレイ', icon: <Layers className="h-4 w-4" /> },
  { key: 'still', label: '静止画', icon: <Image className="h-4 w-4" /> },
  { key: 'about', label: '情報', icon: <Info className="h-4 w-4" /> }
]

/** 設定のカテゴリ。選択中の指標は塗りではなく左端の細いラインで示す。 */
export function SideNav({ value, onChange }: SideNavProps): ReactElement {
  return (
    <nav className="flex w-[9.5rem] shrink-0 flex-col gap-0.5 border-r border-white/[0.06] bg-black/20 p-2">
      {PAGES.map((page) => {
        const active = page.key === value
        return (
          <button
            key={page.key}
            onClick={() => onChange(page.key)}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'no-drag relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors duration-150',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
              active ? 'bg-white/[0.04] text-teal-200' : 'text-slate-400 hover:bg-white/[0.02] hover:text-slate-200'
            )}
          >
            {active ? (
              <m.span
                layoutId="sidenav-indicator"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-full bg-teal-400 shadow-accent-glow"
              />
            ) : null}
            <span className={active ? 'text-teal-300' : 'text-slate-400'}>{page.icon}</span>
            <span className="text-fluid-xs font-medium">{page.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
