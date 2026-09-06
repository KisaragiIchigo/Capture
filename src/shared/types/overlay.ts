/**
 * 録画映像へ重ねる要素の設定。
 *
 * 位置は座標ではなく 9 分割のアンカーと余白で持つ。録画範囲は解像度もモードも変わるので、
 * 絶対座標で持つと対象を変えた瞬間に画面外へ飛ぶ。比率とアンカーなら追従できる。
 */

export type OverlayAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'middle-center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right'

/** すべてのオーバーレイが共通で持つ配置情報。 */
export interface OverlayPlacement {
  anchor: OverlayAnchor
  /** 録画範囲の短辺に対する大きさの比率。0.2 なら短辺の 20%。 */
  scale: number
  /** 画面端からの余白（録画範囲の短辺に対する比率）。 */
  margin: number
  /** 0.0 - 1.0。 */
  opacity: number
}

export interface WebcamOverlay extends OverlayPlacement {
  enabled: boolean
  /** 空文字なら既定のカメラを使う。 */
  deviceId: string
}

export interface TextOverlay extends OverlayPlacement {
  enabled: boolean
  text: string
  /** ポイント数。録画範囲の大きさに関わらず実寸で指定する。 */
  fontSize: number
  /** #rrggbb。 */
  color: string
  /** 背景に敷く帯の不透明度。0 で帯なし。 */
  backgroundOpacity: number
}

export interface LogoOverlay extends OverlayPlacement {
  enabled: boolean
  /** 画像ファイルの絶対パス。未選択なら空文字。 */
  filePath: string
}

export interface OverlayConfig {
  webcam: WebcamOverlay
  text: TextOverlay
  logo: LogoOverlay
}

export interface Size {
  width: number
  height: number
}

export interface PlacedBox {
  x: number
  y: number
  width: number
  height: number
}

/**
 * アンカーと比率から、キャンバス上の実際の矩形を求める。
 *
 * 縦横比は元の素材のものを保つ。scale は短辺基準にしているので、
 * 16:9 と 4:3 のカメラを切り替えても、画面に占める大きさの印象が揃う。
 */
export function resolvePlacement(
  placement: OverlayPlacement,
  canvas: Size,
  sourceAspect: number
): PlacedBox {
  const shortEdge = Math.min(canvas.width, canvas.height)
  const margin = Math.round(shortEdge * placement.margin)

  const width = Math.round(shortEdge * placement.scale * sourceAspect)
  const height = Math.round(shortEdge * placement.scale)

  const [vertical, horizontal] = splitAnchor(placement.anchor)

  const x =
    horizontal === 'left'
      ? margin
      : horizontal === 'right'
        ? canvas.width - width - margin
        : Math.round((canvas.width - width) / 2)

  const y =
    vertical === 'top'
      ? margin
      : vertical === 'bottom'
        ? canvas.height - height - margin
        : Math.round((canvas.height - height) / 2)

  return { x, y, width, height }
}

/**
 * 大きさが素材そのもので決まる要素の配置。
 *
 * テキストのように実寸で描くものは、置いてみるまで大きさが分からない。
 * 大きさを 0 として扱うと、右寄せや下寄せのときに矩形の左上が画面の端そのものになり、
 * 文字は端から外へはみ出して一切見えなくなる。実際の大きさを渡して収める。
 */
export function resolveFixedPlacement(
  placement: OverlayPlacement,
  canvas: Size,
  size: Size
): PlacedBox {
  const shortEdge = Math.min(canvas.width, canvas.height)
  const margin = Math.round(shortEdge * placement.margin)

  const [vertical, horizontal] = splitAnchor(placement.anchor)

  const x =
    horizontal === 'left'
      ? margin
      : horizontal === 'right'
        ? canvas.width - size.width - margin
        : Math.round((canvas.width - size.width) / 2)

  const y =
    vertical === 'top'
      ? margin
      : vertical === 'bottom'
        ? canvas.height - size.height - margin
        : Math.round((canvas.height - size.height) / 2)

  return { x, y, width: size.width, height: size.height }
}

function splitAnchor(anchor: OverlayAnchor): [string, string] {
  const [vertical, horizontal] = anchor.split('-')
  return [vertical ?? 'top', horizontal ?? 'left']
}
