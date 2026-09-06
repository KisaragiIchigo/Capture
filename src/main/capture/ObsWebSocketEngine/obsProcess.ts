import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { createLogger } from '@main/lib/logger'
import { obsBinDir, obsExecutable, obsPortableMarker } from '@main/lib/paths'
import { CaptureEngineError } from '../CaptureEngine'
import { writeWebSocketConfig } from './obsProfile'

const log = createLogger('obs-process')

export interface ObsProcessHandle {
  process: ChildProcess
  port: number
  password: string
}

/** 同梱 OBS が展開済みかを確認する。未配置なら UI に出せるメッセージを添えて投げる。 */
function assertObsInstalled(): void {
  if (existsSync(obsExecutable())) return
  throw new CaptureEngineError(
    'キャプチャエンジンが見つかりません。アプリを再起動すると、準備画面から取得できます。'
  )
}

/**
 * OBS をポータブル・ヘッドレス寄りの構成で起動する。
 *
 * cwd を bin/64bit に合わせるのは、OBS が data/ と obs-plugins/ を実行ファイルからの
 * 相対パスで解決するため。ここを外すとプラグインが 1 つも読み込まれず、
 * game_capture が候補に出ないという分かりにくい壊れ方をする。
 */
export function launchObs(port: number): ObsProcessHandle {
  assertObsInstalled()

  if (!existsSync(obsPortableMarker())) {
    throw new CaptureEngineError(
      'キャプチャエンジンの構成が壊れています。このままでは、お使いの PC の OBS 設定を書き換えてしまう恐れがあるため起動できません。エンジンを取得し直してください。'
    )
  }

  const password = randomBytes(16).toString('hex')

  // サーバーの有効化は設定ファイルでしか行えない。起動より先に書く。
  writeWebSocketConfig(port, password)

  const args = [
    '--portable',
    '--multi',
    '--minimize-to-tray',
    '--disable-shutdown-check',
    '--websocket_port',
    String(port),
    '--websocket_password',
    password,
    '--websocket_ipv4_only'
  ]

  log.info('OBS を起動します', { port })
  const child = spawn(obsExecutable(), args, {
    cwd: obsBinDir(),
    windowsHide: true,
    stdio: 'ignore',
    detached: false
  })

  child.on('error', (err) => log.error('OBS の起動に失敗しました', err))
  child.on('exit', (code, signal) => log.info('OBS が終了しました', { code, signal }))

  return { process: child, port, password }
}

/**
 * OBS へ終了を要求し、応じなければ強制終了する。
 * WebSocket 経由の正常終了を先に試すのは、録画ファイルの moov atom を確実に書かせるため。
 */
export async function terminateObs(
  handle: ObsProcessHandle,
  gracefulStop: () => Promise<void>,
  timeoutMs = 8000
): Promise<void> {
  const exited = new Promise<void>((resolve) => {
    if (handle.process.exitCode !== null) return resolve()
    handle.process.once('exit', () => resolve())
  })

  try {
    await gracefulStop()
  } catch (err) {
    log.warn('OBS の正常終了要求に失敗しました。強制終了へ移行します', err)
  }

  const timer = setTimeout(() => {
    if (handle.process.exitCode === null) {
      log.warn('OBS が時間内に終了しなかったため強制終了します')
      handle.process.kill()
    }
  }, timeoutMs)

  await exited
  clearTimeout(timer)
}
