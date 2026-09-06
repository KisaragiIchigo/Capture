/**
 * ホットキーの表現。
 *
 * Electron の globalShortcut は accelerator 文字列しか受け取れず、
 * マウスボタンや修飾キー単体を割り当てられない。低レベルフックで自分で照合するため、
 * 入力の種類・コード・修飾キーを分けて持つ。
 */

export type HotkeyDevice = 'key' | 'mouse'

export interface HotkeyBinding {
  device: HotkeyDevice
  /** key なら仮想キーコード、mouse ならボタン番号（4 と 5 が左右のサイドボタン）。 */
  code: number
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

export type HotkeyAction =
  | 'toggleRecording'
  | 'pauseRecording'
  | 'screenshot'
  | 'toggleIntervalCapture'
  | 'toggleWindow'
  | 'toggleDrawing'
  | 'marker'

/** null は未割り当て。 */
export type HotkeyConfig = Record<HotkeyAction, HotkeyBinding | null>

/** マウスボタンの表示名。1〜3 は主要ボタン、4 以降がサイドボタン。 */
const MOUSE_LABEL: Record<number, string> = {
  1: '左クリック',
  2: '右クリック',
  3: '中クリック',
  4: 'サイドボタン 1',
  5: 'サイドボタン 2'
}

/**
 * キーコードの表示名。
 *
 * uiohook のコードは OS の仮想キーコードとは別体系なので、
 * 使う範囲だけを明示的に並べる。ここに無いコードは番号で表示する。
 */
const KEY_LABEL: Record<number, string> = {
  1: 'Esc',
  14: 'Backspace',
  15: 'Tab',
  28: 'Enter',
  29: 'Ctrl',
  42: 'Shift',
  54: '右 Shift',
  56: 'Alt',
  57: 'Space',
  3613: '右 Ctrl',
  3640: '右 Alt',
  3675: 'Win',
  3676: '右 Win',
  59: 'F1',
  60: 'F2',
  61: 'F3',
  62: 'F4',
  63: 'F5',
  64: 'F6',
  65: 'F7',
  66: 'F8',
  67: 'F9',
  68: 'F10',
  87: 'F11',
  88: 'F12',
  3653: 'Pause',
  3655: 'Home',
  3657: 'PageUp',
  3663: 'End',
  3665: 'PageDown',
  3666: 'Insert',
  3667: 'Delete',
  57416: '↑',
  57419: '←',
  57421: '→',
  57424: '↓',
  61000: 'Home',
  61001: 'PageUp',
  61003: '←',
  61005: '→',
  61007: 'End',
  61008: '↓',
  61009: 'PageDown',
  61010: 'Insert',
  61011: 'Delete'
}

/** 修飾キーそのものを表すコード。単体で割り当てたときに修飾扱いしないため。 */
const MODIFIER_CODES = new Set([29, 42, 54, 56, 3613, 3640, 3675, 3676])

export function isModifierCode(code: number): boolean {
  return MODIFIER_CODES.has(code)
}

/** 文字と数字のコードは連続していないため、名前が引けない場合の見せ方を用意する。 */
function keyName(code: number): string {
  const known = KEY_LABEL[code]
  if (known) return known

  // 英字と数字の並びは環境で揺れる。番号のまま出して、少なくとも区別はつくようにする。
  return `キー ${code}`
}

export function formatHotkey(binding: HotkeyBinding | null): string {
  if (!binding) return '未割り当て'

  const parts: string[] = []
  if (binding.ctrl) parts.push('Ctrl')
  if (binding.alt) parts.push('Alt')
  if (binding.shift) parts.push('Shift')
  if (binding.meta) parts.push('Win')

  const main =
    binding.device === 'mouse'
      ? (MOUSE_LABEL[binding.code] ?? `マウス ${binding.code}`)
      : keyName(binding.code)

  // 修飾キー単体を割り当てた場合、同じ名前が 2 度並ばないようにする。
  if (parts.length > 0 && parts[parts.length - 1] === main) return parts.join(' + ')

  parts.push(main)
  return parts.join(' + ')
}

/** 2 つの割り当てが同じ入力を指すか。重複の検出に使う。 */
export function isSameHotkey(a: HotkeyBinding | null, b: HotkeyBinding | null): boolean {
  if (!a || !b) return false
  return (
    a.device === b.device &&
    a.code === b.code &&
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.meta === b.meta
  )
}

/**
 * 修飾キーを問わず同じ入力かどうか。解放の照合に使う。
 *
 * 押している間に別の修飾キーを足されると、離す時点の修飾の並びは押した時点と変わる。
 * 解放まで厳密に照合すると取りこぼし、押しっぱなし扱いのまま残ってしまう。
 */
export function isSameInput(a: HotkeyBinding | null, b: HotkeyBinding | null): boolean {
  if (!a || !b) return false
  return a.device === b.device && a.code === b.code
}

/** 既定の割り当て。ファンクションキーは他のアプリと競合しにくい。 */
export function defaultHotkeys(): HotkeyConfig {
  const plain = { ctrl: false, alt: false, shift: false, meta: false }
  return {
    toggleRecording: { device: 'key', code: 67, ...plain },
    pauseRecording: { device: 'key', code: 68, ...plain },
    screenshot: { device: 'key', code: 87, ...plain },
    toggleIntervalCapture: { device: 'key', code: 65, ...plain },
    toggleWindow: { device: 'key', code: 88, ...plain },
    toggleDrawing: { device: 'key', code: 66, ...plain },
    // レーザーポインターは押している間だけ出すため、押しやすいサイドボタンを既定にする。
    marker: { device: 'mouse', code: 4, ...plain }
  }
}
