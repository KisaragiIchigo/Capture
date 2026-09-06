import { BrowserWindow } from 'electron'
import { IPC } from '@shared/types'
import type { IpcContext } from './context'
import { registerCaptureHandlers } from './handlers/captureHandlers'
import { registerSettingsHandlers } from './handlers/settingsHandlers'
import { registerSystemHandlers } from './handlers/systemHandlers'
import { registerWindowHandlers } from './handlers/windowHandlers'
import { registerFinderHandlers } from './handlers/finderHandlers'
import { registerSetupHandlers } from './handlers/setupHandlers'
import { registerDrawingHandlers } from './handlers/drawingHandlers'
import { registerIntervalHandlers } from './handlers/intervalHandlers'

/**
 * IPC ハンドラの登録と、エンジンから Renderer への通知の配線をまとめる。
 * 追加するハンドラはここへ 1 行足すだけで済むよう、領域ごとにファイルを分けている。
 */
export function registerIpc(context: IpcContext): () => void {
  registerCaptureHandlers(context)
  registerSettingsHandlers(context)
  registerSystemHandlers()
  registerWindowHandlers(context)
  registerIntervalHandlers(context)
  const closeFinder = registerFinderHandlers(context)
  const cancelSetup = registerSetupHandlers(context)
  const closeDrawing = registerDrawingHandlers(context)

  /**
   * エンジンの状態は範囲指定ファインダーも必要とする。
   * メインウィンドウだけへ送ると、ファインダーの録画ボタンが永久に無効のままになる。
   */
  const broadcast = (channel: string, payload: unknown): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }

  const unsubscribers = [
    context.engine.onStateChange((state) => broadcast(IPC.events.engineState, state)),
    context.engine.onStats((stats) => broadcast(IPC.events.recordingStats, stats)),
    context.engine.onFinished((result) => broadcast(IPC.events.recordingFinished, result))
  ]

  return () => {
    cancelSetup()
    closeDrawing()
    closeFinder()
    unsubscribers.forEach((unsubscribe) => unsubscribe())
  }
}
