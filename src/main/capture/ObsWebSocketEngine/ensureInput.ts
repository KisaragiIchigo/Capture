import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'
import { removeInputAndWait } from './removeInput'

const log = createLogger('obs-input')

export type InputSettings = Record<string, unknown>

/** 名前がまだ使われていることを表す OBS の応答。 */
const RESOURCE_ALREADY_EXISTS = 601

/**
 * 名前が空くのを待つ上限。
 *
 * 削除を要求してから実際に名前が解放されるまでの猶予。OBS 内部の参照が外れるのを
 * 待つだけなので、数百ミリ秒あれば足りる。
 */
const NAME_RETRY_ATTEMPTS = 10
const NAME_RETRY_INTERVAL_MS = 200

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** 同じ名前がまだ生きていることによる失敗かどうか。 */
function isNameStillTaken(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false

  const code = (err as { code?: unknown }).code
  if (code === RESOURCE_ALREADY_EXISTS) return true

  const message = (err as { message?: unknown }).message
  return typeof message === 'string' && /already exists/i.test(message)
}

/**
 * ソースを目的の状態にする。
 *
 * 削除してから作り直すのではなく、種別が同じなら設定を上書きして再利用する。
 * OBS の RemoveInput は応答も InputRemoved イベントも実際の解放より早く返り、
 * 直後の CreateInput が「A source already exists by that input name」で失敗する。
 * 待ち方を工夫しても追いかけっこになるので、そもそも削除を通らない道を主にする。
 *
 * 設定は overlay: false で全置換するため、前の値が残って取り違える心配はない。
 * 種別が変わるときだけ作り直す。そのときは名前が空くまで作成を試し直す。
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

  await createInput(obs, sceneName, inputName, inputKind, inputSettings)
  return true
}

/**
 * ソースを作る。名前がまだ空いていなければ、空くまで試し直す。
 *
 * OBS の削除は、応答も InputRemoved イベントも実際の解放より早く返る。シーンアイテムや
 * フィルタからの参照が外れるまで実体は残り、その間は同じ名前で作れない。削除の完了を
 * どれだけ丁寧に待っても追いかけっこになるため、作る側で名前が空くのを待つ。
 *
 * 種別を切り替えた直後だけこの道を通る。待っても空かない場合は、削除の取りこぼしなど
 * 別の原因があるということなので、そのまま失敗として投げる。
 */
async function createInput(
  obs: OBSWebSocket,
  sceneName: string,
  inputName: string,
  inputKind: string,
  inputSettings: InputSettings
): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await obs.call('CreateInput', {
        sceneName,
        inputName,
        inputKind,
        inputSettings: inputSettings as never,
        sceneItemEnabled: true
      })

      if (attempt > 1) log.info('名前が空くのを待ってソースを作成しました', { inputName, attempt })
      return
    } catch (err) {
      if (!isNameStillTaken(err) || attempt >= NAME_RETRY_ATTEMPTS) {
        // どのソースで衝突したのかが分からないと原因を追えない。名前を添えて投げ直す。
        log.error('ソースを作成できませんでした', { inputName, inputKind, attempt, err })
        throw err
      }

      await delay(NAME_RETRY_INTERVAL_MS)
    }
  }
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
