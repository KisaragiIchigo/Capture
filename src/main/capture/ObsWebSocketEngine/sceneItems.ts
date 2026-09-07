import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'
import { SCENE_NAME } from './obsProfile'

const log = createLogger('obs-scene-item')

/** 取り込みが始まって大きさが確定するまでの待ち。対象を掴むまでには少し間がある。 */
const MEASURE_ATTEMPTS = 12
const MEASURE_INTERVAL_MS = 150

/** これ未満は寸法として成立しない。掴めていない状態の 0 と区別する。 */
const MIN_SIZE = 16

/** OBS の配置基準。0 は中央で、左・右・上・下のビットを立てて寄せ方を決める。 */
const OBS_ALIGN_CENTER = 0

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function sceneItemId(obs: OBSWebSocket, sourceName: string): Promise<number> {
  const { sceneItemId: id } = await obs.call('GetSceneItemId', {
    sceneName: SCENE_NAME,
    sourceName
  })
  return id
}

/**
 * 取り込んでいる映像そのものの大きさを測る。
 *
 * ウィンドウやゲームは、対象の大きさが設定からは決まらない。掴んでみるまで分からないため、
 * ソースを作ってから OBS に尋ねる。取り込みが始まる前は 0 が返るので、値が出るまで少し待つ。
 */
export async function measureSourceSize(
  obs: OBSWebSocket,
  sourceName: string
): Promise<{ width: number; height: number } | null> {
  const id = await sceneItemId(obs, sourceName)

  for (let attempt = 1; attempt <= MEASURE_ATTEMPTS; attempt += 1) {
    const { sceneItemTransform } = await obs.call('GetSceneItemTransform', {
      sceneName: SCENE_NAME,
      sceneItemId: id
    })

    const width = Number(sceneItemTransform['sourceWidth'])
    const height = Number(sceneItemTransform['sourceHeight'])

    // エンコーダは奇数の辺を扱えない。切り捨てて偶数へ寄せる。
    const even = { width: width - (width % 2), height: height - (height % 2) }

    if (even.width >= MIN_SIZE && even.height >= MIN_SIZE) {
      if (attempt > 1) log.info('映像の大きさが分かるまで待ちました', { sourceName, attempt, ...even })
      return even
    }

    await delay(MEASURE_INTERVAL_MS)
  }

  log.warn('映像の大きさを測れませんでした', { sourceName })
  return null
}

/**
 * 映像を指定の枠へ収める。
 *
 * シーンアイテムの配置は、モードや対象を切り替えても持ち越される。取り込む映像の大きさは
 * そのたびに変わるため、前の配置が残ると、切り替えただけで映像が隅に寄ったり、
 * キャンバスからはみ出したりする。置くときは必ず全項目を指定して、残る余地をなくす。
 *
 * 収め方は縦横比を保ったまま内側へ入れる。引き伸ばして枠を埋めると、
 * 縦横比の違う対象が歪む。
 */
export async function placeSceneItem(
  obs: OBSWebSocket,
  sourceName: string,
  frame: { x: number; y: number; width: number; height: number }
): Promise<void> {
  const id = await sceneItemId(obs, sourceName)

  await obs.call('SetSceneItemTransform', {
    sceneName: SCENE_NAME,
    sceneItemId: id,
    sceneItemTransform: {
      // 基準点も境界の基準点も中央に取り、枠の中心へ置く。
      alignment: OBS_ALIGN_CENTER,
      positionX: frame.x + frame.width / 2,
      positionY: frame.y + frame.height / 2,
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: OBS_ALIGN_CENTER,
      boundsWidth: frame.width,
      boundsHeight: frame.height,
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      rotation: 0
    }
  })
}

/**
 * シーンの中での重なりを決める。
 *
 * 0 が最背面で、大きいほど手前になる。作った順のまま放っておくと、既にあるソースを
 * 使い回したときに前回の重なりが残り、選び直しても順序が変わらない。
 */
export async function stackSceneItem(
  obs: OBSWebSocket,
  sourceName: string,
  index: number
): Promise<void> {
  const id = await sceneItemId(obs, sourceName)
  await obs.call('SetSceneItemIndex', {
    sceneName: SCENE_NAME,
    sceneItemId: id,
    sceneItemIndex: index
  })
}
