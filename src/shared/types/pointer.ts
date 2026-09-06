/**
 * レーザーポインターの軌跡。
 *
 * 押している間だけ現れ、離すと全体が薄れて消える。
 * 描き込み機能とは別に持つ。あちらは残すために描くもので、
 * こちらは今どこを指しているかを示すもの。求められる挙動が逆になる。
 *
 * 押している間、軌跡は消さずに残す。指し示した経路がそのまま線として残るほうが、
 * 「ここからここへ」と辿る動きを見せられる。時間で消すと、書いている途中から
 * 先が消えていくため、長い動きを 1 本の線として見せられない。
 */

export interface PointerSample {
  /** 画面座標。窓がモニタを跨いで移っても意味が変わらないよう、窓の中の位置では持たない。 */
  x: number
  y: number
}

/**
 * 窓の左上。
 *
 * 画面座標で溜めた点を窓の中の位置へ直すために要る。窓がモニタを跨ぐと変わるため、
 * 押し始めの時点でも渡す。まだマウスを動かしていない間に古い原点で描くと、
 * 前に描いた軌跡が薄れながら別の場所に居座る。
 */
export interface PointerOrigin {
  originX: number
  originY: number
}

/** 表示中のマウス位置。原点と一緒に届く。 */
export interface PointerMovePayload extends PointerOrigin {
  x: number
  y: number
}

export interface PointerConfig {
  /** 光の色。 */
  color: string
  /** 先端の光点の直径（px）。軌跡の太さもここから決まる。 */
  size: number
  /** ボタンを離してから消え切るまでの時間（ミリ秒）。 */
  fadeOutMs: number
}

/**
 * 一続きの軌跡。押してから離すまでが 1 本になる。
 *
 * 押すたびに描き直すのではなく本数で持つのは、前に指した跡を消さずに次を指せるようにするため。
 * 「ここを見て、次はここ」と続けて示すとき、前の線が消えると話の繋がりが切れる。
 */
export interface PointerStroke {
  points: PointerSample[]
  /** 離した時刻（epoch ミリ秒）。押している間は null で、薄れずに残る。 */
  releasedAt: number | null
}

/**
 * 同時に残す軌跡の本数。
 *
 * 古いものは離してから消えるまでの時間で自然に落ちるが、消え切る前に何度も押されると
 * 際限なく溜まる。溜まった本数ぶん毎フレーム描き直すことになるため、上限を置く。
 */
export const MAX_TRAILS = 8

/**
 * クリックの波紋が広がり切るまでの時間（ミリ秒）。
 *
 * 押した瞬間を示すだけなので短くする。長いと、続けて押したときに前の輪が残って
 * どれが今の操作なのか分からなくなる。
 */
export const CLICK_RIPPLE_MS = 520

/** 画面上に残っている波紋。座標はレーザーと同じく画面座標で持つ。 */
export interface ClickRipple {
  x: number
  y: number
  /** 押された時刻（epoch ミリ秒）。広がり具合はここからの経過で決まる。 */
  at: number
}

/** 尾の太さは先端より細くする。実際のレーザーの見え方に寄せる。 */
export const TRAIL_WIDTH_RATIO = 0.7

/**
 * 溜める点の上限。
 *
 * 押している間は消さないため、押しっぱなしにされると際限なく伸びる。
 * 60fps で 1 点ずつ足しても 40 秒ぶん残る量にしてあり、実用上は打ち切られない。
 */
export const MAX_TRAIL_SAMPLES = 2400

/**
 * 点を足す最小の移動量（px）。
 *
 * 止まっている間も位置は届き続ける。同じ場所へ重ねて足すと、加算で描くぶん
 * そこだけ不自然に明るい塊になり、上限も無駄に食う。
 */
export const MIN_TRAIL_STEP = 2

/**
 * ボタンを離してからの全体の不透明度。
 *
 * 軌跡と光点の両方へ同じ値を掛ける。片方だけ先に消すと、残ったほうが
 * 取り残されて途切れて見える。
 */
export function releaseOpacity(releasedAt: number | null, now: number, fadeOutMs: number): number {
  if (releasedAt === null) return 1
  if (fadeOutMs <= 0) return 0

  const elapsed = now - releasedAt
  if (elapsed >= fadeOutMs) return 0

  // 経過の二乗を引く形にすると、しばらく濃さを保ってから終わり際に落ちる。
  // 残り時間の二乗で落とすと、離した直後に急激に薄くなって「ぱっと消えた」ように見える。
  const progress = elapsed / fadeOutMs
  return 1 - progress * progress
}

/**
 * #rrggbb を canvas の色指定へ直す。
 *
 * 設定は 16 進数で持つが、光として重ねて描くには段階ごとの透明度が要る。
 * 値は IPC 境界の Zod で /^#[0-9a-fA-F]{6}$/ に絞ってある。
 */
export function withAlpha(hex: string, alpha: number): string {
  const value = hex.slice(1)
  const r = parseInt(value.slice(0, 2), 16)
  const g = parseInt(value.slice(2, 4), 16)
  const b = parseInt(value.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
