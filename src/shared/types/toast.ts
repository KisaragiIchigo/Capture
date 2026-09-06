import type { WindowBounds } from './finder'

/**
 * 静止画が撮れたことを知らせる札。
 *
 * ファインダーを閉じ、メインウィンドウも最小化していると、画面上に合図を出す先が
 * どこにも無くなる。「撮れたのか分からない」という最初の不満がそこで戻るため、
 * どの窓にも依存しない小さな札を別に持つ。
 *
 * 置き場所は録画対象と重ならない所を選ぶ。ここを外すと、撮れたことを知らせる札が
 * そのまま録画映像へ写り込む。
 */

/** 札の大きさ。ファイル名 1 行が収まるだけに留める。 */
export const TOAST_WIDTH = 320
export const TOAST_HEIGHT = 44

/** 画面の縁から離す量。縁に貼り付くとタスクバーや通知領域と重なって見える。 */
export const TOAST_MARGIN = 16

/** 合図を出しておく時間。バーのファイル名表示と札で同じ長さを使う。 */
export const SHOT_NOTICE_MS = 2400

export interface ToastPlacement {
  bounds: WindowBounds
  /**
   * 録画対象の上に重なるか。
   * 重なる場所にしか出せない場合、録画中は出さない。映像に札が写り込むため。
   */
  overlapsTarget: boolean
}

function intersects(a: WindowBounds, b: WindowBounds): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
}

/**
 * 作業領域の四隅を、置きたい順に並べる。
 *
 * 右下から始めるのは、Windows の通知が出る側で、そこに何かが現れることに目が慣れているため。
 */
function corners(area: WindowBounds): WindowBounds[] {
  const right = area.x + area.width - TOAST_WIDTH - TOAST_MARGIN
  const left = area.x + TOAST_MARGIN
  const bottom = area.y + area.height - TOAST_HEIGHT - TOAST_MARGIN
  const top = area.y + TOAST_MARGIN
  const size = { width: TOAST_WIDTH, height: TOAST_HEIGHT }

  return [
    { x: right, y: bottom, ...size },
    { x: left, y: bottom, ...size },
    { x: right, y: top, ...size },
    { x: left, y: top, ...size }
  ]
}

/**
 * 札を置く場所を決める。
 *
 * target は避けたい矩形。null なら避ける相手がいないという意味で、
 * ウィンドウやゲームの取り込みがこれにあたる。対象ウィンドウの中身だけが録られるため、
 * 別ウィンドウである札は画面のどこに出ても映像へ入らない。
 *
 * 逃げ場が見つからなければ既定の隅を返し、重なることを呼び出し側へ伝える。
 * 出す / 出さないの判断は録画中かどうかを知っている側に任せる。
 */
export function pickToastBounds(area: WindowBounds, target: WindowBounds | null): ToastPlacement {
  const candidates = corners(area)
  const fallback = candidates[0] as WindowBounds

  if (!target) return { bounds: fallback, overlapsTarget: false }

  const free = candidates.find((candidate) => !intersects(candidate, target))
  return free ? { bounds: free, overlapsTarget: false } : { bounds: fallback, overlapsTarget: true }
}
