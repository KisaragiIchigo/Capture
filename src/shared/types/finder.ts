import type { RegionRect } from './capture'

/**
 * 範囲指定ファインダーの寸法。
 *
 * ファインダーは「操作バー + 掴み代 + 枠線 + 録画範囲」を 1 枚の透過ウィンドウで構成する。
 * 枠線と掴み代は録画範囲の外側に置く。内側に置くと枠線そのものが映像へ写り込む。
 *
 * ウィンドウ座標と録画範囲がずれると、見えている枠と実際に録れる範囲が食い違うため、
 * 換算はこのファイルの 2 つの関数だけを通す。Main と Renderer の双方から使う。
 *
 *   ┌──────────────────────────┐ ← ウィンドウ
 *   │  操作バー (BAR_HEIGHT)    │
 *   ├──────────────────────────┤
 *   │ ░ 掴み代 + 枠線 (OUTSET) ░│
 *   │ ░ ┌────────────────────┐ ░│
 *   │ ░ │   録画範囲（透過）  │ ░│
 *   │ ░ └────────────────────┘ ░│
 *   │ ░░░░░░░░░░░░░░░░░░░░░░░░ │
 *   └──────────────────────────┘
 */

/** 操作バーの高さ。 */
export const FINDER_BAR_HEIGHT = 32

/** 見える枠線の太さ。録画範囲のすぐ外側に描く。 */
export const FINDER_BORDER = 2

/** 枠を掴んでリサイズするための余白。細い枠線だけでは掴めない。 */
export const FINDER_GRIP = 6

/** 録画範囲の外側に確保する合計。枠線と掴み代のぶん。 */
export const FINDER_OUTSET = FINDER_BORDER + FINDER_GRIP

/** 録画範囲として許容する最小サイズ。これ以下はエンコーダが受け付けない。 */
export const FINDER_MIN_WIDTH = 64
export const FINDER_MIN_HEIGHT = 64

export interface WindowBounds {
  x: number
  y: number
  width: number
  height: number
}

/** 録画したい範囲から、ファインダーウィンドウの位置とサイズを求める。 */
export function regionToWindowBounds(region: RegionRect): WindowBounds {
  return {
    x: region.x - FINDER_OUTSET,
    y: region.y - FINDER_OUTSET - FINDER_BAR_HEIGHT,
    width: region.width + FINDER_OUTSET * 2,
    height: region.height + FINDER_OUTSET * 2 + FINDER_BAR_HEIGHT
  }
}

/** ファインダーウィンドウの位置とサイズから、実際に録画される範囲を求める。 */
export function windowBoundsToRegion(bounds: WindowBounds): RegionRect {
  return {
    x: bounds.x + FINDER_OUTSET,
    y: bounds.y + FINDER_OUTSET + FINDER_BAR_HEIGHT,
    width: Math.max(FINDER_MIN_WIDTH, bounds.width - FINDER_OUTSET * 2),
    height: Math.max(FINDER_MIN_HEIGHT, bounds.height - FINDER_OUTSET * 2 - FINDER_BAR_HEIGHT)
  }
}

/** バーだけを出すときの幅。操作が並びきる最小限に留める。 */
export const FINDER_BAR_ONLY_WIDTH = 660

/** ウィンドウとして成立する最小サイズ。枠と操作バーのぶんを足して返す。 */
export function minimumWindowSize(): { width: number; height: number } {
  return {
    width: FINDER_MIN_WIDTH + FINDER_OUTSET * 2,
    height: FINDER_MIN_HEIGHT + FINDER_OUTSET * 2 + FINDER_BAR_HEIGHT
  }
}
