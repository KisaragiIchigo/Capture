import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Stroke } from '@shared/types'
import { renderStrokes } from './renderStrokes'

interface DrawingCanvasProps {
  strokes: Stroke[]
  draft: Stroke | null
  markerOpacity: number
  onPointerDown: (event: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerMove: (event: React.PointerEvent<HTMLCanvasElement>) => void
  onPointerUp: (event: React.PointerEvent<HTMLCanvasElement>) => void
  cursor: string
}

/**
 * 描画面。
 *
 * canvas の実ピクセル数を CSS の表示サイズと一致させる。ずれると座標が
 * 拡大縮小され、カーソルの位置と描かれる位置が食い違う。
 * デバイスピクセル比は掛けない。全画面の canvas を 2 倍以上で持つと、
 * 描画のたびに転送量が跳ね上がって録画中のフレーム落ちにつながる。
 */
export function DrawingCanvas({
  strokes,
  draft,
  markerOpacity,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  cursor
}: DrawingCanvasProps): ReactElement {
  const ref = useRef<HTMLCanvasElement>(null)
  /** 大きさが変わったことを描き直しへ伝えるためだけの値。 */
  const [viewport, setViewport] = useState(0)

  useEffect(() => {
    const bump = (): void => setViewport((current) => current + 1)
    window.addEventListener('resize', bump)
    return () => window.removeEventListener('resize', bump)
  }, [])

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    /*
     * 実ピクセル数を表示サイズへ合わせる。width への代入は内容を消すため、
     * 描き直しと同じ場所で行う。別の効果で寸法だけ変えると、録画範囲を動かした瞬間に
     * 描いたものが消えたまま、次に線を足すまで戻らない。
     */
    if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
      canvas.width = canvas.clientWidth
      canvas.height = canvas.clientHeight
    }

    // 確定済みの後に描き途中を重ねる。順序を変えると描いている線が隠れる。
    renderStrokes(ctx, draft ? [...strokes, draft] : strokes, markerOpacity)
  }, [strokes, draft, markerOpacity, viewport])

  return (
    <canvas
      ref={ref}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{ cursor }}
      className="absolute inset-0 h-full w-full"
    />
  )
}
