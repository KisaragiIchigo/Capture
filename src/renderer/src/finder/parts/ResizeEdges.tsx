import type { ReactElement } from 'react'
import { FINDER_OUTSET } from '@shared/types'
import type { DragMode } from './useFinderDrag'

interface ResizeEdgesProps {
  onStart: (mode: DragMode, event: React.MouseEvent) => void
}

/** 縁ごとの位置とカーソル。掴み代は録画範囲の外側にあるので、映像には影響しない。 */
const EDGES: Array<{ edge: Exclude<DragMode, 'move'>; className: string; cursor: string }> = [
  { edge: 'n', className: 'left-0 right-0 top-0', cursor: 'ns-resize' },
  { edge: 's', className: 'left-0 right-0 bottom-0', cursor: 'ns-resize' },
  { edge: 'w', className: 'top-0 bottom-0 left-0', cursor: 'ew-resize' },
  { edge: 'e', className: 'top-0 bottom-0 right-0', cursor: 'ew-resize' },
  { edge: 'nw', className: 'top-0 left-0', cursor: 'nwse-resize' },
  { edge: 'ne', className: 'top-0 right-0', cursor: 'nesw-resize' },
  { edge: 'sw', className: 'bottom-0 left-0', cursor: 'nesw-resize' },
  { edge: 'se', className: 'bottom-0 right-0', cursor: 'nwse-resize' }
]

/** 角は辺より手前に置く。重なった部分では角の判定を優先させたい。 */
const CORNER_SIZE = FINDER_OUTSET * 2

export function ResizeEdges({ onStart }: ResizeEdgesProps): ReactElement {
  return (
    <>
      {EDGES.map(({ edge, className, cursor }) => {
        const corner = edge.length === 2
        const style: React.CSSProperties = { cursor }

        if (corner) {
          style.width = CORNER_SIZE
          style.height = CORNER_SIZE
        } else if (edge === 'n' || edge === 's') {
          style.height = FINDER_OUTSET
        } else {
          style.width = FINDER_OUTSET
        }

        return (
          <div
            key={edge}
            data-interactive
            role="presentation"
            onMouseDown={(event) => onStart(edge, event)}
            style={style}
            className={`absolute ${className} ${corner ? 'z-[2]' : 'z-[1]'}`}
          />
        )
      })}
    </>
  )
}
