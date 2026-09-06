import { BrowserWindow, dialog, ipcMain } from 'electron'
import type { WebContents } from 'electron'
import { IPC, type AppSettings } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { ensureOutputDirectory, saveSettings } from '@main/settings/store'
import { appSettingsSchema } from '../schemas'
import { applyRegionToFinder } from './finderHandlers'
import type { IpcContext } from '../context'

const log = createLogger('ipc-settings')

/**
 * 保存された設定を他の窓へ配る。
 *
 * 書き換えた本人へは返さない。入力中に自分の書いた値が往復して戻ってくると、
 * その間に打った続きを古い値で上書きしてしまう。
 */
function notifySettings(settings: AppSettings, origin: WebContents): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) continue
    if (window.webContents.id === origin.id) continue
    window.webContents.send(IPC.events.settingsChanged, settings)
  }
}

export function registerSettingsHandlers(context: IpcContext): void {
  ipcMain.handle(IPC.settings.load, () => context.getSettings())

  ipcMain.handle(IPC.settings.save, (event, payload: unknown) => {
    const parsed = appSettingsSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正な設定を受け取りました', parsed.error.issues)
      throw new Error('設定に不正な値が含まれているため、保存できません。')
    }

    context.setSettings(parsed.data)
    saveSettings(parsed.data)
    ensureOutputDirectory(parsed.data.profile.outputDirectory)

    notifySettings(parsed.data, event.sender)

    // 設定画面で範囲の数値を変えたとき、開いているファインダーを追従させる。
    if (parsed.data.profile.region) applyRegionToFinder(parsed.data.profile.region)

    // 設定変更をプレビューへ即座に映す。録画中は設定がロックされているのでここへは来ない。
    context.engine.applySource(parsed.data.profile).catch((err) => {
      log.warn('変更後の設定でソースを組み立てられませんでした', err)
    })
  })

  // 記録中は照合を止めるので、F9 を割り当てようとして録画が始まることはない。
  ipcMain.handle(IPC.settings.beginHotkeyCapture, () => context.beginHotkeyCapture())
  ipcMain.handle(IPC.settings.cancelHotkeyCapture, () => context.cancelHotkeyCapture())

  ipcMain.handle(IPC.settings.pickImageFile, async () => {
    const window = context.getWindow()
    const options = {
      title: '重ねる画像を選択',
      filters: [{ name: '画像', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }],
      properties: ['openFile'] as const
    }

    const result = window
      ? await dialog.showOpenDialog(window, { ...options, properties: [...options.properties] })
      : await dialog.showOpenDialog({ ...options, properties: [...options.properties] })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })

  ipcMain.handle(IPC.settings.pickOutputDirectory, async () => {
    const window = context.getWindow()
    const options = {
      title: '録画ファイルの保存先を選択',
      defaultPath: context.getSettings().profile.outputDirectory,
      properties: ['openDirectory', 'createDirectory'] as const
    }

    const result = window
      ? await dialog.showOpenDialog(window, { ...options, properties: [...options.properties] })
      : await dialog.showOpenDialog({ ...options, properties: [...options.properties] })

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0] ?? null
  })
}
