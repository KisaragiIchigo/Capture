import type { WindowLayout } from '@shared/types'

/**
 * 複数のウィンドウを 1 枚のキャンバスへ並べる計算。
 *
 * OBS には触れず、寸法と座標だけを扱う。並べ方の妥当性はここだけを読めば確かめられる。
 */

/** 並べる対象 1 つぶん。screen は画面上の位置で、取得できなかった場合は持たない。 */
export interface LayoutSource {
  /** 取り込んだ映像そのものの大きさ。 */
  width: number
  height: number
  /** 画面上の位置。as-is の並べ方でだけ使う。 */
  screenX?: number
  screenY?: number
  /** 画面上の重なり。手前にあるものほど小さい。位置と同じく as-is でだけ使う。 */
  depth?: number
}

/** 置き場所。左上を原点とするキャンバス座標。 */
export interface Placement {
  x: number
  y: number
  width: number
  height: number
}

export interface LayoutResult {
  canvas: { width: number; height: number }
  placements: Placement[]
  /**
   * 奥から手前への並び。値は sources の添字。
   *
   * 画面のとおりに並べるときは、画面上の重なりをそのまま持ち込む。それ以外の並べ方では
   * 重ならないため、選ばれた順をそのまま使う。
   */
  stacking: number[]
  /** 求められた並べ方を使えなかった場合に、実際に使った並べ方。 */
  appliedLayout: WindowLayout
}

/**
 * エンコーダは奇数の辺を扱えない。キャンバスの寸法は必ず偶数へ寄せる。
 *
 * 切り上げるのは、並べた合計が奇数になったときに端の 1 列が欠けるため。
 * 余白が 1px 増えるほうが、映像が削れるより害が小さい。
 */
function toEven(value: number): number {
  const rounded = Math.max(2, Math.ceil(value))
  return rounded + (rounded % 2)
}

/**
 * 並べた結果を返す。
 *
 * as-is は画面上の位置関係をそのまま持ち込む。ウィンドウが離れて置かれていれば、
 * その間隔もそのまま余白になる。位置が 1 つでも欠けていると位置関係が組めないため、
 * 横並びへ落とす。
 */
export function layoutWindows(
  sources: LayoutSource[],
  layout: WindowLayout,
  gap: number
): LayoutResult {
  if (sources.length === 0) {
    return { canvas: { width: 2, height: 2 }, placements: [], stacking: [], appliedLayout: layout }
  }

  const canPlaceAsIs = sources.every(
    (source) => source.screenX !== undefined && source.screenY !== undefined
  )
  const applied: WindowLayout = layout === 'as-is' && !canPlaceAsIs ? 'horizontal' : layout

  if (applied === 'as-is') return layoutAsIs(sources)
  if (applied === 'vertical') return layoutStacked(sources, gap, 'vertical')
  return layoutStacked(sources, gap, 'horizontal')
}

/**
 * 画面に置かれているとおりに並べる。
 *
 * 全体を囲む矩形を求め、その左上を原点として詰め直す。仮想デスクトップの座標は
 * 負にもなるため、そのまま使うとキャンバスの外へ出る。
 */
function layoutAsIs(sources: LayoutSource[]): LayoutResult {
  const left = Math.min(...sources.map((s) => s.screenX ?? 0))
  const top = Math.min(...sources.map((s) => s.screenY ?? 0))
  const right = Math.max(...sources.map((s) => (s.screenX ?? 0) + s.width))
  const bottom = Math.max(...sources.map((s) => (s.screenY ?? 0) + s.height))

  const placements = sources.map((source) => ({
    x: (source.screenX ?? 0) - left,
    y: (source.screenY ?? 0) - top,
    width: source.width,
    height: source.height
  }))

  /*
   * 画面で手前にあるものを、映像でも手前にする。depth は前面ほど小さいため、
   * 奥から積む順に直すには降順へ並べ替える。
   */
  const stacking = sources
    .map((source, index) => ({ index, depth: source.depth ?? index }))
    .sort((a, b) => b.depth - a.depth)
    .map((entry) => entry.index)

  return {
    canvas: { width: toEven(right - left), height: toEven(bottom - top) },
    placements,
    stacking,
    appliedLayout: 'as-is'
  }
}

/**
 * 縦か横へ順に並べる。
 *
 * 並びと直交する向きは中央で揃える。左右（または上下）で長さが違うときに、
 * 端へ寄せると全体が傾いて見える。
 */
function layoutStacked(
  sources: LayoutSource[],
  gap: number,
  direction: 'vertical' | 'horizontal'
): LayoutResult {
  const vertical = direction === 'vertical'
  const totalGap = gap * (sources.length - 1)

  const across = Math.max(...sources.map((s) => (vertical ? s.width : s.height)))
  const along = sources.reduce((sum, s) => sum + (vertical ? s.height : s.width), 0) + totalGap

  const placements: Placement[] = []
  let cursor = 0

  for (const source of sources) {
    const offset = Math.round((across - (vertical ? source.width : source.height)) / 2)

    placements.push({
      x: vertical ? offset : cursor,
      y: vertical ? cursor : offset,
      width: source.width,
      height: source.height
    })

    cursor += (vertical ? source.height : source.width) + gap
  }

  return {
    canvas: {
      width: toEven(vertical ? across : along),
      height: toEven(vertical ? along : across)
    },
    placements,
    // 並べた場合は重ならない。選ばれた順のままでよい。
    stacking: sources.map((_, index) => index),
    appliedLayout: direction
  }
}
