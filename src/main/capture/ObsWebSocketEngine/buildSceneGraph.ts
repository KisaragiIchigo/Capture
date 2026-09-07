import type { OBSWebSocket } from 'obs-websocket-js'
import type { CaptureProfile, DisplaySource, RegionRect } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { CaptureEngineError } from '../CaptureEngine'
import { SCENE_NAME, SOURCE_NAME } from './obsProfile'
import { removeInputAndWait } from './removeInput'
import { removeFilterIfExists } from './removeFilter'
import { ensureInput } from './ensureInput'

const log = createLogger('obs-scene')

/** OBS の配置基準。0 は中央で、左・右・上・下のビットを立てて寄せ方を決める。 */
const OBS_ALIGN_CENTER = 0

/** 取り込みが始まって大きさが確定するまでの待ち。ウィンドウを掴むまでには少し間がある。 */
const MEASURE_ATTEMPTS = 12
const MEASURE_INTERVAL_MS = 150

/** これ未満はキャンバスとして成立しない。掴めていない状態の 0 と区別する。 */
const MIN_CANVAS = 16

/** ソース種別ごとの OBS inputKind。 */
const INPUT_KIND = {
  display: 'monitor_capture',
  window: 'window_capture',
  game: 'game_capture',
  region: 'monitor_capture'
} as const

/** monitor_capture / window_capture の取得方式。2 = Windows Graphics Capture。 */
const CAPTURE_METHOD_WGC = 2

export async function ensureScene(obs: OBSWebSocket): Promise<void> {
  const { scenes } = await obs.call('GetSceneList')
  const exists = scenes.some((scene) => (scene as { sceneName?: string }).sceneName === SCENE_NAME)
  if (!exists) {
    await obs.call('CreateScene', { sceneName: SCENE_NAME })
    log.info('シーンを作成しました', { scene: SCENE_NAME })
  }
  await obs.call('SetCurrentProgramScene', { sceneName: SCENE_NAME })
}

/**
 * このアプリが作ったソースを一掃する。
 *
 * OBS は終了時にシーンコレクションを保存するため、前回作ったソースが次回の起動時にも残る。
 * 残ったまま作ろうとすると「A source already exists by that input name」で失敗するので、
 * 起動のたびに白紙へ戻す。前回が異常終了して掃除できなかった場合にも効く。
 */
export async function resetManagedSources(obs: OBSWebSocket): Promise<void> {
  const { inputs } = await obs.call('GetInputList')

  const managed = inputs
    .map((input) => String((input as { inputName?: string }).inputName ?? ''))
    // capture- はアプリが作る本番ソース、__probe_ は候補列挙用の一時ソース。
    .filter((name) => name.startsWith('capture-') || name.startsWith('__probe_'))

  for (const inputName of managed) {
    await removeInputAndWait(obs, inputName)
  }

  if (managed.length > 0) {
    log.info('前回のソースを整理しました', { count: managed.length })
  }
}

/** OBS の inputSettings は JSON 値しか受け付けないため、戻り値をプリミティブに限定する。 */
type InputSettings = Record<string, string | number | boolean>

function videoInputSettings(profile: CaptureProfile, displays: DisplaySource[]): InputSettings {
  const captureCursor = profile.cursor.capture

  switch (profile.sourceKind) {
    case 'display': {
      const monitorId = profile.sourceId ?? displays.find((d) => d.isPrimary)?.id ?? displays[0]?.id
      if (!monitorId) {
        throw new CaptureEngineError('キャプチャ対象のモニタが見つかりませんでした。')
      }
      return { monitor_id: monitorId, capture_cursor: captureCursor, method: CAPTURE_METHOD_WGC }
    }
    case 'region': {
      // 枠を別のモニタへ動かしても追従できるよう、位置から基準を決める。
      const monitor = resolveRegionMonitor(profile, displays)
      if (!monitor) {
        throw new CaptureEngineError('キャプチャ対象のモニタが見つかりませんでした。')
      }
      return { monitor_id: monitor.id, capture_cursor: captureCursor, method: CAPTURE_METHOD_WGC }
    }
    case 'window': {
      /*
       * 対象が決まっていなくてもソースは作る。ここで例外を投げると映像ソースが
       * 存在しないまま構築が止まり、静止画は「ソースが見つからない」で失敗し、
       * 起動時ならファインダーを出す手前で止まって操作手段ごと消える。
       *
       * ウィンドウ録画は対象が決まるまで何も映らないのが本来の状態で、
       * 未選択であることは情報バーが「ウィンドウが選択されていません」と伝える。
       * 録画と静止画の入口では別途弾く。
       */
      return {
        window: profile.sourceId ?? '',
        capture_cursor: captureCursor,
        method: CAPTURE_METHOD_WGC,
        client_area: true
      }
    }
    case 'game': {
      // ソース未選択なら、前面のフルスクリーンアプリを自動で掴む挙動にする。
      if (!profile.sourceId) {
        return {
          capture_mode: 'any_fullscreen',
          capture_cursor: captureCursor,
          anti_cheat_hook: true,
          hook_rate: 2
        }
      }
      return {
        capture_mode: 'window',
        window: profile.sourceId,
        capture_cursor: captureCursor,
        anti_cheat_hook: true,
        hook_rate: 2,
        priority: 1
      }
    }
  }
}

/**
 * 映像ソースを作り直す。
 *
 * 設定を上書きするのではなく毎回消して作るのは、種別が変わると inputKind ごと変わるため。
 * 差分更新にすると「ウィンドウ録画のつもりがモニタ録画のまま」といった取り違えが起きる。
 *
 * 作り直したかどうかを返す。作り直すと映像ソースがシーンの最前面へ積まれ、
 * 重ね合わせた要素がその裏へ隠れる。呼び出し側が重ね直す判断に使う。
 */
export async function buildVideoSource(
  obs: OBSWebSocket,
  profile: CaptureProfile,
  displays: DisplaySource[]
): Promise<boolean> {
  const recreated = await ensureInput(
    obs,
    SCENE_NAME,
    SOURCE_NAME.video,
    INPUT_KIND[profile.sourceKind],
    videoInputSettings(profile, displays)
  )

  await applyRegionCropFilter(obs, profile, displays)
  await fitVideoToCanvas(obs, resolveCanvasSize(profile, displays))

  log.info('映像ソースを構築しました', {
    kind: profile.sourceKind,
    source: profile.sourceId,
    recreated
  })
  return recreated
}

/**
 * 映像をキャンバス全体へ収める。
 *
 * シーンアイテムの配置は、モードを切り替えても持ち越される。取り込む映像の大きさは
 * モードごとに変わるため、前のモードで決まった配置が残ると、切り替えただけで映像が
 * 隅に寄ったり、キャンバスからはみ出したりする。範囲指定からフルスクリーンへ移ると
 * 切り出していた頃の大きさのまま中央に置かれる、という形で表面化する。
 *
 * どのモードでも同じ形で置き直すことで、前の状態が残る余地をなくす。
 * 収め方は縦横比を保ったまま内側へ入れる。引き伸ばして全面を埋めると、
 * ウィンドウ録画のように縦横比の違う対象が歪む。
 */
/**
 * 取り込んでいる映像そのものの大きさを測る。
 *
 * ウィンドウとゲームは、対象の大きさが設定からは決まらない。掴んでみるまで分からないため、
 * ソースを作ってから OBS に尋ねる。取り込みが始まる前は 0 が返るので、値が出るまで少し待つ。
 *
 * 分からないまま進めると、キャンバスをモニタの大きさにするしかなくなる。すると
 * ウィンドウの外側が余白として残り、モニタと同じ大きさのファイルの隅に小さく写る。
 */
export async function measureVideoSize(
  obs: OBSWebSocket
): Promise<{ width: number; height: number } | null> {
  const { sceneItemId } = await obs.call('GetSceneItemId', {
    sceneName: SCENE_NAME,
    sourceName: SOURCE_NAME.video
  })

  for (let attempt = 1; attempt <= MEASURE_ATTEMPTS; attempt += 1) {
    const { sceneItemTransform } = await obs.call('GetSceneItemTransform', {
      sceneName: SCENE_NAME,
      sceneItemId
    })

    const width = Number(sceneItemTransform['sourceWidth'])
    const height = Number(sceneItemTransform['sourceHeight'])

    // エンコーダは奇数の辺を扱えない。切り捨てて偶数へ寄せる。
    const even = { width: width - (width % 2), height: height - (height % 2) }

    if (even.width >= MIN_CANVAS && even.height >= MIN_CANVAS) {
      if (attempt > 1) log.info('映像の大きさが分かるまで待ちました', { attempt, ...even })
      return even
    }

    await new Promise((resolve) => setTimeout(resolve, MEASURE_INTERVAL_MS))
  }

  log.warn('映像の大きさを測れませんでした。モニタの大きさで代用します')
  return null
}

export async function fitVideoToCanvas(
  obs: OBSWebSocket,
  canvas: { width: number; height: number }
): Promise<void> {
  const { sceneItemId } = await obs.call('GetSceneItemId', {
    sceneName: SCENE_NAME,
    sourceName: SOURCE_NAME.video
  })

  await obs.call('SetSceneItemTransform', {
    sceneName: SCENE_NAME,
    sceneItemId,
    sceneItemTransform: {
      // 基準点も境界の基準点も中央に取り、キャンバスの中心へ置く。
      // 縦横比が一致していれば全面を覆い、違えば余白が上下か左右へ均等に出る。
      alignment: OBS_ALIGN_CENTER,
      positionX: canvas.width / 2,
      positionY: canvas.height / 2,
      boundsType: 'OBS_BOUNDS_SCALE_INNER',
      boundsAlignment: OBS_ALIGN_CENTER,
      boundsWidth: canvas.width,
      boundsHeight: canvas.height,
      cropLeft: 0,
      cropTop: 0,
      cropRight: 0,
      cropBottom: 0,
      rotation: 0
    }
  })
}

/**
 * 切り出しの指定を掛け直す。
 *
 * 範囲指定から他のモードへ移ったときに前回のクロップが残らないよう、毎回外してから掛ける。
 * 録画中に範囲を動かしたときは、映像ソースの設定には触らずここだけを通す。
 * 録画の最中に入力の設定を書き直すと、取り込みが組み直されて映像が途切れる恐れがある。
 */
export async function applyRegionCropFilter(
  obs: OBSWebSocket,
  profile: CaptureProfile,
  displays: DisplaySource[]
): Promise<void> {
  await removeFilterIfExists(obs, SOURCE_NAME.video, 'region-crop')
  if (profile.sourceKind !== 'region') return
  await applyRegionCrop(obs, profile, displays)
}

/**
 * 矩形指定はモニタ全体をキャプチャしてから crop フィルタで切り出す。
 * region の座標は仮想デスクトップ絶対座標なので、対象モニタの原点ぶんを引いて相対化する。
 */
async function applyRegionCrop(
  obs: OBSWebSocket,
  profile: CaptureProfile,
  displays: DisplaySource[]
): Promise<void> {
  const region = profile.region
  if (!region) {
    throw new CaptureEngineError('録画する範囲が指定されていません。')
  }

  const monitor = resolveRegionMonitor(profile, displays)
  if (!monitor) {
    throw new CaptureEngineError('範囲指定の基準となるモニタが見つかりませんでした。')
  }

  // 範囲がモニタからはみ出していると、切り出し後の幅か高さが 0 以下になり、
  // 映像が 1 ピクセルに潰れる。録画も静止画も中身のないファイルになるため、
  // 破綻させずにモニタの内側へ収める。
  const clamped = clampToMonitor(region, monitor)
  if (
    clamped.x !== region.x ||
    clamped.y !== region.y ||
    clamped.width !== region.width ||
    clamped.height !== region.height
  ) {
    log.warn('範囲がモニタからはみ出していたため内側へ収めました', {
      requested: region,
      clamped,
      monitor: { x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height }
    })
  }

  const left = clamped.x - monitor.x
  const top = clamped.y - monitor.y
  const right = monitor.width - (left + clamped.width)
  const bottom = monitor.height - (top + clamped.height)

  log.info('範囲を切り出します', {
    monitor: { label: monitor.label, x: monitor.x, y: monitor.y, width: monitor.width, height: monitor.height },
    crop: { left, top, right, bottom, cx: clamped.width, cy: clamped.height },
    // 切り出し後の大きさ。ここが 0 以下なら計算が破綻している。
    result: { width: monitor.width - left - right, height: monitor.height - top - bottom }
  })

  /*
   * crop_filter は relative の値で読む設定キーが変わる。
   *   relative: true  … left / top / right / bottom（端から削る量）
   *   relative: false … left / top / cx / cy（切り出す矩形の大きさ）
   * 片方しか渡さないと、もう片方のモードでは幅と高さが 0 と解釈され、
   * 映像が 1 ピクセルへ潰れる。どちらで読まれても同じ結果になるよう両方渡す。
   */
  await obs.call('CreateSourceFilter', {
    sourceName: SOURCE_NAME.video,
    filterName: 'region-crop',
    filterKind: 'crop_filter',
    filterSettings: {
      relative: false,
      left,
      top,
      right,
      bottom,
      cx: clamped.width,
      cy: clamped.height
    }
  })

}

/**
 * 範囲指定の基準となるモニタを決める。
 *
 * 設定に保存された sourceId ではなく、枠の中心がどのモニタに載っているかで判断する。
 * ファインダーは自由に動かせるので、保存された基準と実際の位置は簡単にずれる。
 * ずれたまま切り出すと、別のモニタの原点で計算することになり映像が潰れる。
 */
function resolveRegionMonitor(
  profile: CaptureProfile,
  displays: DisplaySource[]
): DisplaySource | undefined {
  const region = profile.region
  if (region) {
    const centerX = region.x + region.width / 2
    const centerY = region.y + region.height / 2

    const containing = displays.find(
      (display) =>
        centerX >= display.x &&
        centerX < display.x + display.width &&
        centerY >= display.y &&
        centerY < display.y + display.height
    )
    if (containing) return containing
  }

  // どのモニタにも載っていない場合だけ、設定と主モニタに頼る。
  return (
    displays.find((display) => display.id === profile.sourceId) ??
    displays.find((display) => display.isPrimary) ??
    displays[0]
  )
}

/**
 * 範囲をモニタの内側へ収める。
 *
 * 別のモニタを基準に選んでいる、モニタ構成が変わった、といった場合に
 * 範囲が枠外へ出る。そのまま切り出すと幅か高さが負になり映像が潰れるため、
 * 大きさを保てる位置まで寄せ、収まらないぶんだけ縮める。
 */
function clampToMonitor(region: RegionRect, monitor: DisplaySource): RegionRect {
  const width = Math.min(region.width, monitor.width)
  const height = Math.min(region.height, monitor.height)

  return {
    width,
    height,
    x: Math.min(Math.max(region.x, monitor.x), monitor.x + monitor.width - width),
    y: Math.min(Math.max(region.y, monitor.y), monitor.y + monitor.height - height)
  }
}

/** 録画対象の解像度。キャンバスサイズをこれに合わせないと余白や見切れが出る。 */
export function resolveCanvasSize(
  profile: CaptureProfile,
  displays: DisplaySource[]
): { width: number; height: number } {
  if (profile.sourceKind === 'region' && profile.region) {
    return { width: profile.region.width, height: profile.region.height }
  }

  const monitor =
    profile.sourceKind === 'region'
      ? resolveRegionMonitor(profile, displays)
      : (displays.find((d) => d.id === profile.sourceId) ??
        displays.find((d) => d.isPrimary) ??
        displays[0])

  // ウィンドウ / ゲームは対象の実サイズが起動前に確定しないため、
  // いったんモニタ解像度をキャンバスにして、はみ出しはスケールで吸収する。
  return { width: monitor?.width ?? 1920, height: monitor?.height ?? 1080 }
}
