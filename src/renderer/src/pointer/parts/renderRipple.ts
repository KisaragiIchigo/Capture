import { CLICK_RIPPLE_MS, withAlpha, type ClickRipple, type PointerSample } from '@shared/types'

/**
 * 波紋の色。project_style.json の palette.pointer_core に対応する。
 *
 * 白にしているのは、録画される映像の上に出るものだからです。色を持たせると、
 * 撮った映像にこのアプリの色が残る。押した場所を示すという役目に色は要らない。
 */
const RIPPLE_COLOR = '#ffffff'

/** 押した瞬間の輪の大きさ。カーソルの下から出てくるように見せる。 */
const START_RADIUS = 5

/** 広がり切ったときの輪の大きさ。カーソルを隠さない程度に留める。 */
const END_RADIUS = 30

/**
 * クリックの波紋を描く。
 *
 * 一定の速さで広げると機械的に見える。終わりへ向かって減速させると、
 * 押した衝撃が伝わって収まっていくように見える。
 */
export function renderRipples(
  ctx: CanvasRenderingContext2D,
  ripples: ClickRipple[],
  origin: PointerSample,
  now: number
): void {
  ctx.save()
  // 光として重ねる。暗い画面でも明るい画面でも、輪郭が背景に沈まない。
  ctx.globalCompositeOperation = 'lighter'

  for (const ripple of ripples) {
    const progress = Math.min(1, (now - ripple.at) / CLICK_RIPPLE_MS)
    // 三乗で減速させる。序盤に一気に広がり、終わりはゆっくり収まる。
    const eased = 1 - (1 - progress) ** 3

    const x = ripple.x - origin.x
    const y = ripple.y - origin.y
    const radius = START_RADIUS + (END_RADIUS - START_RADIUS) * eased
    const fade = 1 - eased

    // 外へ広がる輪。広がるほど細く薄くして、消え際を目立たせない。
    ctx.strokeStyle = withAlpha(RIPPLE_COLOR, fade * 0.8)
    ctx.lineWidth = 0.5 + 2.5 * fade
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()

    // 中心の光。輪より早く消して、押した一点を最初だけ強く示す。
    const core = 1 - Math.min(1, progress * 2)
    if (core > 0) {
      ctx.fillStyle = withAlpha(RIPPLE_COLOR, core * 0.35)
      ctx.beginPath()
      ctx.arc(x, y, START_RADIUS + 3 * eased, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  ctx.restore()
}
