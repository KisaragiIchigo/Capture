import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { DEFAULT_DRAW_TOOL, MIN_SHAPE_DISTANCE, type DrawTool, type Point } from '@shared/types'
import { useClickThrough } from '@renderer/hooks/useClickThrough'
import { DrawingCanvas } from './parts/DrawingCanvas'
import { useStrokes } from './parts/useStrokes'

/** ツールごとのカーソル。何が起きるかを触る前に伝える。 */
const CURSOR: Record<DrawTool, string> = {
  select: 'default',
  pen: 'crosshair',
  marker: 'crosshair',
  line: 'crosshair',
  arrow: 'crosshair',
  rect: 'crosshair',
  text: 'text',
  eraser: 'cell'
}

interface TextDraft {
  point: Point
  value: string
}

/**
 * 画面へ直接描き込む窓。
 *
 * 録画される範囲を覆う透過ウィンドウで、ここに描いた内容はそのまま録画へ写る。
 * 道具のパレットは別の窓にある。パレットを録画から外すには窓ごと分けるしかなく、
 * ここに置くと描いた線まで映らなくなるため。選択の変更はパレットから指示として届く。
 *
 * 描画中は下のアプリを操作できない。操作へ戻すにはパレットで「操作に戻す」を選ぶか
 * 窓を閉じる。「操作に戻す」の間はこの窓自体をクリックスルーさせる。
 */
export function DrawingWindow(): ReactElement {
  const [tool, setTool] = useState<DrawTool>(DEFAULT_DRAW_TOOL)
  const [color, setColor] = useState<string>('#facc15')
  const [width, setWidth] = useState<number>(4)
  const [markerOpacity, setMarkerOpacity] = useState(0.6)
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null)
  /** 押している間はクリックスルーの切り替えを止める。切り替わると pointerup を取り逃す。 */
  const [pressing, setPressing] = useState(false)

  const strokes = useStrokes()

  // 開いた瞬間から描けるよう、受け取る側で始める。無視で始めると最初の 1 クリックが下へ抜ける。
  useClickThrough(pressing, false)

  // 描画の設定はメイン側の設定を引き継ぐ。読めなければ初期値のまま続ける。
  useEffect(() => {
    window.capture.settings
      .load()
      .then((settings) => {
        const drawing = settings.profile.drawing
        setColor(drawing.color)
        setWidth(drawing.width)
        setMarkerOpacity(drawing.markerOpacity)
      })
      .catch(() => {
        // 既定値で描ける。ここで止める理由はない。
      })
  }, [])

  const close = useCallback(() => {
    void window.capture.drawing.close()
  }, [])

  // パレットからの指示。選択の実体はパレットが持ち、ここは受け取って反映するだけ。
  useEffect(
    () =>
      window.capture.events.onDrawingCommand((command) => {
        switch (command.kind) {
          case 'tool':
            setTool(command.tool)
            return
          case 'color':
            setColor(command.color)
            return
          case 'width':
            setWidth(command.width)
            return
          case 'undo':
            strokes.undo()
            return
          case 'clear':
            strokes.clear()
        }
      }),
    [strokes.undo, strokes.clear]
  )

  // Esc で閉じる。録画範囲を覆う窓なので、抜ける手段が常に要る。
  useEffect(() => {
    const handleKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !textDraft) close()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [close, textDraft])

  const toPoint = (event: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const handleDown = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (tool === 'select') return

    const point = toPoint(event)

    if (tool === 'text') {
      /*
       * pointerdown の既定動作には focus の移動が含まれる。React は押下のような
       * 操作由来の更新をその場で流すため、入力欄は既定動作より先に現れて focus を取り、
       * 直後の focus 移動で blur して自分の onBlur で閉じる。入力欄が一度も
       * 出てこないように見えるのはこれが原因なので、文字のときだけ既定動作を止める。
       *
       * 窓の前面化は OS が押下の時点で済ませているため、これで奪われることはない。
       * 文字は引きずらないので、ポインタの捕捉も要らない。
       */
      event.preventDefault()

      // 既定動作を止めているぶん blur も起きない。入力欄が開いたまま別の場所を押されたら、
      // 書きかけを黙って捨てずにここで確定してから次を開く。
      if (textDraft) strokes.addText(color, width, textDraft.point, textDraft.value)
      setTextDraft({ point, value: '' })
      return
    }

    // 引きずる操作は canvas の外へ出ても追いたい。
    event.currentTarget.setPointerCapture(event.pointerId)
    setPressing(true)

    if (tool === 'eraser') {
      strokes.eraseAt(point)
      return
    }

    strokes.begin(tool, color, width, point)
  }

  const handleMove = (event: React.PointerEvent<HTMLCanvasElement>): void => {
    if (event.buttons === 0) return

    const point = toPoint(event)
    if (tool === 'eraser') {
      strokes.eraseAt(point)
      return
    }
    strokes.extend(point)
  }

  const handleUp = (): void => {
    setPressing(false)
    if (!strokes.draft) return

    // 図形はクリックだけで確定させない。点のような矩形や矢印が残ると邪魔になる。
    const points = strokes.draft.points
    const first = points[0]
    const last = points[points.length - 1]
    const isShape =
      strokes.draft.tool === 'line' ||
      strokes.draft.tool === 'arrow' ||
      strokes.draft.tool === 'rect'

    if (isShape && first && last && Math.hypot(last.x - first.x, last.y - first.y) < MIN_SHAPE_DISTANCE) {
      strokes.cancel()
      return
    }

    strokes.commit()
  }

  /*
   * 「操作に戻す」の間だけ印を外し、窓ごとクリックスルーさせる。
   * 常に受け取ると、描画を閉じるまで録画範囲の中のアプリを一切触れなくなる。
   */
  return (
    <div className="relative h-full w-full" data-interactive={tool === 'select' ? undefined : true}>
      <DrawingCanvas
        strokes={strokes.strokes}
        draft={strokes.draft}
        markerOpacity={markerOpacity}
        onPointerDown={handleDown}
        onPointerMove={handleMove}
        onPointerUp={handleUp}
        cursor={CURSOR[tool]}
      />

      {textDraft ? (
        <textarea
          autoFocus
          value={textDraft.value}
          onChange={(event) => setTextDraft({ ...textDraft, value: event.target.value })}
          onBlur={() => {
            strokes.addText(color, width, textDraft.point, textDraft.value)
            setTextDraft(null)
          }}
          onKeyDown={(event) => {
            // Enter で確定。改行は Shift を添えて入れる。
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              event.currentTarget.blur()
            }
            if (event.key === 'Escape') {
              event.preventDefault()
              setTextDraft(null)
            }
          }}
          style={{
            left: textDraft.point.x,
            top: textDraft.point.y,
            color,
            fontSize: Math.max(14, width * 6)
          }}
          className="absolute min-w-[12rem] resize-none rounded border border-teal-400/60 bg-black/70 px-2 py-1 font-sans outline-none"
        />
      ) : null}
    </div>
  )
}
