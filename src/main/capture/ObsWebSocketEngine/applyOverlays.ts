import type { OBSWebSocket } from 'obs-websocket-js'
import {
  resolveFixedPlacement,
  resolvePlacement,
  type OverlayConfig,
  type OverlayPlacement,
  type Size
} from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { SCENE_NAME } from './obsProfile'
import { KIND_CANDIDATES, pickKind, type ObsKinds } from './obsKinds'
import { removeInputAndWait } from './removeInput'
import { removeFilterIfExists } from './removeFilter'
import { ensureInput } from './ensureInput'

const log = createLogger('obs-overlay')

/** オーバーレイのソース名。映像ソースと同じく、OBS 内の名前を境界の外へ出さない。 */
const OVERLAY_SOURCE = {
  webcam: 'capture-overlay-webcam',
  text: 'capture-overlay-text',
  logo: 'capture-overlay-logo'
} as const

/** 不透明度を与える色補正フィルタの名前。付け外しの目印になるので 1 か所で持つ。 */
const OPACITY_FILTER = 'opacity'

/** 素材の縦横比が分かるまでの仮の値。実サイズが取れたら置き換える。 */
const ASSUMED_ASPECT = { webcam: 16 / 9, logo: 1, text: 4 } as const

type Settings = Record<string, string | number | boolean>

/**
 * 映像より手前へ積み直すために、いったん消す。
 *
 * OBS には順序を指定して並べ替える手もあるが、番号の向き（0 が最前面か最背面か）を
 * 取り違えると重ね合わせが映像の裏へ回り、症状が今より分かりにくくなる。
 * 消して作れば必ず最前面に積まれるので、向きに依存しない。
 */
async function restackToFront(obs: OBSWebSocket, sourceName: string): Promise<void> {
  await removeInputAndWait(obs, sourceName)
}

/** 接続されている映像入力。「既定のカメラ」を実体へ解決するために受け取る。 */
export interface VideoDevice {
  id: string
  label: string
}

/**
 * 録画映像へ重ねる要素を作り直す。
 *
 * 差分更新ではなく毎回消して作るのは、無効化されたオーバーレイが
 * シーンに残って映像へ写り続ける事故を確実に防ぐため。
 *
 * restack は映像ソースが作り直された合図。OBS は新しく作ったソースをシーンの最前面へ
 * 積むため、そのままだと映像が重ね合わせを覆い隠す。合図を受けたら重ね合わせも
 * 作り直し、映像より手前へ積み直す。取り込み方を切り替えた直後に
 * オーバーレイが全部消えて見えるのはこれが原因。
 */
export async function applyOverlays(
  obs: OBSWebSocket,
  overlays: OverlayConfig,
  canvas: Size,
  kinds: ObsKinds,
  videoDevices: VideoDevice[],
  restack: boolean
): Promise<void> {
  await Promise.all([
    buildWebcam(obs, overlays, canvas, kinds, videoDevices, restack),
    buildText(obs, overlays, canvas, kinds, restack),
    buildLogo(obs, overlays, canvas, kinds, restack)
  ])

  log.info('オーバーレイを構築しました', {
    webcam: overlays.webcam.enabled,
    text: overlays.text.enabled,
    logo: overlays.logo.enabled
  })
}

async function buildWebcam(
  obs: OBSWebSocket,
  overlays: OverlayConfig,
  canvas: Size,
  kinds: ObsKinds,
  videoDevices: VideoDevice[],
  restack: boolean
): Promise<void> {
  const config = overlays.webcam
  if (!config.enabled) {
    await removeInputAndWait(obs, OVERLAY_SOURCE.webcam)
    return
  }

  if (restack) await restackToFront(obs, OVERLAY_SOURCE.webcam)

  const kind = pickKind(kinds.inputs, [...KIND_CANDIDATES.webcam])
  if (!kind) {
    log.warn('この環境では映像入力を扱えないため、Webカメラの重ね合わせを省きました')
    return
  }

  /*
   * dshow_input はデバイスが決まっていないと何も映さない。設定側の空文字は
   * 「既定のカメラ」を意味するが、その意味を OBS は知らないので、ここで実体へ解決する。
   * 渡さないまま作ると、有効にしているのに何も出ないという、原因の分からない状態になる。
   */
  const deviceId = config.deviceId || videoDevices[0]?.id
  if (!deviceId) {
    log.warn('映像入力デバイスが見つからないため、Webカメラの重ね合わせを省きました')
    await removeInputAndWait(obs, OVERLAY_SOURCE.webcam)
    return
  }

  const settings: Settings = { active: true, video_device_id: deviceId }
  await ensureInput(obs, SCENE_NAME, OVERLAY_SOURCE.webcam, kind, settings)

  await place(obs, OVERLAY_SOURCE.webcam, config, canvas, ASSUMED_ASPECT.webcam, kinds)
}

async function buildText(
  obs: OBSWebSocket,
  overlays: OverlayConfig,
  canvas: Size,
  kinds: ObsKinds,
  restack: boolean
): Promise<void> {
  const config = overlays.text
  if (!config.enabled || !config.text.trim()) {
    await removeInputAndWait(obs, OVERLAY_SOURCE.text)
    return
  }

  if (restack) await restackToFront(obs, OVERLAY_SOURCE.text)

  const kind = pickKind(kinds.inputs, [...KIND_CANDIDATES.text])
  if (!kind) {
    log.warn('この環境ではテキストソースを扱えないため、文字の重ね合わせを省きました')
    return
  }

  await ensureInput(obs, SCENE_NAME, OVERLAY_SOURCE.text, kind, {
      text: config.text,
      color: toObsColor(config.color),
      // OBS は背景色と不透明度を分けて持つ。0 なら帯を出さない。
      bk_color: 0x000000,
      bk_opacity: Math.round(config.backgroundOpacity * 100),
      font: { face: 'IBM Plex Sans JP', size: config.fontSize, flags: 0, style: '' }
  })

  // テキストは実寸のフォントサイズで描くため、scale による拡大はかけない。
  await placeWithoutScale(obs, OVERLAY_SOURCE.text, config, canvas, kinds)
}

async function buildLogo(
  obs: OBSWebSocket,
  overlays: OverlayConfig,
  canvas: Size,
  kinds: ObsKinds,
  restack: boolean
): Promise<void> {
  const config = overlays.logo
  if (!config.enabled || !config.filePath) {
    await removeInputAndWait(obs, OVERLAY_SOURCE.logo)
    return
  }

  if (restack) await restackToFront(obs, OVERLAY_SOURCE.logo)

  const kind = pickKind(kinds.inputs, [...KIND_CANDIDATES.image])
  if (!kind) {
    log.warn('この環境では画像ソースを扱えないため、ロゴの重ね合わせを省きました')
    return
  }

  await ensureInput(obs, SCENE_NAME, OVERLAY_SOURCE.logo, kind, { file: config.filePath })

  await place(obs, OVERLAY_SOURCE.logo, config, canvas, ASSUMED_ASPECT.logo, kinds)
}

/**
 * 素材を指定の位置へ収める。
 *
 * 実サイズを OBS から取り直してから比率を計算するのは、
 * カメラや画像の解像度が事前に分からないため。取れなければ仮の縦横比で置く。
 */
async function place(
  obs: OBSWebSocket,
  sourceName: string,
  placement: OverlayPlacement,
  canvas: Size,
  fallbackAspect: number,
  kinds: ObsKinds
): Promise<void> {
  const { sceneItemId } = await obs.call('GetSceneItemId', {
    sceneName: SCENE_NAME,
    sourceName
  })

  const aspect = (await readSourceAspect(obs, sceneItemId)) ?? fallbackAspect
  const box = resolvePlacement(placement, canvas, aspect)

  await obs.call('SetSceneItemTransform', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemTransform: {
      positionX: box.x,
      positionY: box.y,
      // 指定した矩形へ収める。素材の縦横比は保つ。
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: 0,
      boundsWidth: box.width,
      boundsHeight: box.height
    }
  })

  await setOpacity(obs, sourceName, placement.opacity, kinds)
}

/**
 * テキストのように、拡大せず実寸で描く素材の配置。
 *
 * 大きさは素材そのものに任せ、位置だけ決める。ただし右寄せや下寄せでは、
 * 実際の大きさを知らないと置き場所が決まらない。以前は大きさを 0 として扱っており、
 * 右下に置くと矩形の左上が画面の隅そのものになって、文字が丸ごと画面外へ出ていた。
 */
async function placeWithoutScale(
  obs: OBSWebSocket,
  sourceName: string,
  placement: OverlayPlacement,
  canvas: Size,
  kinds: ObsKinds
): Promise<void> {
  const { sceneItemId } = await obs.call('GetSceneItemId', { sceneName: SCENE_NAME, sourceName })

  // 実寸が読めないうちは端に寄せず、余白ぶんだけ内側の左上に置いて必ず見える形にする。
  const size = await readSourceSize(obs, sceneItemId)
  const box = size
    ? resolveFixedPlacement(placement, canvas, size)
    : resolvePlacement({ ...placement, anchor: 'top-left', scale: 0 }, canvas, ASSUMED_ASPECT.text)

  await obs.call('SetSceneItemTransform', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemTransform: {
      positionX: box.x,
      positionY: box.y,
      boundsType: 'OBS_BOUNDS_NONE'
    }
  })

  await setOpacity(obs, sourceName, placement.opacity, kinds)
}

/**
 * 素材の実解像度から縦横比を求める。
 *
 * GetInputSettings は設定値しか返さないので使えない。実際の大きさは
 * シーンアイテムの transform に sourceWidth / sourceHeight として入っている。
 * 起動直後のカメラは 0 で返ることがあり、その場合は呼び出し側の仮の値に委ねる。
 */
async function readSourceAspect(
  obs: OBSWebSocket,
  sceneItemId: number
): Promise<number | null> {
  const size = await readSourceSize(obs, sceneItemId)
  return size ? size.width / size.height : null
}

/** 素材の実解像度。読めなければ null。 */
async function readSourceSize(obs: OBSWebSocket, sceneItemId: number): Promise<Size | null> {
  try {
    const { sceneItemTransform } = await obs.call('GetSceneItemTransform', {
      sceneName: SCENE_NAME,
      sceneItemId
    })

    const transform = sceneItemTransform as unknown as {
      sourceWidth?: number
      sourceHeight?: number
    }
    if (!transform.sourceWidth || !transform.sourceHeight) return null
    return { width: transform.sourceWidth, height: transform.sourceHeight }
  } catch {
    return null
  }
}

/**
 * 不透明度は色補正フィルタで与える。ソース自体に不透明度の設定を持たないものがあるため。
 *
 * 掛け直す前に必ず外す。CreateSourceFilter は同じ名前が既にあると失敗し、
 * その失敗はオーバーレイの構築そのものを止める。設定を変えるたびに構築を通るため、
 * 一度掛けたら二度目から必ず失敗し、録画の開始まで巻き添えになっていた。
 * 外してから掛け直せば、濃さを 100% へ戻したときに薄いまま残る問題も同時に消える。
 */
async function setOpacity(
  obs: OBSWebSocket,
  sourceName: string,
  opacity: number,
  kinds: ObsKinds
): Promise<void> {
  await removeFilterIfExists(obs, sourceName, OPACITY_FILTER)
  if (opacity >= 1) return

  const kind = pickKind(kinds.filters, [...KIND_CANDIDATES.colorFilter])
  if (!kind) {
    log.warn('この環境では色補正フィルタを扱えないため、不透明度の指定を省きました', { sourceName })
    return
  }

  await obs.call('CreateSourceFilter', {
    sourceName,
    filterName: OPACITY_FILTER,
    filterKind: kind,
    filterSettings: { opacity: Math.round(opacity * 100) }
  })
}

/** #rrggbb を OBS の 0xBBGGRR へ。OBS は色を BGR の順で持つ。 */
function toObsColor(hex: string): number {
  const match = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!match?.[1]) return 0xffffff

  const value = parseInt(match[1], 16)
  const r = (value >> 16) & 0xff
  const g = (value >> 8) & 0xff
  const b = value & 0xff
  return (b << 16) | (g << 8) | r
}
