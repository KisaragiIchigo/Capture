import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react'
import { DEFAULT_DRAW_TOOL, type DrawingCommand, type DrawTool } from '@shared/types'
import { ToolPalette } from './parts/ToolPalette'

/**
 * 描き込みの道具を並べる窓。
 *
 * 描画面と別の窓なのは、この窓だけを録画から外すため。除外の単位がウィンドウなので、
 * 同じ窓に置くと描いた線まで映らなくなる。
 *
 * 選択の実体はここが持ち、描画面へは指示だけを送る。選択を変えるのがここだけなので、
 * 2 つの窓で持つ値が食い違うことはない。初期値は描画面と同じ設定から読む。
 */
export function PaletteWindow(): ReactElement {
  const [tool, setTool] = useState<DrawTool>(DEFAULT_DRAW_TOOL)
  const [color, setColor] = useState<string>('#facc15')
  const [width, setWidth] = useState<number>(4)
  const ref = useRef<HTMLDivElement>(null)

  /*
   * 中身の高さを測って Main へ渡す。窓の高さはこれで決まり、報せるまで窓は表に出ない。
   * 道具の大きさはすべて固定値なので、文字の読み込みで測り直しになることはない。
   */
  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    void window.capture.drawing.paletteReady(element.offsetHeight)
  }, [])

  // 既定値は描画面と同じ設定から読む。読めなければ双方が同じ初期値のまま続く。
  useEffect(() => {
    window.capture.settings
      .load()
      .then((settings) => {
        setColor(settings.profile.drawing.color)
        setWidth(settings.profile.drawing.width)
      })
      .catch(() => {
        // 既定値で描ける。ここで止める理由はない。
      })
  }, [])

  const send = useCallback((command: DrawingCommand) => {
    void window.capture.drawing.command(command)
  }, [])

  return (
    <div ref={ref}>
      <ToolPalette
        tool={tool}
        color={color}
        width={width}
        onToolChange={(next) => {
          setTool(next)
          send({ kind: 'tool', tool: next })
        }}
        onColorChange={(next) => {
          setColor(next)
          send({ kind: 'color', color: next })
        }}
        onWidthChange={(next) => {
          setWidth(next)
          send({ kind: 'width', width: next })
        }}
        onUndo={() => send({ kind: 'undo' })}
        onClear={() => send({ kind: 'clear' })}
        onClose={() => void window.capture.drawing.close()}
      />
    </div>
  )
}
