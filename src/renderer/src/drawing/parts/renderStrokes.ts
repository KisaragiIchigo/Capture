import { MARKER_WIDTH_SCALE, type Stroke } from '@shared/types'

/**
 * ストロークを canvas へ描く。
 *
 * 状態を持たない純粋な描画にしておくと、再描画のたびに同じ結果になり、
 * 「描いている最中」と「描き終わった後」で見え方が変わる事故を避けられる。
 */
export function renderStrokes(
  ctx: CanvasRenderingContext2D,
  strokes: Stroke[],
  markerOpacity: number
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)

  for (const stroke of strokes) {
    if (stroke.points.length === 0) continue

    ctx.save()
    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (stroke.tool === 'marker') {
      // 蛍光ペンらしく下の内容を透かす。重ね塗りで濃くならないよう乗算にはしない。
      ctx.globalAlpha = markerOpacity
      ctx.lineWidth = stroke.width * MARKER_WIDTH_SCALE
    } else {
      ctx.lineWidth = stroke.width
    }

    switch (stroke.tool) {
      case 'pen':
      case 'marker':
        drawFreehand(ctx, stroke)
        break
      case 'line':
        drawLine(ctx, stroke)
        break
      case 'arrow':
        drawArrow(ctx, stroke)
        break
      case 'rect':
        drawRect(ctx, stroke)
        break
      case 'text':
        drawText(ctx, stroke)
        break
      default:
        break
    }

    ctx.restore()
  }
}

function drawFreehand(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const [head, ...rest] = stroke.points
  if (!head) return

  ctx.beginPath()
  ctx.moveTo(head.x, head.y)

  if (rest.length === 0) {
    // 点で終わった場合も見えるよう、太さぶんの丸を置く。
    ctx.arc(head.x, head.y, ctx.lineWidth / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }

  for (const point of rest) ctx.lineTo(point.x, point.y)
  ctx.stroke()
}

/** 始点と終点だけを持つ図形の両端を取り出す。 */
function endpoints(stroke: Stroke): { from: { x: number; y: number }; to: { x: number; y: number } } | null {
  const from = stroke.points[0]
  const to = stroke.points[stroke.points.length - 1]
  if (!from || !to) return null
  return { from, to }
}

function drawLine(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const ends = endpoints(stroke)
  if (!ends) return

  ctx.beginPath()
  ctx.moveTo(ends.from.x, ends.from.y)
  ctx.lineTo(ends.to.x, ends.to.y)
  ctx.stroke()
}

function drawArrow(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const ends = endpoints(stroke)
  if (!ends) return

  const { from, to } = ends
  const angle = Math.atan2(to.y - from.y, to.x - from.x)
  // 矢じりは線の太さに追従させる。細い線に大きな矢じりが付くと不格好になる。
  const head = Math.max(10, stroke.width * 4)

  /*
   * 矢印だけ線端を丸めない。丸い端は指定した終点より線の太さの半分だけ外へ膨らむため、
   * 矢じりの尖りの先に丸が乗って、先端が潰れて見える。
   */
  ctx.lineCap = 'butt'
  ctx.lineJoin = 'miter'

  /*
   * 軸は矢じりの根元で止める。終点まで引くと、矢じりの内側から軸がはみ出して
   * 三角形の谷が埋まり、輪郭がぼやける。短く引いた矢印では軸が消えるだけで破綻しない。
   */
  const length = Math.hypot(to.x - from.x, to.y - from.y)
  const shaft = Math.max(0, length - head * 0.85)

  ctx.beginPath()
  ctx.moveTo(from.x, from.y)
  ctx.lineTo(from.x + Math.cos(angle) * shaft, from.y + Math.sin(angle) * shaft)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(to.x, to.y)
  ctx.lineTo(
    to.x - head * Math.cos(angle - Math.PI / 6),
    to.y - head * Math.sin(angle - Math.PI / 6)
  )
  ctx.lineTo(
    to.x - head * Math.cos(angle + Math.PI / 6),
    to.y - head * Math.sin(angle + Math.PI / 6)
  )
  ctx.closePath()
  ctx.fill()
}

function drawRect(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const ends = endpoints(stroke)
  if (!ends) return

  const { from, to } = ends
  ctx.strokeRect(
    Math.min(from.x, to.x),
    Math.min(from.y, to.y),
    Math.abs(to.x - from.x),
    Math.abs(to.y - from.y)
  )
}

function drawText(ctx: CanvasRenderingContext2D, stroke: Stroke): void {
  const head = stroke.points[0]
  if (!head || !stroke.text) return

  // 太さの指定を文字の大きさへ読み替える。線の太さと同じ操作で大小を変えられる。
  const size = Math.max(14, stroke.width * 6)
  ctx.font = `600 ${size}px "IBM Plex Sans JP", sans-serif`
  ctx.textBaseline = 'top'

  // 背景の明暗に関わらず読めるよう、細い縁取りを付ける。
  ctx.lineWidth = Math.max(2, size / 8)
  ctx.strokeStyle = 'rgba(0,0,0,0.75)'

  let y = head.y
  for (const line of stroke.text.split('\n')) {
    ctx.strokeText(line, head.x, y)
    ctx.fillText(line, head.x, y)
    y += size * 1.3
  }
}
