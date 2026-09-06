import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { intervalStateSchema } from '../schemas'
import type { IpcContext } from '../context'

/**
 * 定期キャプチャーの実行状況を受け取る。
 *
 * 撮影そのものは Renderer が回している。Main が知りたいのは「いま撮っているか」と
 * 「何枚撮れたか」だけで、それを通知領域のアイコンとウィンドウの出し入れに使う。
 */
export function registerIntervalHandlers(context: IpcContext): void {
  ipcMain.handle(IPC.intervalCapture.report, (_event, payload: unknown) => {
    context.onIntervalState(intervalStateSchema.parse(payload))
  })
}
