import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { CaptureEngineError } from '@main/capture/CaptureEngine'
import { createLogger } from '@main/lib/logger'
import { captureProfileSchema } from '../schemas'
import type { IpcContext } from '../context'

const log = createLogger('ipc-capture')

/**
 * エンジン由来の失敗を、Renderer 側でそのまま表示できる日本語メッセージに揃えて投げ直す。
 * ここを通さないと OBS の英語スタックトレースが UI に出る。
 */
function rethrowAsUserMessage(err: unknown, fallback: string): never {
  if (err instanceof CaptureEngineError) {
    log.error('キャプチャ操作に失敗しました', err.cause ?? err)
    throw new Error(err.userMessage)
  }
  log.error(fallback, err)
  throw new Error(withEngineDetail(fallback, err))
}

/**
 * エンジンが返した理由を日本語の文へ添える。
 *
 * 想定していない失敗を「できませんでした」の一言で畳んでしまうと、ログを取り出せる人以外は
 * 何が起きたのか永久に分からない。原因は把握していなくても、エンジンが何と言ったかは伝わる。
 * 見覚えのある言い回しは日本語にし、それ以外は原文のまま添える。
 */
function withEngineDetail(fallback: string, err: unknown): string {
  const raw = err instanceof Error ? err.message.trim() : ''
  if (!raw) return fallback

  return `${fallback}${translateEngineMessage(raw) ?? `（エンジンの応答: ${raw}）`}`
}

/** よく出るものだけ、次の一手が分かる日本語にする。 */
function translateEngineMessage(raw: string): string | null {
  if (/No source was found/i.test(raw)) {
    return '映像ソースが用意できていません。キャプチャ対象を選び直してください。'
  }
  if (/not ready/i.test(raw)) {
    return 'エンジンがまだ操作を受け付けられません。少し待ってからお試しください。'
  }
  if (/already active|already recording/i.test(raw)) {
    return 'すでに録画中です。'
  }
  if (/directory|path|permission|denied/i.test(raw)) {
    return `保存先へ書き込めませんでした。保存先の設定をご確認ください。（${raw}）`
  }
  return null
}

export function registerCaptureHandlers(context: IpcContext): void {
  ipcMain.handle(IPC.capture.getCapabilities, async () => {
    try {
      return await context.engine.getCapabilities()
    } catch (err) {
      return rethrowAsUserMessage(err, 'この PC のキャプチャ機能を取得できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.restartEngine, async () => {
    try {
      await context.restartEngine()
    } catch (err) {
      return rethrowAsUserMessage(err, 'キャプチャエンジンを起動し直せませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.listWindows, async () => {
    try {
      return await context.engine.listWindows()
    } catch (err) {
      return rethrowAsUserMessage(err, 'ウィンドウ一覧を取得できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.start, async (_event, payload: unknown) => {
    const parsed = captureProfileSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正な録画設定を受け取りました', parsed.error.issues)
      throw new Error('録画設定に不正な値が含まれているため、録画を開始できません。')
    }

    try {
      await context.engine.startRecording(parsed.data)
      context.onRecordingStarted()
    } catch (err) {
      return rethrowAsUserMessage(err, '録画を開始できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.stop, async () => {
    try {
      return await context.engine.stopRecording()
    } catch (err) {
      return rethrowAsUserMessage(err, '録画を停止できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.pause, async () => {
    try {
      await context.engine.pauseRecording()
    } catch (err) {
      return rethrowAsUserMessage(err, '録画を一時停止できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.resume, async () => {
    try {
      await context.engine.resumeRecording()
    } catch (err) {
      return rethrowAsUserMessage(err, '録画を再開できませんでした。')
    }
  })

  ipcMain.handle(IPC.capture.screenshot, async () => {
    try {
      const file = await context.engine.takeScreenshot(context.getSettings().profile)

      // 撮影の起点はホットキー・メインウィンドウ・ファインダーのバーと複数ある。
      // 呼び出し元へ返すだけでは他の窓が撮れたことを知れないため、保存の事実を配る。
      context.onScreenshotSaved(file)
      return file
    } catch (err) {
      return rethrowAsUserMessage(err, '静止画を保存できませんでした。')
    }
  })
}
