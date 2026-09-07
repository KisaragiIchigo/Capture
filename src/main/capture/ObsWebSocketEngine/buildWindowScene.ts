import { nativeTheme } from 'electron'
import type { OBSWebSocket } from 'obs-websocket-js'
import type { CanvasBackground, CaptureProfile } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { readDesktopWindows } from '@main/lib/windowBounds'
import { SCENE_NAME, SOURCE_NAME, windowSourceName } from './obsProfile'
import { ensureInput } from './ensureInput'
import { removeInputAndWait } from './removeInput'
import { measureSourceSize, placeSceneItem, stackSceneItem } from './sceneItems'
import { parseObsWindowId, resolveWindowTargets, type ResolvedWindow } from './obsWindowId'
import { layoutWindows, type LayoutSource } from './windowLayout'

const log = createLogger('obs-window-scene')

/** Windows Graphics Capture。単一ウィンドウの経路と同じものを使う。 */
const CAPTURE_METHOD_WGC = 2

/**
 * 対象が消えたときの探し直し方。0 はタイトルでの一致。
 *
 * 識別子はこちらで毎回いまの実体へ組み直すため、通常はここまで来ない。
 * クラス名での一致にしないのは、このモードが同じアプリの窓を複数並べるためのもので、
 * クラス名は同じアプリの窓を区別できないため。2 枚に同じ窓が写るより、
 * 掴めずに空のまま残るほうが、何が起きているか読み取れる。
 */
const WINDOW_PRIORITY_TITLE = 0

/** 同時に扱うウィンドウの上限。1 枚が細かくなりすぎない範囲で止める。 */
const MAX_WINDOWS = 8

/**
 * 対象が 1 つも決まっていないときのキャンバス。
 *
 * ウィンドウ録画は対象を選ぶまで何も映らないのが本来の状態で、それ自体は失敗ではない。
 * 寸法だけは決めておかないと OBS の設定が組み立てられない。
 */
const EMPTY_CANVAS = { width: 1920, height: 1080 }

/** 大きさをどこからも得られなかったときの寸法。並べる形だけは保つ。 */
const FALLBACK_SIZE = { width: 1280, height: 720 }

export interface WindowSceneResult {
  canvas: { width: number; height: number }
  /** 映像ソースを作り直したかどうか。重ね合わせを積み直す判断に使う。 */
  recreated: boolean
}

/**
 * ウィンドウ録画のシーンを組み立てる。
 *
 * 複数のウィンドウを 1 枚へまとめるため、他のモードとは組み立て方が根本的に違う。
 * 取り込む映像の数も、キャンバスの寸法も、対象を掴んでみるまで決まらない。
 *
 * 手順は、画面の実体を集める → 選ばれた対象をその実体へ結び直す → ソースを揃える →
 * 実際の大きさを測る → 並べ方を決める → 置く、の順になる。
 *
 * 実体を先に集めるのは、識別子に含まれるタイトルが古くなっているとソースが何も掴めず、
 * 大きさも位置も得られないまま組み立てが進んでしまうため。この順序は動かせない。
 */
export async function buildWindowScene(
  obs: OBSWebSocket,
  profile: CaptureProfile,
  captureCursor: boolean,
  applyCanvas: (canvas: { width: number; height: number }) => Promise<void>
): Promise<WindowSceneResult> {
  const ids = profile.windowCapture.ids.slice(0, MAX_WINDOWS)

  // 前回より数が減ったときは、余ったソースを消す。残すとシーンに写り続ける。
  await removeExtraSources(obs, ids.length)

  if (ids.length === 0) {
    // 対象が無くても、映像ソースの器だけは用意する。静止画の撮影経路が名前で探すため。
    const recreated = await ensureWindowSource(obs, 0, null, captureCursor)
    await applyCanvas(EMPTY_CANVAS)
    await applyBackdrop(obs, profile.windowCapture.background, EMPTY_CANVAS)
    return { canvas: EMPTY_CANVAS, recreated }
  }

  const targets = resolveWindowTargets(ids, await readDesktopWindows())

  let recreated = false
  for (const [index, target] of targets.entries()) {
    if (target.id !== ids[index]) {
      // タイトルが変わっていた。組み直した識別子なら OBS はそのまま掴める。
      log.info('ウィンドウの識別子を今の状態へ合わせ直しました', {
        from: parseObsWindowId(ids[index] ?? '').title,
        to: parseObsWindowId(target.id).title
      })
    }

    if (await ensureWindowSource(obs, index, target.id, captureCursor)) recreated = true
  }

  const sources = await collectLayoutSources(obs, targets)
  const { canvas, placements, stacking, appliedLayout } = layoutWindows(
    sources,
    profile.windowCapture.layout,
    profile.windowCapture.gap
  )

  if (appliedLayout !== profile.windowCapture.layout) {
    log.info('位置を取得できないウィンドウがあるため並べ方を変えました', {
      requested: profile.windowCapture.layout,
      applied: appliedLayout
    })
  }

  /*
   * 置く前にキャンバスを確定させる。寸法が決まらないうちに置くと、後から寸法を変えたときに
   * 収まりを取り直すことになり、一度ずれた見え方がそのまま残ることがある。
   */
  await applyCanvas(canvas)
  await applyBackdrop(obs, profile.windowCapture.background, canvas)

  for (const [index, placement] of placements.entries()) {
    await placeSceneItem(obs, windowSourceName(index), placement)
  }

  /*
   * 重なりを決める。塗りが最背面（0）にいるため、映像はその上から順に積む。
   * 使い回したソースは前回の重なりを持ったままなので、毎回すべて置き直す。
   */
  const backdropOffset = profile.windowCapture.background === 'transparent' ? 0 : 1
  for (const [order, sourceIndex] of stacking.entries()) {
    await stackSceneItem(obs, windowSourceName(sourceIndex), order + backdropOffset)
  }

  log.info('ウィンドウのシーンを組み立てました', {
    count: ids.length,
    layout: appliedLayout,
    canvas,
    // 奥から手前への並び。画面のとおりに並べたとき、意図と違えばここで分かる。
    stacking
  })

  return { canvas, recreated }
}

/** 1 つぶんのウィンドウソースを目的の状態にする。 */
function ensureWindowSource(
  obs: OBSWebSocket,
  index: number,
  id: string | null,
  captureCursor: boolean
): Promise<boolean> {
  return ensureInput(obs, SCENE_NAME, windowSourceName(index), 'window_capture', {
    // 対象が未選択のときは空のまま作る。何も映らないが、器は残る。
    window: id ?? '',
    /*
     * カーソルの設定キーはソースの種別ごとに違う。ウィンドウ取り込みは cursor で、
     * capture_cursor はモニタ取り込みとゲーム取り込みのもの。名前を取り違えると
     * 設定が黙って無視され、カーソルが常に写り続ける。
     */
    cursor: captureCursor,
    method: CAPTURE_METHOD_WGC,
    priority: WINDOW_PRIORITY_TITLE,
    /*
     * 枠と影を除いた中身だけを取り込む。
     *
     * これを外すと、取り込む範囲がウィンドウの外枠まで広がる。位置は中身の座標で
     * 決めているため、範囲だけがずれて端が欠けたように写る。
     */
    client_area: true
  })
}

/**
 * 並べるのに必要な情報を集める。
 *
 * 大きさは取り込んだ映像そのものから測る。取り込みが始まるまで少し待つ必要があるため、
 * 対象ごとに直列で待つと数が増えるだけ遅くなる。読み取るだけなので同時に測る。
 *
 * 位置と重なりは OS から得たものを使う。OBS はウィンドウが画面のどこにあるかを持たない。
 */
function collectLayoutSources(
  obs: OBSWebSocket,
  targets: ResolvedWindow[]
): Promise<LayoutSource[]> {
  return Promise.all(
    targets.map(async (target, index) => {
      const measured = await measureSourceSize(obs, windowSourceName(index))
      const title = parseObsWindowId(target.id).title

      if (!measured) log.warn('ウィンドウの大きさが分かりませんでした', { title })
      if (!target.window) log.info('ウィンドウの位置を引けませんでした', { title })

      // 実測が取れなければ OS が返した寸法で形だけ保つ。どちらも無ければ既定へ落とす。
      const size = measured ?? target.window ?? FALLBACK_SIZE

      return {
        width: size.width,
        height: size.height,
        screenX: target.window?.x,
        screenY: target.window?.y,
        depth: target.window?.depth
      }
    })
  )
}

/** 対象の数より多く残っているソースを片付ける。 */
async function removeExtraSources(obs: OBSWebSocket, keep: number): Promise<void> {
  const { inputs } = await obs.call('GetInputList')
  const names = new Set(
    inputs.map((input) => String((input as { inputName?: string }).inputName ?? ''))
  )

  for (let index = Math.max(keep, 1); index < MAX_WINDOWS; index += 1) {
    const name = windowSourceName(index)
    if (names.has(name)) await removeInputAndWait(obs, name)
  }
}

/**
 * 映像で埋まらない部分を塗る。
 *
 * 透過を選んだ場合は何も置かない。静止画（PNG）ではそのまま透明として残るが、
 * 動画のコンテナは透明を持てないため、録画では黒になる。
 */
async function applyBackdrop(
  obs: OBSWebSocket,
  background: CanvasBackground,
  canvas: { width: number; height: number }
): Promise<void> {
  if (background === 'transparent') {
    await removeInputAndWait(obs, SOURCE_NAME.backdrop)
    return
  }

  await ensureInput(obs, SCENE_NAME, SOURCE_NAME.backdrop, 'color_source_v3', {
    color: backdropColor(background),
    width: canvas.width,
    height: canvas.height
  })

  // 塗りは必ず最背面へ。作り直しの順序によっては映像より手前に載る。
  await placeSceneItem(obs, SOURCE_NAME.backdrop, {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  })
  await stackSceneItem(obs, SOURCE_NAME.backdrop, 0)
}

/**
 * 塗りの色。OBS は ABGR の 32 ビット整数で受け取る。
 *
 * システムに合わせる場合は Windows の配色設定に従う。録画のたびに見え方が変わらないよう、
 * 濃さは中間色ではなく、はっきりした黒と白にする。
 */
function backdropColor(background: CanvasBackground): number {
  const dark = background === 'dark' || (background === 'system' && nativeTheme.shouldUseDarkColors)
  return dark ? 0xff000000 : 0xffffffff
}
