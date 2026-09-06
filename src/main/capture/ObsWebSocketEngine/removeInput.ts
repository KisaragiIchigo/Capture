import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'

const log = createLogger('obs-remove')

/** 削除完了イベントを待つ上限。これを超えたら諦めて先へ進む。 */
const REMOVE_TIMEOUT_MS = 3000

/**
 * ソースを削除し、OBS 側で実際に消えるまで待つ。
 *
 * RemoveInput は要求が受理された時点で応答が返り、実際の破棄は OBS 内部で後から行われる。
 * 応答だけを見て次の CreateInput へ進むと
 * 「A source already exists by that input name」で失敗する。
 * 起動時は削除と作成の間に他の処理が挟まって偶然通るが、
 * 録画開始のように連続で組み立てる場面で必ず露見する。
 *
 * InputRemoved イベントで完了を確かめる。イベントを取りこぼしても止まらないよう、
 * 上限時間で切り上げて先へ進める。
 */
export async function removeInputAndWait(obs: OBSWebSocket, inputName: string): Promise<void> {
  const removed = new Promise<void>((resolve) => {
    const handler = (event: { inputName?: string }): void => {
      if (event.inputName !== inputName) return
      obs.off('InputRemoved', handler)
      resolve()
    }

    obs.on('InputRemoved', handler)

    setTimeout(() => {
      obs.off('InputRemoved', handler)
      resolve()
    }, REMOVE_TIMEOUT_MS)
  })

  try {
    await obs.call('RemoveInput', { inputName })
  } catch {
    // 元から存在しない場合はここへ来る。待つ必要もない。
    return
  }

  await removed
  log.info('ソースを削除しました', { inputName })
}
