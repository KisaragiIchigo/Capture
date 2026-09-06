import { app, ipcMain, shell } from 'electron'
import { IPC, type AppInfo } from '@shared/types'
import { mkdirSync } from 'node:fs'
import { createLogger } from '@main/lib/logger'
import { logDirectory } from '@main/lib/paths'
import { pathPayloadSchema } from '../schemas'

const log = createLogger('ipc-system')

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC.system.openPath, async (_event, payload: unknown) => {
    const parsed = pathPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正なパスを受け取りました', parsed.error.issues)
      throw new Error('指定されたファイルを開けませんでした。')
    }

    const error = await shell.openPath(parsed.data)
    if (error) throw new Error('指定された場所を開けませんでした。移動または削除されていないかご確認ください。')
  })

  ipcMain.handle(IPC.system.revealInExplorer, (_event, payload: unknown) => {
    const parsed = pathPayloadSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正なパスを受け取りました', parsed.error.issues)
      throw new Error('指定された場所を開けませんでした。')
    }

    shell.showItemInFolder(parsed.data)
  })

  ipcMain.handle(IPC.system.openLogFolder, async () => {
    const directory = logDirectory()

    // まだ 1 行も書いていなければフォルダ自体が無い。開けないより、空でも開けるほうがよい。
    mkdirSync(directory, { recursive: true })

    const error = await shell.openPath(directory)
    if (error) throw new Error('ログの保存先を開けませんでした。')
  })

  ipcMain.handle(IPC.system.getAppInfo, (): AppInfo => {
    return {
      version: app.getVersion(),
      electronVersion: process.versions.electron ?? 'unknown',
      platform: process.platform
    }
  })
}
