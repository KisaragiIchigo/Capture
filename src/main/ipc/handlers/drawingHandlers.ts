import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { CaptureProfile } from '@shared/types'
import { createDrawingWindow, resolveDrawingArea } from '@main/window/createDrawingWindow'
import { raiseFinder } from './finderHandlers'
import type { IpcContext } from '../context'

let drawingWindow: BrowserWindow | null = null
/** ホットキーからも同じ経路を通すために保持する。 */
let toggleHandler: (() => void) | null = null

/**
 * 画面へ描き込む窓の開閉。
 *
 * 開いている間は全画面を覆うため、下のアプリを操作できなくなる。
 * 閉じる手段（パレットの×と Esc）を必ず残すこと。
 */
export function registerDrawingHandlers(context: IpcContext): () => void {
  // ファインダーのバーも開閉状態を点灯に使うため、メインだけでなく全ウィンドウへ配る。
  const notify = (visible: boolean): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC.events.drawingVisibility, visible)
    }
  }

  const close = (): void => {
    const target = drawingWindow
    drawingWindow = null
    if (target && !target.isDestroyed()) target.destroy()
    notify(false)
  }

  const open = (): void => {
    if (drawingWindow && !drawingWindow.isDestroyed()) {
      drawingWindow.show()
      raiseFinder()
      notify(true)
      return
    }

    const { profile } = context.getSettings()
    // 覆うのは録画される範囲だけ。外まで覆うと操作バーへ手が届かなくなる。
    drawingWindow = createDrawingWindow(profile)
    drawingWindow.on('closed', () => {
      drawingWindow = null
      notify(false)
    })

    // 描画面より操作バーを手前に置く。ここを忘れると、ペンを閉じる手段が画面から消える。
    drawingWindow.once('ready-to-show', () => raiseFinder())
    notify(true)
  }

  /*
   * 開閉の判断はここでしか行わない。
   * Renderer に持たせた状態で切り替えると、通知の行き違いで
   * 「閉じたいのに開き直す」という噛み合わない挙動になる。
   */
  toggleHandler = () => {
    if (drawingWindow && !drawingWindow.isDestroyed()) close()
    else open()
  }

  ipcMain.handle(IPC.drawing.open, () => open())
  ipcMain.handle(IPC.drawing.close, () => close())
  ipcMain.handle(IPC.drawing.toggle, () => toggleHandler?.())

  return () => {
    toggleHandler = null
    close()
  }
}

/** ホットキーなど、IPC を介さずに開閉する経路。 */
export function toggleDrawingWindow(): void {
  toggleHandler?.()
}

/**
 * 開いている描き込み面を、今の録画範囲へ合わせ直す。
 *
 * 描き込み面は録画範囲にぴったり重ねている。開いたあとに範囲を動かされると、
 * 描ける場所と実際に映る場所がずれ、範囲の外に描いて何も残らない状態になる。
 * 設定が変わる経路はひとつに絞ってあるので、そこから必ずここを通す。
 */
export function updateDrawingArea(profile: CaptureProfile): void {
  const window = drawingWindow
  if (!window || window.isDestroyed()) return
  window.setBounds(resolveDrawingArea(profile))
}
