import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'
import { removeInputAndWait } from './removeInput'

const log = createLogger('obs-input')

export type InputSettings = Record<string, unknown>

/**
 * ソースを目的の状態にする。
 *
 * 削除してから作り直すのではなく、種別が同じなら設定を上書きして再利用する。
 * OBS の RemoveInput は応答も InputRemoved イベントも実際の解放より早く返り、
 * 直後の CreateInput が「A source already exists by that input name」で失敗する。
 * 待ち方を工夫しても追いかけっこになるので、そもそも削除を通らない道を主にする。
 *
 * 設定は overlay: false で全置換するため、前の値が残って取り違える心配はない。
 * 種別が変わるときだけ作り直し、そのときは解放を待つ。
 *
 * 作り直したかどうかを返す。OBS は新しく作ったソースをシーンの最前面へ積むため、
 * 呼び出し側は重なりの順序を組み直す必要があるかをこの戻り値で判断する。
 */
export async function ensureInput(
  obs: OBSWebSocket,
  sceneName: string,
  inputName: string,
  inputKind: string,
  inputSettings: InputSettings
): Promise<boolean> {
  const existingKind = await findInputKind(obs, inputName)

  if (existingKind === inputKind) {
    await obs.call('SetInputSettings', {
      inputName,
      inputSettings: inputSettings as never,
      overlay: false
    })

    // input は残っていてもシーンから外れていることがある。並べ直して確実に映す。
    await ensureSceneItem(obs, sceneName, inputName)
    return false
  }

  if (existingKind !== null) {
    log.info('種別が変わったためソースを作り直します', { inputName, from: existingKind, to: inputKind })
    await removeInputAndWait(obs, inputName)
  }

  try {
    await obs.call('CreateInput', {
      sceneName,
      inputName,
      inputKind,
      inputSettings: inputSettings as never,
      sceneItemEnabled: true
    })
  } catch (err) {
    // どのソースで衝突したのかが分からないと原因を追えない。名前を添えて投げ直す。
    log.error('ソースを作成できませんでした', { inputName, inputKind, err })
    throw err
  }

  return true
}

/** 存在すれば種別を、無ければ null を返す。 */
async function findInputKind(obs: OBSWebSocket, inputName: string): Promise<string | null> {
  const { inputs } = await obs.call('GetInputList')

  const found = inputs.find(
    (input) => String((input as { inputName?: string }).inputName ?? '') === inputName
  )
  if (!found) return null

  return String((found as { inputKind?: string }).inputKind ?? '')
}

/** シーンに並んでいなければ追加する。既にあれば何もしない。 */
async function ensureSceneItem(
  obs: OBSWebSocket,
  sceneName: string,
  sourceName: string
): Promise<void> {
  try {
    await obs.call('GetSceneItemId', { sceneName, sourceName })
    return
  } catch {
    // シーンに無い場合はここへ来る。
  }

  await obs.call('CreateSceneItem', { sceneName, sourceName, sceneItemEnabled: true })
  log.info('ソースをシーンへ追加しました', { sceneName, sourceName })
}
