import type { OBSWebSocket } from 'obs-websocket-js'
import type { DisplaySource, WindowSource } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { removeInputAndWait } from './removeInput'

const log = createLogger('obs-probe')

/** 候補列挙のためだけに一瞬だけ作って消すソースの名前。 */
const PROBE_INPUT = {
  monitor: '__probe_monitor',
  window: '__probe_window',
  audioOutput: '__probe_audio_output',
  audioInput: '__probe_audio_input',
  video: '__probe_video'
} as const

interface PropertyItem {
  itemName: string
  itemValue: string | number
  itemEnabled: boolean
}

/**
 * OBS のプロパティ候補は、対象の input が存在していないと取得できない。
 * シーンに置かない隠しシーンへ作り、読み終えたら必ず消す。
 */
async function withProbeInput<T>(
  obs: OBSWebSocket,
  sceneName: string,
  inputName: string,
  inputKind: string,
  propertyName: string,
  read: (items: PropertyItem[]) => T
): Promise<T> {
  try {
    await obs.call('CreateInput', {
      sceneName,
      inputName,
      inputKind,
      inputSettings: {},
      sceneItemEnabled: false
    })
  } catch {
    // 既に存在する場合はそのまま読み取りへ進む。
  }

  try {
    const response = await obs.call('GetInputPropertiesListPropertyItems', {
      inputName,
      propertyName
    })
    return read(response.propertyItems as unknown as PropertyItem[])
  } finally {
    // 次の候補列挙や本番ソースの作成と名前が衝突しないよう、消えるまで待つ。
    await removeInputAndWait(obs, inputName).catch((err) =>
      log.warn('プローブ用ソースの削除に失敗しました', err)
    )
  }
}

/**
 * OBS が認識しているモニタ一覧。
 *
 * OBS の monitor_id は `\?\DISPLAY#...` 形式のデバイス ID で、Electron の screen API が返す
 * 数値 id とは互換が無い。突き合わせは itemName に含まれる解像度と座標で行うため、
 * 表示名はここで得たものをそのまま UI に出す。
 */
export async function probeMonitors(
  obs: OBSWebSocket,
  sceneName: string,
  electronDisplays: DisplaySource[]
): Promise<DisplaySource[]> {
  return withProbeInput(obs, sceneName, PROBE_INPUT.monitor, 'monitor_capture', 'monitor_id', (items) => {
    // 表示名の書式は OBS の版で変わる。パースの成否を必ず記録して、
    // 座標が推測に落ちていないかを後から追えるようにする。
    log.info('モニタ候補を取得しました', {
      labels: items.map((item) => item.itemName),
      parsed: items.map((item) => parseMonitorLabel(item.itemName))
    })

    const monitors: DisplaySource[] = []

    for (const item of items) {
      const geometry = parseMonitorLabel(item.itemName)

      // 一覧の先頭には「[キャプチャするディスプレイを選択]」のような
      // 実体のない案内項目が入る。座標を持たないものはモニタではない。
      if (!geometry) continue

      // Electron 側とは並び順で対応付けない。案内項目のぶんだけずれて、
      // 別のモニタの属性（とくにプライマリ判定）を拾ってしまう。座標で突き合わせる。
      const match = electronDisplays.find(
        (display) =>
          display.x === geometry.x &&
          display.y === geometry.y &&
          display.width === geometry.width &&
          display.height === geometry.height
      )

      monitors.push({
        id: String(item.itemValue),
        label: item.itemName,
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        refreshRate: match?.refreshRate ?? 60,
        isPrimary: match?.isPrimary ?? false
      })
    }

    // 座標で対応付かない構成でも、どれか 1 つは主モニタとして扱えるようにする。
    if (monitors.length > 0 && !monitors.some((monitor) => monitor.isPrimary)) {
      const head = monitors[0]
      if (head) head.isPrimary = true
    }

    log.info('モニタを確定しました', {
      monitors: monitors.map((m) => ({
        label: m.label,
        x: m.x,
        y: m.y,
        primary: m.isPrimary
      }))
    })

    return monitors
  })
}

/** OBS のモニタ表示名は `Display 1: 1920x1080 @ 0,0 (Primary)` のような形をしている。 */
function parseMonitorLabel(
  label: string
): { width: number; height: number; x: number; y: number } | null {
  const match = /(\d+)x(\d+)\s*@\s*(-?\d+),\s*(-?\d+)/.exec(label)
  if (!match) return null
  return {
    width: Number(match[1]),
    height: Number(match[2]),
    x: Number(match[3]),
    y: Number(match[4])
  }
}

/**
 * キャプチャ可能なウィンドウ一覧。
 * OBS の window 値は `タイトル:クラス名:実行ファイル名` を : で連結した形式。
 */
export async function probeWindows(obs: OBSWebSocket, sceneName: string): Promise<WindowSource[]> {
  return withProbeInput(obs, sceneName, PROBE_INPUT.window, 'window_capture', 'window', (items) =>
    items
      .map((item) => {
        const raw = String(item.itemValue)
        const [title = '', className = '', executable = ''] = raw.split(':')
        return {
          id: raw,
          title: decodeObsWindowField(title),
          className: decodeObsWindowField(className),
          executable: decodeObsWindowField(executable)
        }
      })
      .filter((w) => w.executable.length > 0)
  )
}

/** OBS は window 値の中の記号を # + 16 進でエスケープしている。 */
function decodeObsWindowField(value: string): string {
  return value.replace(/#(3A|23)/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)))
}

/** 接続されている映像入力（Webカメラ、キャプチャボード）の一覧。 */
export async function probeVideoDevices(
  obs: OBSWebSocket,
  sceneName: string
): Promise<Array<{ id: string; label: string }>> {
  return withProbeInput(
    obs,
    sceneName,
    PROBE_INPUT.video,
    'dshow_input',
    'video_device_id',
    (items) => items.map((item) => ({ id: String(item.itemValue), label: item.itemName }))
  )
}

export async function probeAudioDevices(
  obs: OBSWebSocket,
  sceneName: string
): Promise<{ outputs: Array<{ id: string; label: string }>; inputs: Array<{ id: string; label: string }> }> {
  const outputs = await withProbeInput(
    obs,
    sceneName,
    PROBE_INPUT.audioOutput,
    'wasapi_output_capture',
    'device_id',
    (items) => items.map((i) => ({ id: String(i.itemValue), label: i.itemName }))
  )
  const inputs = await withProbeInput(
    obs,
    sceneName,
    PROBE_INPUT.audioInput,
    'wasapi_input_capture',
    'device_id',
    (items) => items.map((i) => ({ id: String(i.itemValue), label: i.itemName }))
  )
  return { outputs, inputs }
}
