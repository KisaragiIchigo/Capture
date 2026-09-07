import { BrowserWindow, ipcMain } from 'electron'
import { IPC, type SetupProgress, type SetupState } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import {
  installEngine,
  isEngineBundled,
  isEngineInstalled,
  isEngineOutdated
} from '@main/setup/installEngine'
import type { IpcContext } from '../context'

const log = createLogger('ipc-setup')

let controller: AbortController | null = null

function send(progress: SetupProgress): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send(IPC.events.setupProgress, progress)
  }
}

/**
 * キャプチャエンジンの導入を実行する。
 *
 * 入口は 2 つある。利用者が準備画面のボタンを押した場合と、同梱されたエンジンがあって
 * 起動時に自動で始める場合。どちらも同じ経路を通し、進捗も同じように流す。
 */
export async function runInstall(context: IpcContext): Promise<void> {
  if (controller) return

  controller = new AbortController()
  const signal = controller.signal

  try {
    await installEngine(send, signal)
    send({ phase: 'done', receivedBytes: 0, totalBytes: 0, ratio: 1, message: null })

    // 展開が済んだら、そのままエンジンを立ち上げて録画できる状態まで持っていく。
    await context.startEngine()
  } catch (err) {
    const aborted = signal.aborted
    log.error('キャプチャエンジンの準備に失敗しました', err)

    send({
      phase: aborted ? 'idle' : 'error',
      receivedBytes: 0,
      totalBytes: 0,
      ratio: 0,
      message: aborted ? null : toUserMessage(err)
    })
  } finally {
    controller = null
  }
}

/**
 * キャプチャエンジンの取得と展開。
 *
 * ユーザーにコマンドを叩かせないための経路。進捗はイベントで流し、
 * 完了したらそのままエンジンの起動まで進めて、セットアップ画面から録画画面へ抜けさせる。
 */
export function registerSetupHandlers(context: IpcContext): () => void {
  ipcMain.handle(
    IPC.setup.getState,
    (): SetupState => ({
      // 同梱物より古い配置は、使える状態とは見なさない。入れ替えの間は準備画面へ寄せる。
      installed: isEngineInstalled() && !isEngineOutdated(),
      installing: controller !== null,
      bundled: isEngineBundled()
    })
  )

  ipcMain.handle(IPC.setup.install, () => runInstall(context))

  ipcMain.handle(IPC.setup.cancel, () => {
    controller?.abort()
  })

  return () => {
    controller?.abort()
    controller = null
  }
}

function toUserMessage(err: unknown): string {
  if (err instanceof Error && err.message) return err.message
  return 'キャプチャエンジンの準備中に予期しないエラーが発生しました。'
}
