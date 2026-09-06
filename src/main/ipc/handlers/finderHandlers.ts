import { BrowserWindow, ipcMain } from 'electron'
import {
  FINDER_BAR_HEIGHT,
  IPC,
  minimumWindowSize,
  regionToWindowBounds,
  type RegionRect,
  type WindowBounds
} from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { createFinderWindow, readRegionFromWindow } from '@main/window/createFinderWindow'
import { defaultRegionFor, saveSettings } from '@main/settings/store'
import { finderBoundsSchema } from '../schemas'
import type { IpcContext } from '../context'

const log = createLogger('ipc-finder')

/** ドラッグ中に毎フレーム書き込まないための待ち時間。 */
const SAVE_DEBOUNCE_MS = 400

let finderWindow: BrowserWindow | null = null
/** 今開いている姿が枠付きかどうか。最小サイズと位置の同期がこれで変わる。 */
let framed = true
let saveTimer: NodeJS.Timeout | null = null
/** IPC 経由でも起動シーケンスからでも同じ経路を通せるよう、開く処理を保持する。 */
let openHandler: (() => void) | null = null

/**
 * 範囲指定ファインダーの開閉と、ウィンドウ位置から録画範囲への反映。
 *
 * 同期の向きを 2 本に分けて、それぞれ一方通行にしている。混ぜると往復して発振する。
 *   ファインダーを動かした → 設定へ書き戻し、メインウィンドウへ通知（syncRegion）
 *   設定側で数値を変えた   → ファインダーを動かすだけ（applyRegionToFinder）
 */
export function registerFinderHandlers(context: IpcContext): () => void {
  const syncRegion = (): void => {
    if (!finderWindow || finderWindow.isDestroyed()) return
    // 枠を持たない姿のときは、窓の位置が録画範囲を意味しない。
    if (context.getSettings().profile.sourceKind !== 'region') return

    const region = readRegionFromWindow(finderWindow)
    const settings = context.getSettings()
    const next = { ...settings, profile: { ...settings.profile, region } }
    context.setSettings(next)

    /*
     * ドラッグ中は毎フレーム呼ばれる。書き込みとソースの組み直しはまとめる。
     * 設定を書き換えるだけではクロップは変わらないため、ここで必ず反映まで通す。
     * これを怠ると、枠を動かしても録れるのは最初に指定した範囲のままになる。
     */
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = null
      const settled = context.getSettings()
      saveSettings(settled)
      context.onRegionSettled(settled.profile)
    }, SAVE_DEBOUNCE_MS)

    const main = context.getWindow()
    if (main && !main.isDestroyed()) main.webContents.send(IPC.events.regionChanged, region)
  }

  const notifyVisibility = (visible: boolean): void => {
    const main = context.getWindow()
    if (main && !main.isDestroyed()) main.webContents.send(IPC.events.finderVisibility, visible)
  }

  const closeFinder = (): void => {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
      saveSettings(context.getSettings())
    }

    const target = finderWindow
    finderWindow = null
    if (target && !target.isDestroyed()) target.destroy()
    notifyVisibility(false)
  }

  openHandler = () => {
    if (finderWindow && !finderWindow.isDestroyed()) {
      finderWindow.showInactive()
      notifyVisibility(true)
      return
    }

    const settings = context.getSettings()
    // 範囲指定のときだけ枠を出す。それ以外は操作バーだけの姿にする。
    const region =
      settings.profile.sourceKind === 'region'
        ? (settings.profile.region ?? defaultRegionFor(settings.profile.sourceId))
        : null

    framed = region !== null
    finderWindow = createFinderWindow(region)

    // 枠を描くかどうかは窓の姿と一致していなければならない。読み込み後に伝える。
    const kind = settings.profile.sourceKind
    finderWindow.webContents.once('did-finish-load', () => {
      if (!finderWindow || finderWindow.isDestroyed()) return
      finderWindow.webContents.send(IPC.events.finderMode, kind)
    })

    finderWindow.on('closed', () => {
      finderWindow = null
      notifyVisibility(false)
    })


    // 開いた時点の位置も設定へ書き戻し、枠と設定が最初から一致している状態にする。
    finderWindow.once('ready-to-show', () => {
      syncRegion()
      notifyVisibility(true)
    })

    // 開いた直後はイベントを 1 度も受け取っていない。今の状態を明示的に流し込む。
    finderWindow.webContents.once('did-finish-load', () => {
      if (!finderWindow || finderWindow.isDestroyed()) return
      finderWindow.webContents.send(IPC.events.engineState, context.engine.state)
    })
  }

  ipcMain.handle(IPC.finder.open, () => openHandler?.())

  ipcMain.handle(IPC.finder.close, () => closeFinder())

  /**
   * 録画中は大きさを変えさせない。
   *
   * 出力の解像度は録画の開始時に決まる。途中で変えると録画そのものが壊れるため、
   * 受け取った大きさは捨てて位置だけを反映する。縁の掴み代は録画中は出していないので、
   * ここへ届くのは移動の最中に寸法が丸められた場合に限られる。
   */
  const lockSizeWhileRecording = (window: BrowserWindow, bounds: WindowBounds): WindowBounds => {
    const status = context.engine.state.status
    if (status !== 'recording' && status !== 'paused') return bounds

    const current = window.getBounds()
    return { ...bounds, width: current.width, height: current.height }
  }

  ipcMain.handle(IPC.finder.setBounds, (_event, payload: unknown) => {
    if (!finderWindow || finderWindow.isDestroyed()) return

    const parsed = finderBoundsSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正なファインダー位置を受け取りました', parsed.error.issues)
      return
    }

    finderWindow.setBounds(withMinimumSize(lockSizeWhileRecording(finderWindow, parsed.data)))
    syncRegion()
  })

  ipcMain.handle(IPC.finder.setIgnoreMouse, (event, payload: unknown) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window || window.isDestroyed()) return

    // forward を立てないと、透過部分に入った時点で mousemove が届かなくなり、
    // カーソルが操作領域へ戻ってきても元に戻せなくなる。
    window.setIgnoreMouseEvents(payload === true, { forward: true })
  })

  return () => {
    openHandler = null
    closeFinder()
  }
}

/**
 * 設定側で範囲が変わったときに、ファインダーの位置を合わせる。
 * ここから syncRegion を呼ばないこと。呼ぶと設定への書き戻しが往復して発振する。
 */
export function applyRegionToFinder(region: RegionRect): void {
  if (!finderWindow || finderWindow.isDestroyed()) return
  // 枠を持たない姿では、窓の位置と録画範囲は無関係。動かしてはいけない。
  if (!framed) return

  const target = withMinimumSize(regionToWindowBounds(region))
  const current = finderWindow.getBounds()

  // すでに一致しているなら触らない。無用な再配置でドラッグ中の枠が跳ねる。
  if (
    current.x === target.x &&
    current.y === target.y &&
    current.width === target.width &&
    current.height === target.height
  ) {
    return
  }

  finderWindow.setBounds(target)
}

/** 起動時の復元など、IPC を介さずにファインダーを開く。 */
export function openFinder(): void {
  openHandler?.()
}

/**
 * ファインダーを最前面の中でも一番手前へ上げる。
 *
 * 描き込みの窓と同じ 'screen-saver' の層にいるため、後から作られた側が上に乗る。
 * そのままだと操作バーが描画面の下に隠れ、ペンを消すことも録画を止めることもできなくなる。
 */
export function raiseFinder(): void {
  if (!finderWindow || finderWindow.isDestroyed()) return
  finderWindow.setAlwaysOnTop(true, 'screen-saver')
  finderWindow.moveTop()
}

/**
 * 最小サイズを下回る指定は切り上げる。
 * 枠付きは録画範囲としてエンコーダが受け付ける大きさ、
 * バーだけの姿は操作が並ぶ高さが下限になる。
 */
function withMinimumSize(bounds: WindowBounds): WindowBounds {
  const minimum = framed
    ? minimumWindowSize()
    : { width: 240, height: FINDER_BAR_HEIGHT }
  return {
    x: bounds.x,
    y: bounds.y,
    width: Math.max(minimum.width, bounds.width),
    height: Math.max(minimum.height, bounds.height)
  }
}
