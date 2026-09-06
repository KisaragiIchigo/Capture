import { app, ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { IpcContext } from '../context'

/** 枠なしウィンドウの操作。タイトルバーは Renderer が描くため、実操作はここへ回ってくる。 */
export function registerWindowHandlers(context: IpcContext): void {
  ipcMain.handle(IPC.window.show, () => {
    const window = context.getWindow()
    if (!window || window.isDestroyed()) return

    // 最小化されている場合は戻してから前面へ出す。show だけでは復元されない。
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })

  ipcMain.handle(IPC.window.toggle, () => {
    const window = context.getWindow()
    if (!window || window.isDestroyed()) return

    // 最小化も「隠れている」に含める。出ている状態だけを引っ込める対象にする。
    if (window.isVisible() && !window.isMinimized()) {
      window.minimize()
      return
    }

    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })

  ipcMain.handle(IPC.window.minimize, () => {
    context.getWindow()?.minimize()
  })

  ipcMain.handle(IPC.window.toggleMaximize, () => {
    const window = context.getWindow()
    if (!window) return
    if (window.isMaximized()) window.unmaximize()
    else window.maximize()
  })

  ipcMain.handle(IPC.window.close, () => {
    context.getWindow()?.close()
  })

  /*
   * 録画中でも直接終了してよい。before-quit がエンジンの停止を待ってからプロセスを畳み、
   * その停止処理は録画を先に止めてコンテナのインデックスを書かせる。
   * 途中で切られた壊れたファイルが残ることはない。
   */
  ipcMain.handle(IPC.window.quit, () => {
    app.quit()
  })
}
