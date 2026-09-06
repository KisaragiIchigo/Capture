import { useCallback, useEffect, useRef, type ReactElement } from 'react'
import {
  CLICK_RIPPLE_MS,
  MAX_TRAILS,
  MAX_TRAIL_SAMPLES,
  MIN_TRAIL_STEP,
  releaseOpacity,
  type ClickRipple,
  type PointerConfig,
  type PointerSample,
  type PointerStroke
} from '@shared/types'
import { renderPointer } from './parts/renderPointer'
import { renderRipples } from './parts/renderRipple'

/** 既定の見た目。設定が届くまではこの値で描く。 */
const DEFAULT: PointerConfig = { color: '#f43f5e', size: 18, fadeOutMs: 5000 }

/**
 * 画面に重ねる一時的な光の表示。
 *
 * レーザーポインターの軌跡と、クリックの波紋をこの 1 枚で描く。どちらも
 * 「操作を妨げずに一瞬だけ示す」ものなので、面を分ける理由がない。分けると
 * 透過ウィンドウが 1 枚増え、重なりの順序も管理することになる。
 *
 * 軌跡は本数で持つ。押すたびに描き直すと、前に指した跡が消えてしまい、
 * 「ここを見て、次はここ」と続けて示せない。前の線はそれぞれの時計で薄れていき、
 * 消え切ったものだけが落ちる。
 *
 * 位置は入力フックから画面座標で届く。窓の左上も一緒に受け取り、描くときに引く。
 * 窓はカーソルのいるモニタへ移るため、窓の中の座標で溜めると移った瞬間にずれる。
 *
 * canvas は毎フレーム描き直す。押している間の軌跡は時間で消さないが、
 * 離したあとは薄れていくため、入力が止まっていても更新を続ける必要がある。
 */
export function PointerWindow(): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const strokes = useRef<PointerStroke[]>([])
  const config = useRef<PointerConfig>({ ...DEFAULT })
  /** 窓の左上。画面座標で溜めた点を、この窓の中の位置へ直すために使う。 */
  const origin = useRef<PointerSample>({ x: 0, y: 0 })
  /** 広がっている途中の波紋。広がり切ったものは描画のたびに落とす。 */
  const ripples = useRef<ClickRipple[]>([])

  /*
   * この窓は起動時に作られたまま常駐する。読み込みは 1 度きりなので、
   * 設定を変えたあとも古い色や長さで描き続けてしまう。押されるたびに読み直す。
   */
  const reloadConfig = useCallback(() => {
    window.capture.settings
      .load()
      .then((settings) => {
        config.current = { ...settings.profile.pointer }
      })
      .catch(() => {
        // 直前の値で描ける。止める理由はない。
      })
  }, [])

  useEffect(() => reloadConfig(), [reloadConfig])

  useEffect(() => {
    /** 今まさに描いている軌跡。離した後のものは対象にしない。 */
    const drawing = (): PointerStroke | null => {
      const last = strokes.current[strokes.current.length - 1]
      return last && last.releasedAt === null ? last : null
    }

    const unsubscribers = [
      window.capture.events.onPointerStart((point) => {
        origin.current = { x: point.originX, y: point.originY }
        strokes.current.push({ points: [], releasedAt: null })

        // 消え切る前に何度も押されると際限なく溜まる。古いものから落とす。
        if (strokes.current.length > MAX_TRAILS) strokes.current.shift()
        reloadConfig()
      }),
      window.capture.events.onPointerMove((point) => {
        const stroke = drawing()
        if (!stroke) return

        origin.current = { x: point.originX, y: point.originY }

        // 止まっている間も位置は届き続ける。同じ場所へ重ねて足すと、加算で描くぶん
        // そこだけ塊になって光る。動いたと言える量だけを点として足す。
        const last = stroke.points[stroke.points.length - 1]
        if (last && Math.hypot(point.x - last.x, point.y - last.y) < MIN_TRAIL_STEP) return

        stroke.points.push({ x: point.x, y: point.y })
        if (stroke.points.length > MAX_TRAIL_SAMPLES) stroke.points.shift()
      }),
      window.capture.events.onPointerEnd(() => {
        const stroke = drawing()
        if (!stroke) return
        stroke.releasedAt = Date.now()
      }),
      window.capture.events.onPointerClick((point) => {
        // 波紋はレーザーを出していなくても起きる。原点はここでも受け取り直す。
        origin.current = { x: point.originX, y: point.originY }
        ripples.current.push({ x: point.x, y: point.y, at: Date.now() })
      })
    ]

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [reloadConfig])

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let frame = 0

    const draw = (): void => {
      frame = requestAnimationFrame(draw)

      if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
        canvas.width = canvas.clientWidth
        canvas.height = canvas.clientHeight
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const now = Date.now()
      const { x: originX, y: originY } = origin.current

      // 波紋はレーザーとは独立に消える。先に片付けてから描く。
      ripples.current = ripples.current.filter((ripple) => now - ripple.at < CLICK_RIPPLE_MS)
      if (ripples.current.length > 0) {
        renderRipples(ctx, ripples.current, origin.current, now)
      }

      /*
       * 軌跡は 1 本ずつ自分の時計で薄れる。押している間のものは releasedAt が null なので
       * 常に濃さ 1 で残り、離したものだけが薄れて、消え切ったところで落ちる。
       */
      const alive: PointerStroke[] = []

      for (const stroke of strokes.current) {
        const fade = releaseOpacity(stroke.releasedAt, now, config.current.fadeOutMs)
        if (fade <= 0) continue

        alive.push(stroke)
        if (stroke.points.length === 0) continue

        // 溜めてあるのは画面座標。窓の左上を引いて、この窓の中の位置へ直す。
        const points = stroke.points.map((sample) => ({
          x: sample.x - originX,
          y: sample.y - originY
        }))

        renderPointer(ctx, points, config.current, fade)
      }

      strokes.current = alive
    }

    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
}
