import { TRAIL_WIDTH_RATIO, withAlpha, type PointerConfig, type PointerSample } from '@shared/types'

/**
 * 芯の色。中心が色を失って白く飛ぶ見え方が、光として見えるかどうかを分ける。
 * project_style.json の palette.pointer_core に対応する。
 */
const CORE_COLOR = '#ffffff'

/**
 * 軌跡に重ねる層。外側ほど太く薄く、内側ほど細く濃くする。
 *
 * 太さは軌跡の基準幅に対する倍率、濃さはそのまま不透明度として使う。
 * 1 本のパスを太さだけ変えて重ねるので、線の形は完全に一致する。
 */
const TRAIL_LAYERS: Array<{ scale: number; alpha: number; color: string | null }> = [
  { scale: 3.0, alpha: 0.07, color: null },
  { scale: 1.8, alpha: 0.12, color: null },
  { scale: 1.0, alpha: 0.45, color: null },
  { scale: 0.34, alpha: 0.9, color: CORE_COLOR }
]

/** 光点の広がり。色が残る範囲が設定した直径と一致するよう、外側の滲みぶんを足した半径にする。 */
const HEAD_RADIUS_SCALE = 1.25

/**
 * 軌跡を 1 本の連続したパスとして引く。
 *
 * 区間ごとに stroke() を分けると、丸い線端が継ぎ目で重なって二重に合成され、
 * 点を打った位置そのものが玉として浮き出る。1 本に繋いで一度に引けば起きない。
 *
 * 通過点をそのまま結ぶと折れ線になるため、点を制御点にして中点どうしを繋ぐ。
 * これで曲がり角が丸まり、手で振った軌跡らしく見える。
 */
function traceTrail(ctx: CanvasRenderingContext2D, points: PointerSample[]): void {
  const head = points[0]
  if (!head) return

  ctx.beginPath()
  ctx.moveTo(head.x, head.y)

  for (let i = 1; i < points.length - 1; i += 1) {
    const control = points[i]
    const next = points[i + 1]
    if (!control || !next) continue
    ctx.quadraticCurveTo(control.x, control.y, (control.x + next.x) / 2, (control.y + next.y) / 2)
  }

  const last = points[points.length - 1]
  if (last) ctx.lineTo(last.x, last.y)
}

/**
 * 先端の光点。
 *
 * 単色の丸だと「点」にしか見えない。中心を白く飛ばし、外へ向かって色を残しながら
 * 抜けていく段階を作ると、光が滲んで見える。
 */
function drawHead(
  ctx: CanvasRenderingContext2D,
  head: PointerSample,
  color: string,
  size: number,
  fade: number
): void {
  const radius = size * HEAD_RADIUS_SCALE
  const gradient = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, radius)

  gradient.addColorStop(0, withAlpha(CORE_COLOR, 1))
  gradient.addColorStop(0.16, withAlpha(CORE_COLOR, 0.92))
  // ここまでが色の残る範囲。0.4 × radius が設定した直径の半分にあたる。
  gradient.addColorStop(0.4, withAlpha(color, 0.85))
  gradient.addColorStop(0.7, withAlpha(color, 0.22))
  gradient.addColorStop(1, withAlpha(color, 0))

  ctx.globalAlpha = fade
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(head.x, head.y, radius, 0, Math.PI * 2)
  ctx.fill()
}

/**
 * 軌跡と光点を描く。
 *
 * 合成を加算にしてあるのは、光が重なった所ほど明るくなる見え方を作るため。
 * 窓そのものは透過ウィンドウとして通常どおり画面に重なるので、
 * 明るい背景の上で白飛びすることはない。加算が効くのはこの canvas の中だけ。
 */
export function renderPointer(
  ctx: CanvasRenderingContext2D,
  points: PointerSample[],
  config: PointerConfig,
  fade: number
): void {
  const head = points[points.length - 1]
  if (!head) return

  const { color, size } = config
  const trailWidth = size * TRAIL_WIDTH_RATIO

  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  if (points.length > 1) {
    // パスは 1 度だけ組み、太さと濃さを変えながら同じ形を重ねて引く。
    traceTrail(ctx, points)

    for (const layer of TRAIL_LAYERS) {
      ctx.strokeStyle = layer.color ?? color
      ctx.globalAlpha = layer.alpha * fade
      ctx.lineWidth = Math.max(1, trailWidth * layer.scale)
      ctx.stroke()
    }
  }

  drawHead(ctx, head, color, size, fade)
  ctx.restore()
}
