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
 * uiohook のコードは OS の仮想キーコードとは別体系で、数値のままでは何のキーか読めない。
 * uiohook-napi が公開している UiohookKey の対応を、そのまま表示名として持つ。
 * 記号キーは刻印（US 配列）で示す。日本語配列では刻印と異なる場合があるが、
 * 押したキーがどれかを見分けられれば割り当ての用は足りる。
 */
const KEY_LABEL: Record<number, string> = {
  // 制御・編集
  1: 'Esc',
  14: 'Backspace',
  15: 'Tab',
  28: 'Enter',
  57: 'Space',
  58: 'CapsLock',
  69: 'NumLock',
  70: 'ScrollLock',
  3639: 'PrintScreen',
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

  // 修飾キー
  29: 'Ctrl',
  3613: '右 Ctrl',
  42: 'Shift',
  54: '右 Shift',
  56: 'Alt',
  3640: '右 Alt',
  3675: 'Win',
  3676: '右 Win',

  // 数字列
  2: '1',
  3: '2',
  4: '3',
  5: '4',
  6: '5',
  7: '6',
  8: '7',
  9: '8',
  10: '9',
  11: '0',

  // 英字
  30: 'A',
  48: 'B',
  46: 'C',
  32: 'D',
  18: 'E',
  33: 'F',
  34: 'G',
  35: 'H',
  23: 'I',
  36: 'J',
  37: 'K',
  38: 'L',
  50: 'M',
  49: 'N',
  24: 'O',
  25: 'P',
  16: 'Q',
  19: 'R',
  31: 'S',
  20: 'T',
  22: 'U',
  47: 'V',
  17: 'W',
  45: 'X',
  21: 'Y',
  44: 'Z',

  // 記号（US 配列の刻印）
  12: '-',
  13: '=',
  26: '[',
  27: ']',
  39: ';',
  40: "'",
  41: '`',
  43: '\\',
  51: ',',
  52: '.',
  53: '/',

  // ファンクション
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

  // テンキー
  82: 'テンキー 0',
  79: 'テンキー 1',
  80: 'テンキー 2',
  81: 'テンキー 3',
  75: 'テンキー 4',
  76: 'テンキー 5',
  77: 'テンキー 6',
  71: 'テンキー 7',
  72: 'テンキー 8',
  73: 'テンキー 9',
  55: 'テンキー *',
  78: 'テンキー +',
  74: 'テンキー -',
  83: 'テンキー .',
  3637: 'テンキー /',
  3612: 'テンキー Enter',
  60999: 'テンキー Home',
  61000: 'テンキー ↑',
  61001: 'テンキー PageUp',
  61003: 'テンキー ←',
  61005: 'テンキー →',
  61007: 'テンキー End',
  61008: 'テンキー ↓',
  61009: 'テンキー PageDown',
  61010: 'テンキー Insert',
  61011: 'テンキー Delete'
}

/** 修飾キーそのものを表すコード。単体で割り当てたときに修飾扱いしないため。 */
const MODIFIER_CODES = new Set([29, 42, 54, 56, 3613, 3640, 3675, 3676])

export function isModifierCode(code: number): boolean {
  return MODIFIER_CODES.has(code)
}

/**
 * 表に無いキーの見せ方。
 *
 * 配列や機種ごとの追加キーはここへ来る。番号だけでは何を押したのか分からないため、
 * 番号であることを明示したうえで、他のキーと区別だけはつくようにする。
 */
function keyName(code: number): string {
  return KEY_LABEL[code] ?? `不明なキー (${code})`
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
