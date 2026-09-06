import { app, Menu, nativeImage, Tray, type BrowserWindow } from 'electron'
import { createLogger } from '@main/lib/logger'
import { TRAY_ICON_ACTIVE, TRAY_ICON_IDLE } from './trayIcons'

const log = createLogger('tray')

/**
 * 定期キャプチャーのためのタスクトレイ常駐。
 *
 * 撮り続けている間、ウィンドウは画面から退かせたい。しかし退けたきり何の印も残らないと、
 * 撮っているのか止まっているのかを確かめる手段がなくなる。トレイのアイコンは
 * その 1 点のためにあり、色だけで「いま撮っているか」を伝える。
 *
 * 定期キャプチャーを使わない間はアイコンを出さない。使っていない機能の常駐は、
 * 通知領域を 1 枠占めるだけで何も伝えない。
 */
export interface TrayState {
  /** 定期キャプチャーの設定が有効かどうか。false の間はアイコンを出さない。 */
  enabled: boolean
  /** いま撮り続けているかどうか。 */
  active: boolean
  /** 今回の実行で保存できた枚数。 */
  shots: number
  /** 撮影の間隔（秒）。ヒントに出す。 */
  intervalSec: number
}

export interface TrayActions {
  /** 定期キャプチャーの開始 / 停止。 */
  toggleCapture: () => void
  /** メインウィンドウを呼び戻す。 */
  showWindow: () => void
  quit: () => void
}

export class CaptureTray {
  private tray: Tray | null = null
  private state: TrayState = { enabled: false, active: false, shots: 0, intervalSec: 0 }

  constructor(private readonly actions: TrayActions) {}

  /** 状態を反映する。必要なら常駐を始め、不要になったら畳む。 */
  update(state: TrayState): void {
    this.state = state

    if (!state.enabled) {
      this.destroy()
      return
    }

    const tray = this.ensure()
    if (!tray) return

    tray.setImage(iconFor(state.active))
    tray.setToolTip(tooltipFor(state))
    tray.setContextMenu(this.buildMenu())
  }

  /** いま通知領域にアイコンが出ているか。ウィンドウを引っ込めてよいかの判断に使う。 */
  isPresent(): boolean {
    return this.tray !== null && !this.tray.isDestroyed()
  }

  destroy(): void {
    if (!this.tray) return
    this.tray.destroy()
    this.tray = null
  }

  private ensure(): Tray | null {
    if (this.tray && !this.tray.isDestroyed()) return this.tray

    try {
      const tray = new Tray(iconFor(this.state.active))

      // 通知領域のアイコンは、まずクリックされる。押して何も起きないと壊れて見える。
      tray.on('click', () => this.actions.showWindow())
      tray.on('double-click', () => this.actions.showWindow())

      this.tray = tray
      return tray
    } catch (err) {
      // 常駐に失敗しても撮影そのものは続けられる。ここでアプリを止めない。
      log.warn('タスクトレイのアイコンを作成できませんでした', err)
      return null
    }
  }

  private buildMenu(): Menu {
    const { active, enabled } = this.state

    return Menu.buildFromTemplate([
      {
        label: active ? '定期キャプチャーを停止' : '定期キャプチャーを開始',
        enabled,
        click: () => this.actions.toggleCapture()
      },
      { type: 'separator' },
      { label: 'ウィンドウを表示', click: () => this.actions.showWindow() },
      { type: 'separator' },
      { label: '終了', click: () => this.actions.quit() }
    ])
  }
}

function iconFor(active: boolean): Electron.NativeImage {
  return nativeImage.createFromDataURL(active ? TRAY_ICON_ACTIVE : TRAY_ICON_IDLE)
}

/**
 * ヒントは、アイコンの色だけでは足りない情報を補う。
 * 何枚撮れたかは、止めどきを決めるためにいちばん見たい値になる。
 */
function tooltipFor(state: TrayState): string {
  const name = app.getName()

  if (!state.active) return `${name} — 定期キャプチャーは停止中です`
  return `${name} — 定期キャプチャー中（${state.intervalSec} 秒ごと / ${state.shots} 枚）`
}

/**
 * ウィンドウを通知領域へ引っ込める。
 *
 * 最小化ではなく非表示にするのは、タスクバーにも残さないため。撮影中の目印は
 * トレイのアイコン 1 つに集約する。
 */
export function hideToTray(window: BrowserWindow | null): void {
  if (!window || window.isDestroyed() || !window.isVisible()) return
  window.hide()
}
