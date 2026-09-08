import type { WindowBounds } from './finder'

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

/** 開いた直後に選ばれている道具。描画面とパレットが同じ値から始まるよう共有する。 */
export const DEFAULT_DRAW_TOOL: DrawTool = 'pen'

/**
 * パレット窓の幅。中身の実寸と一致させる（色の 2 列 40px + 内側の余白 12px）。
 * 窓の幅が中身より狭いと、道具の並びが窓の縁で切れる。
 */
export const PALETTE_WIDTH = 52

/** 録画範囲や画面の縁からパレットを離す量。 */
export const PALETTE_MARGIN = 8

/**
 * 高さが決まるまでの仮の値。
 *
 * パレットの高さは道具・色・太さの数で変わるため、定数で持つと DOM の実寸と食い違う。
 * 食い違ったときに欠けるのは下端の「描画を終える」で、閉じる手段が消える壊れ方をする。
 * 窓はこの仮の高さで作り、Renderer が中身を測って報せてきた高さへ直してから表に出す。
 */
export const PALETTE_PROVISIONAL_HEIGHT = 600

/**
 * パレット窓の置き場所を決める。
 *
 * 録画範囲の外側へ逃がす。窓自体は録画から除外してあるので写り込みはしないが、
 * 範囲の上に被せると、録りたい対象がユーザーからも見えなくなる。
 * 左右どちらにも幅が無いときだけ、範囲の内側の右端へ置く。
 *
 * @param area 録画される矩形。範囲指定なら枠の内側、それ以外は対象モニタの全面。
 * @param workArea 置いてよい範囲。対象モニタの作業領域を渡す。
 * @param height 実測したパレットの高さ。
 */
export function buildPaletteBounds(
  area: WindowBounds,
  workArea: WindowBounds,
  height: number
): WindowBounds {
  const right = area.x + area.width + PALETTE_MARGIN
  const left = area.x - PALETTE_MARGIN - PALETTE_WIDTH

  const x =
    right + PALETTE_WIDTH + PALETTE_MARGIN <= workArea.x + workArea.width
      ? right
      : left - PALETTE_MARGIN >= workArea.x
        ? left
        : // どちらへも逃がせない。範囲が画面を埋めているので、内側の右端へ寄せる。
          area.x + area.width - PALETTE_MARGIN * 2 - PALETTE_WIDTH

  // 縦は範囲の中央へ。画面からはみ出す場合は縁で止める。道具が押せなくなるため。
  const centered = area.y + Math.round((area.height - height) / 2)
  const top = workArea.y + PALETTE_MARGIN
  const bottom = Math.max(top, workArea.y + workArea.height - height - PALETTE_MARGIN)

  return {
    x,
    y: Math.min(Math.max(centered, top), bottom),
    width: PALETTE_WIDTH,
    height
  }
}

/**
 * パレットから描画面への指示。
 *
 * パレットと描画面は別の窓になった。パレットを録画から除外するには窓ごと分けるしかなく、
 * 除外の単位がウィンドウだからで、描いた線まで一緒に消えては意味がない。
 * 選択の実体はパレットが持ち、描画面へはこの指示だけを流す。
 */
export type DrawingCommand =
  | { kind: 'tool'; tool: DrawTool }
  | { kind: 'color'; color: string }
  | { kind: 'width'; width: number }
  | { kind: 'undo' }
  | { kind: 'clear' }

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
