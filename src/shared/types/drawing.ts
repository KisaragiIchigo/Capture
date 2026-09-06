/**
 * 画面へ直接描き込む機能の型。
 *
 * 描いた内容は録画の対象画面そのものに重なるため、そのまま映像へ写る。
 * OBS のソースとして持たず、透過ウィンドウ上に描くだけにしているのは、
 * 描いている最中の見え方と録画結果を必ず一致させるため。
 */

export type DrawTool =
  | 'select'
  | 'pen'
  | 'marker'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'text'
  | 'eraser'

export interface Point {
  x: number
  y: number
}

export interface Stroke {
  id: string
  tool: DrawTool
  color: string
  /** 線の太さ（px）。 */
  width: number
  points: Point[]
  /** tool が text のときの本文。 */
  text?: string
}

export interface DrawingConfig {
  color: string
  width: number
  /** マーカーの不透明度。蛍光ペンらしく下の内容を透かす。 */
  markerOpacity: number
}

/** 選べる色。少数に絞り、画面上で判別しやすいものだけ並べる。 */
export const DRAW_COLORS = [
  '#facc15',
  '#f43f5e',
  '#22d3ee',
  '#4ade80',
  '#f97316',
  '#a78bfa',
  '#ffffff',
  '#111827'
] as const

export const DRAW_WIDTHS = [2, 4, 8, 16] as const

/** マーカーは軌跡を太く描く。同じ太さ指定でもペンより存在感を出す。 */
export const MARKER_WIDTH_SCALE = 3

/** 図形として成立するのに必要な最小の移動量。これ未満はクリックとみなす。 */
export const MIN_SHAPE_DISTANCE = 4

/** 消しゴムが触れたと判定する距離。 */
export const ERASER_RADIUS = 12

/** 点と線分の距離。消しゴムの当たり判定に使う。 */
function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy

  if (lengthSquared === 0) return Math.hypot(point.x - a.x, point.y - a.y)

  // 線分上へ射影した位置を 0-1 に収めてから距離を測る。
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
  )
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy))
}

/** ストロークが消しゴムの範囲に触れているか。 */
export function strokeTouches(stroke: Stroke, point: Point, radius: number): boolean {
  if (stroke.points.length === 0) return false
  if (stroke.points.length === 1) {
    const head = stroke.points[0]
    return head !== undefined && Math.hypot(point.x - head.x, point.y - head.y) <= radius
  }

  for (let i = 1; i < stroke.points.length; i += 1) {
    const a = stroke.points[i - 1]
    const b = stroke.points[i]
    if (!a || !b) continue
    if (distanceToSegment(point, a, b) <= radius + stroke.width / 2) return true
  }
  return false
}
