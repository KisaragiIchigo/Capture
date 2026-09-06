import type { ReactElement } from 'react'
import { AnimatePresence, m } from 'framer-motion'
import { AlertTriangle, RotateCcw, X } from 'lucide-react'
import { cn } from '@renderer/lib/cn'

interface ErrorBannerProps {
  message: string | null
  /**
   * エンジンを立て直す操作。エンジンが動いていないときだけ渡す。
   *
   * 起動に失敗したままではどの操作も通らないため、閉じるだけでは何も解決しない。
   * やり直せる状況にあるときは、その場で押せる場所に置く。
   */
  onRetry?: () => void
  retrying?: boolean
  onDismiss: () => void
}

/** 操作の失敗をその場で伝える帯。原因はすべて日本語の文で届く前提で、そのまま出す。 */
export function ErrorBanner({
  message,
  onRetry,
  retrying,
  onDismiss
}: ErrorBannerProps): ReactElement {
  return (
    <AnimatePresence>
      {message ? (
        <m.div
          initial={{ opacity: 0, y: -8, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -8, height: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          className="overflow-hidden px-2 pt-2"
        >
          <div className="flex items-start gap-2.5 rounded-md border border-rose-500/20 bg-rose-500/10 px-3 py-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-300" />
            <p className="flex-1 text-fluid-xs leading-relaxed text-rose-200">{message}</p>

            {onRetry ? (
              <button
                onClick={onRetry}
                disabled={retrying}
                className={cn(
                  'no-drag flex shrink-0 items-center gap-1.5 rounded border border-rose-400/25 px-2 py-1',
                  'text-fluid-2xs font-medium text-rose-200 transition-colors duration-150',
                  'hover:bg-rose-500/15 disabled:pointer-events-none disabled:opacity-40'
                )}
              >
                <RotateCcw className={cn('h-3 w-3', retrying && 'animate-spin')} />
                {retrying ? '接続しています…' : 'もう一度接続'}
              </button>
            ) : null}

            <button
              aria-label="閉じる"
              onClick={onDismiss}
              className="no-drag shrink-0 rounded p-0.5 text-rose-300/70 transition-colors duration-150 hover:text-rose-200"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </m.div>
      ) : null}
    </AnimatePresence>
  )
}
