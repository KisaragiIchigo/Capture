import { EventSubscription, OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'
import { CaptureEngineError } from '../CaptureEngine'

const log = createLogger('obs-connect')

const RETRY_INTERVAL_MS = 500
// 初回起動はプラグインの読み込みに時間がかかる。30 秒まで待つ。
const MAX_ATTEMPTS = 60

/**
 * 接続できてからリクエストを受け付けられるまでの待ち上限。
 *
 * WebSocket サーバーは OBS の初期化が終わる前から待ち受けを始める。プラグインの読み込みや
 * シェーダーの用意が残っている間は、つないでも「まだ準備できていない」と返される。
 * この差は速い PC ではほぼ生まれず、遅い PC や初回起動でだけ表面化する。
 */
const READY_TIMEOUT_MS = 30_000

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * 起動直後の OBS は WebSocket サーバの待ち受けまで数秒かかる。
 * 接続拒否は正常な途中経過なので、上限まで黙って叩き続ける。
 */
export async function connectObs(port: number, password: string): Promise<OBSWebSocket> {
  const obs = new OBSWebSocket()
  const url = `ws://127.0.0.1:${port}`

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      await obs.connect(url, password, {
        eventSubscriptions:
          EventSubscription.General | EventSubscription.Outputs | EventSubscription.Inputs,
        rpcVersion: 1
      })
      log.info('OBS へ接続しました', { attempt })

      await waitUntilReady(obs)
      return obs
    } catch (err) {
      // 準備が整わないまま打ち切った場合、つないだままにすると次の試行が塞がれる。
      await obs.disconnect().catch(() => undefined)

      if (attempt === MAX_ATTEMPTS) {
        throw new CaptureEngineError(
          'キャプチャエンジンへの接続がタイムアウトしました。ウイルス対策ソフトが obs64.exe をブロックしていないかご確認ください。',
          err
        )
      }
      await delay(RETRY_INTERVAL_MS)
    }
  }

  throw new CaptureEngineError('キャプチャエンジンへの接続に失敗しました。')
}

/**
 * リクエストを受け付けられる状態になるまで待つ。
 *
 * 接続できたことと、操作できることは別物である。つないだ直後に設定の書き換えを投げると
 * 「OBS is not ready to perform the request.」で弾かれ、起動そのものが失敗したように見える。
 *
 * 失敗の種類で分岐せず、通るまで一律に試し直す。準備中に返るものは実装や版で変わり得るし、
 * ここで投げている GetVersion は何度呼んでも状態を変えない。
 */
async function waitUntilReady(obs: OBSWebSocket): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  let attempt = 0

  for (;;) {
    attempt += 1

    try {
      await obs.call('GetVersion')
      if (attempt > 1) log.info('OBS が操作を受け付けられる状態になりました', { attempt })
      return
    } catch (err) {
      if (Date.now() >= deadline) {
        throw new CaptureEngineError(
          'キャプチャエンジンが操作を受け付ける状態になりませんでした。時間をおいてから、もう一度お試しください。',
          err
        )
      }
      await delay(RETRY_INTERVAL_MS)
    }
  }
}
