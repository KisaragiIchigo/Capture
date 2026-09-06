import { uIOhook, type UiohookKeyboardEvent, type UiohookMouseEvent } from 'uiohook-napi'
import {
  isModifierCode,
  isSameHotkey,
  isSameInput,
  type HotkeyAction,
  type HotkeyBinding,
  type HotkeyConfig
} from '@shared/types'
import { createLogger } from '@main/lib/logger'

const log = createLogger('hotkey-hook')

/** マウス移動を送る間隔。60fps 相当で十分滑らかに見える。 */
const MOUSE_MOVE_INTERVAL_MS = 16

export interface HotkeyEvents {
  /** 割り当てが押された。 */
  onPressed: (action: HotkeyAction) => void
  /** 割り当てが離された。押している間だけ働く機能に使う。 */
  onReleased: (action: HotkeyAction) => void
  /** 記録中に入力を捕まえた。 */
  onCaptured: (binding: HotkeyBinding) => void
  /** 画面上のマウス位置。レーザーポインターの軌跡に使う。 */
  onMouseMove: (x: number, y: number) => void
  /** マウスのボタンが押された。押した位置に波紋を出すために使う。 */
  onMouseClick: (x: number, y: number) => void
}

/**
 * 波紋を出すボタン。
 *
 * サイドボタンを含めないのは、押している間だけ働く機能の割り当て先になりやすく、
 * レーザーを出すたびに波紋が重なって出てしまうため。
 */
const RIPPLE_BUTTONS = new Set([1, 2])

/**
 * 低レベルフックによるホットキー。
 *
 * Electron の globalShortcut を使わないのは、マウスボタンと修飾キー単体を
 * 割り当てられないため。押している間だけ働く機能（レーザーポインター）にも、
 * 押下と解放の両方が要る。
 *
 * すべての入力が流れてくる経路なので、ここでは照合と通知だけを行い、
 * 入力の内容を記録も送信もしない。
 */
export class HotkeyHook {
  private config: HotkeyConfig | null = null
  private capturing = false
  private started = false

  /** 押しっぱなしの間に何度も通知しないための記録。 */
  private readonly pressed = new Set<HotkeyAction>()

  /** マウス移動を間引くための最終送信時刻。 */
  private lastMoveAt = 0

  constructor(private readonly events: HotkeyEvents) {}

  start(): void {
    if (this.started) return

    uIOhook.on('keydown', this.handleKeyDown)
    uIOhook.on('keyup', this.handleKeyUp)
    uIOhook.on('mousedown', this.handleMouseDown)
    uIOhook.on('mouseup', this.handleMouseUp)
    uIOhook.on('mousemove', this.handleMouseMove)

    uIOhook.start()
    this.started = true
    log.info('入力フックを開始しました')
  }

  stop(): void {
    if (!this.started) return

    uIOhook.off('keydown', this.handleKeyDown)
    uIOhook.off('keyup', this.handleKeyUp)
    uIOhook.off('mousedown', this.handleMouseDown)
    uIOhook.off('mouseup', this.handleMouseUp)
    uIOhook.off('mousemove', this.handleMouseMove)

    try {
      uIOhook.stop()
    } catch (err) {
      log.warn('入力フックの停止に失敗しました', err)
    }

    this.started = false
    this.pressed.clear()
    log.info('入力フックを停止しました')
  }

  setConfig(config: HotkeyConfig): void {
    this.config = config
    this.pressed.clear()
  }

  /** 次の入力を割り当てとして捕まえる。 */
  beginCapture(): void {
    this.capturing = true
    this.pressed.clear()
  }

  cancelCapture(): void {
    this.capturing = false
  }

  private readonly handleKeyDown = (event: UiohookKeyboardEvent): void => {
    // 修飾キー単体も割り当てられるようにする。ただし押した瞬間は修飾フラグが立つので、
    // 自分自身を修飾として数えない形へ直す。記録時と照合時で同じ形にしないと、
    // 「Ctrl」で登録したものが実行時には「Ctrl + Ctrl」になり永久に一致しない。
    const binding = normalizeSelfModifier(toBinding('key', event.keycode, event))

    if (this.capturing) {
      this.capture(binding)
      return
    }

    this.match(binding, true)
  }

  private readonly handleKeyUp = (event: UiohookKeyboardEvent): void => {
    if (this.capturing) return
    this.match(normalizeSelfModifier(toBinding('key', event.keycode, event)), false)
  }

  private readonly handleMouseDown = (event: UiohookMouseEvent): void => {
    const binding = toBinding('mouse', Number(event.button), event)

    if (this.capturing) {
      // 左クリックはパレットや設定画面の操作そのものなので割り当てさせない。
      if (binding.code === 1) return
      this.capture(binding)
      return
    }

    // 波紋は割り当ての照合とは無関係に出す。押した事実と場所だけを渡す。
    if (RIPPLE_BUTTONS.has(binding.code)) this.events.onMouseClick(event.x, event.y)

    this.match(binding, true)
  }

  private readonly handleMouseUp = (event: UiohookMouseEvent): void => {
    if (this.capturing) return
    this.match(toBinding('mouse', Number(event.button), event), false)
  }

  /**
   * マウス移動は毎ミリ秒のように届く。必要な相手がいるときだけ、
   * かつ 1 フレームぶんに間引いて渡す。素通しすると通信が飽和する。
   */
  private readonly handleMouseMove = (event: UiohookMouseEvent): void => {
    if (this.pressed.size === 0) return

    const now = Date.now()
    if (now - this.lastMoveAt < MOUSE_MOVE_INTERVAL_MS) return
    this.lastMoveAt = now

    this.events.onMouseMove(event.x, event.y)
  }

  private capture(binding: HotkeyBinding): void {
    this.capturing = false
    this.events.onCaptured(binding)
  }

  private match(binding: HotkeyBinding, isDown: boolean): void {
    const config = this.config
    if (!config) return

    for (const [action, assigned] of Object.entries(config) as Array<
      [HotkeyAction, HotkeyBinding | null]
    >) {
      // 押下は修飾キーまで一致させ、解放は同じ入力かどうかだけを見る。
      // 押している間に修飾キーを足されると解放時の並びが変わるため、
      // 厳密に照合すると解放を取りこぼし、押しっぱなしのまま残る。
      if (!(isDown ? isSameHotkey(assigned, binding) : isSameInput(assigned, binding))) continue

      if (isDown) {
        // キーリピートで何度も発火させない。押し始めの 1 回だけ通す。
        if (this.pressed.has(action)) return
        this.pressed.add(action)
        this.events.onPressed(action)
        return
      }

      // 同じ入力に修飾違いの割り当てが複数ぶら下がりうる。
      // 押されていないものは飛ばし、実際に押されている割り当てを探し続ける。
      if (!this.pressed.delete(action)) continue
      this.events.onReleased(action)
      return
    }
  }
}

interface ModifierState {
  ctrlKey: boolean
  altKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

function toBinding(
  device: HotkeyBinding['device'],
  code: number,
  modifiers: ModifierState
): HotkeyBinding {
  return {
    device,
    code,
    ctrl: modifiers.ctrlKey,
    alt: modifiers.altKey,
    shift: modifiers.shiftKey,
    meta: modifiers.metaKey
  }
}

/**
 * 修飾キー自身を割り当てるときは、その修飾フラグを落とす。
 * Ctrl を押すと ctrlKey も立つため、そのままでは「Ctrl + Ctrl」になる。
 */
function normalizeSelfModifier(binding: HotkeyBinding): HotkeyBinding {
  if (binding.device !== 'key' || !isModifierCode(binding.code)) return binding

  const isCtrl = binding.code === 29 || binding.code === 3613
  const isShift = binding.code === 42 || binding.code === 54
  const isAlt = binding.code === 56 || binding.code === 3640
  const isMeta = binding.code === 3675 || binding.code === 3676

  return {
    ...binding,
    ctrl: isCtrl ? false : binding.ctrl,
    shift: isShift ? false : binding.shift,
    alt: isAlt ? false : binding.alt,
    meta: isMeta ? false : binding.meta
  }
}
