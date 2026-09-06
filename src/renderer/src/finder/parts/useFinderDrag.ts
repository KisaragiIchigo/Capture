import { useCallback, useRef, useState } from 'react'
import { minimumWindowSize, type WindowBounds } from '@shared/types'

/** 掴んだ場所。move は枠ごとの移動、それ以外は各辺と角のリサイズ。 */
export type DragMode = 'move' | 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

interface DragState {
  mode: DragMode
  startX: number
  startY: number
  origin: WindowBounds
}

export interface FinderDrag {
  /** 掴んでいる最中かどうか。クリックスルーの一時停止に使う。 */
  dragging: boolean
  start: (mode: DragMode, event: React.MouseEvent) => void
}

/**
 * 枠の移動とリサイズ。
 *
 * 移動を -webkit-app-region: drag に任せない。透過ウィンドウで
 * setIgnoreMouseEvents を切り替えていると、ネイティブのドラッグ領域は
 * マウス無視の状態を跨いだ瞬間に掴めなくなる。リサイズと同じ経路で扱えば、
 * クリックスルーの一時停止も含めて挙動が揃う。
 *
 * 画面座標（screenX / screenY）を基準にするのは、ウィンドウ自身が動いている最中に
 * クライアント座標を使うと、移動量が二重に効いて枠が加速度的にすっ飛ぶため。
 * 位置の更新は requestAnimationFrame でまとめ、ドラッグ中の IPC を 1 フレーム 1 回に抑える。
 */
export function useFinderDrag(): FinderDrag {
  const [dragging, setDragging] = useState(false)
  const drag = useRef<DragState | null>(null)
  const pending = useRef<WindowBounds | null>(null)
  const frame = useRef<number | null>(null)

  const flush = useCallback(() => {
    frame.current = null
    const next = pending.current
    pending.current = null
    if (next) void window.capture.finder.setBounds(next)
  }, [])

  const schedule = useCallback(
    (bounds: WindowBounds) => {
      pending.current = bounds
      if (frame.current !== null) return
      frame.current = requestAnimationFrame(flush)
    },
    [flush]
  )

  const start = useCallback(
    (mode: DragMode, event: React.MouseEvent) => {
      event.preventDefault()
      event.stopPropagation()
      setDragging(true)

      drag.current = {
        mode,
        startX: event.screenX,
        startY: event.screenY,
        origin: {
          x: window.screenX,
          y: window.screenY,
          width: window.outerWidth,
          height: window.outerHeight
        }
      }

      const minimum = minimumWindowSize()

      const handleMove = (moveEvent: MouseEvent): void => {
        const state = drag.current
        if (!state) return

        const dx = moveEvent.screenX - state.startX
        const dy = moveEvent.screenY - state.startY
        const { x, y, width, height } = state.origin

        if (state.mode === 'move') {
          schedule({ x: Math.round(x + dx), y: Math.round(y + dy), width, height })
          return
        }

        let nextX = x
        let nextY = y
        let nextWidth = width
        let nextHeight = height

        if (state.mode.includes('e')) nextWidth = width + dx
        if (state.mode.includes('s')) nextHeight = height + dy

        // 左と上を掴んだ場合は、原点を動かしつつ幅を逆向きに変える。
        if (state.mode.includes('w')) {
          nextWidth = width - dx
          nextX = x + dx
        }
        if (state.mode.includes('n')) {
          nextHeight = height - dy
          nextY = y + dy
        }

        // 最小サイズに達したら、原点がそれ以上食い込まないよう押し戻す。
        if (nextWidth < minimum.width) {
          if (state.mode.includes('w')) nextX = x + (width - minimum.width)
          nextWidth = minimum.width
        }
        if (nextHeight < minimum.height) {
          if (state.mode.includes('n')) nextY = y + (height - minimum.height)
          nextHeight = minimum.height
        }

        schedule({
          x: Math.round(nextX),
          y: Math.round(nextY),
          width: Math.round(nextWidth),
          height: Math.round(nextHeight)
        })
      }

      const handleUp = (): void => {
        drag.current = null
        setDragging(false)
        if (frame.current !== null) {
          cancelAnimationFrame(frame.current)
          flush()
        }
        window.removeEventListener('mousemove', handleMove)
        window.removeEventListener('mouseup', handleUp)
      }

      window.addEventListener('mousemove', handleMove)
      window.addEventListener('mouseup', handleUp)
    },
    [flush, schedule]
  )

  return { dragging, start }
}
