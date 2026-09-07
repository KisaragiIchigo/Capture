import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import {
  defaultHotkeys,
  type AppSettings,
  type CaptureProfile,
  type EncoderCapability,
  type EncoderId,
  type StillImageConfig,
  type WindowCaptureConfig
} from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { screen } from 'electron'
import type { RegionRect } from '@shared/types'
import { defaultOutputDirectory, settingsFile } from '@main/lib/paths'

const log = createLogger('settings')

/** 設定ファイルの構造を変えたら上げる。読み込み時に旧版なら既定値へ寄せる。 */
const SETTINGS_VERSION = 7

/** ハードウェアエンコーダが使えなかったときに降りていく順序。 */
const ENCODER_FALLBACK_ORDER: EncoderId[] = [
  'nvenc_h264',
  'qsv_h264',
  'amf_h264',
  'nvenc_hevc',
  'qsv_hevc',
  'x264'
]

function defaultProfile(): CaptureProfile {
  return {
    sourceKind: 'display',
    sourceId: null,
    region: null,
    video: {
      fps: 60,
      outputWidth: null,
      outputHeight: null,
      encoder: 'nvenc_h264',
      rateControl: 'cbr',
      // 1080p60 をブロックノイズなく残せる実用下限。上げるほど容量が線形に増える。
      bitrateKbps: 12000,
      cqp: 23,
      keyframeIntervalSec: 2,
      container: 'mp4'
    },
    audio: {
      system: { enabled: true, deviceId: 'default', volume: 1, muted: false },
      microphone: { enabled: false, deviceId: 'default', volume: 1, muted: false },
      separateTracks: true
    },
    cursor: {
      capture: true
    },
    windowCapture: {
      ids: [],
      layout: 'as-is',
      background: 'system',
      gap: 0
    },
    overlays: {
      webcam: {
        enabled: false,
        deviceId: '',
        anchor: 'bottom-right',
        scale: 0.25,
        margin: 0.03,
        opacity: 1
      },
      text: {
        enabled: false,
        text: '',
        fontSize: 32,
        color: '#ffffff',
        backgroundOpacity: 0,
        anchor: 'top-left',
        scale: 0,
        margin: 0.03,
        opacity: 1
      },
      logo: {
        enabled: false,
        filePath: '',
        anchor: 'top-right',
        scale: 0.12,
        margin: 0.03,
        opacity: 0.8
      }
    },
    drawing: {
      color: '#facc15',
      width: 4,
      // 0.4 では下の内容に埋もれて見えないという指摘があったため上げた。
      markerOpacity: 0.6
    },
    pointer: {
      color: '#f43f5e',
      size: 18,
      // 離してからゆっくり薄れて消える長さ。短いと指し示した先が伝わる前に消える。
      fadeOutMs: 5000
    },
    stillImage: {
      format: 'png',
      jpegQuality: 92,
      interval: {
        enabled: false,
        // 画面の変化を追うには短すぎず、枚数が膨らみすぎない間隔。
        intervalSec: 10,
        maxShots: 0,
        minimizeToTray: true
      }
    },
    outputDirectory: defaultOutputDirectory(),
    filenameTemplate: 'Capture_%Y-%m-%d_%H-%M-%S'
  }
}

/**
 * 範囲指定の既定値。対象モニタの中央に 1280×720 を置く。
 * ファインダーを初めて開いたときに、画面外や隅に出ないようにするための位置決め。
 */
export function defaultRegionFor(monitorId: string | null): RegionRect {
  const displays = screen.getAllDisplays()
  const target =
    displays.find((display) => String(display.id) === monitorId) ?? screen.getPrimaryDisplay()

  const width = Math.min(1280, target.bounds.width)
  const height = Math.min(720, target.bounds.height)

  return {
    x: target.bounds.x + Math.round((target.bounds.width - width) / 2),
    y: target.bounds.y + Math.round((target.bounds.height - height) / 2),
    width,
    height
  }
}

export function defaultSettings(): AppSettings {
  return {
    version: SETTINGS_VERSION,
    profile: defaultProfile(),
    hotkeys: defaultHotkeys(),
    behavior: {
      minimizeOnRecord: false,
      alwaysOnTop: false,
      launchOnStartup: false,
      countdownSec: 0,
      autoStopMinutes: 0,
      minFreeDiskGb: 2,
      launchMinimized: true,
      logToFile: true,
      // 不具合の相談に足りて、溜め込みすぎない長さ。
      logRetentionDays: 14
    }
  }
}

/**
 * 保存された設定を読む。
 *
 * 版が違っても捨てない。項目を増やすたびに全部を作り直していると、
 * ユーザーが選んだキャプチャモードや範囲、保存先まで巻き添えで消える。
 * 欠けているキーだけを既定値で補い、既に持っている値はそのまま引き継ぐ。
 */
export function loadSettings(): AppSettings {
  const file = settingsFile()

  try {
    const raw = JSON.parse(readFileSync(file, 'utf8')) as Partial<AppSettings>
    if (raw.version !== SETTINGS_VERSION) {
      log.info('設定ファイルの版が異なるため、足りない項目を補って引き継ぎます', {
        found: raw.version,
        expected: SETTINGS_VERSION
      })
    }
    return mergeWithDefaults(raw)
  } catch {
    log.info('設定ファイルが無いため既定値で開始します', { file })
    return defaultSettings()
  }
}

/**
 * 保存先フォルダを用意する。
 *
 * 録画開始時にも作ってはいるが、それより前にユーザーが［開く］を押せてしまうため、
 * 起動時と保存先の変更時にも作っておく。存在しないフォルダは開けない。
 */
export function ensureOutputDirectory(directory: string): void {
  // ドライブ直下は既に存在するのに mkdir が EPERM で弾かれる。作る必要がある時だけ作る。
  if (existsSync(directory)) return

  try {
    mkdirSync(directory, { recursive: true })
  } catch (err) {
    // 取り外し済みのドライブなどでは作れない。録画開始時に改めて失敗させる。
    log.warn('保存先フォルダを作成できませんでした', err)
  }
}

export function saveSettings(settings: AppSettings): void {
  const file = settingsFile()
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(settings, null, 2), 'utf8')
}

function mergeWithDefaults(raw: Partial<AppSettings>): AppSettings {
  const base = defaultSettings()

  // 版 5 でレーザーポインターの消え方を作り直した。旧版は 3 秒までしか選べず、
  // 尾が先に消えて光点だけが残る挙動だったため、当時選んだ値をそのまま引き継ぐと
  // 意図した緩やかさにならない。この項目だけ新しい既定へ寄せ直す。
  const pointer = { ...base.profile.pointer, ...raw.profile?.pointer }
  if ((raw.version ?? 0) < 5) pointer.fadeOutMs = base.profile.pointer.fadeOutMs

  const stillImage = mergeStillImage(base.profile.stillImage, raw.profile?.stillImage)

  return {
    version: SETTINGS_VERSION,
    profile: {
      ...base.profile,
      ...raw.profile,
      video: { ...base.profile.video, ...raw.profile?.video },
      audio: {
        ...base.profile.audio,
        ...raw.profile?.audio,
        system: { ...base.profile.audio.system, ...raw.profile?.audio?.system },
        microphone: { ...base.profile.audio.microphone, ...raw.profile?.audio?.microphone }
      },
      cursor: { ...base.profile.cursor, ...raw.profile?.cursor },
      windowCapture: mergeWindowCapture(base.profile.windowCapture, raw.profile),
      stillImage,
      overlays: {
        webcam: { ...base.profile.overlays.webcam, ...raw.profile?.overlays?.webcam },
        text: { ...base.profile.overlays.text, ...raw.profile?.overlays?.text },
        logo: { ...base.profile.overlays.logo, ...raw.profile?.overlays?.logo }
      },
      drawing: { ...base.profile.drawing, ...raw.profile?.drawing },
      pointer
    },
    hotkeys: { ...base.hotkeys, ...raw.hotkeys },
    behavior: { ...base.behavior, ...raw.behavior }
  }
}

/**
 * ウィンドウ録画の設定を引き継ぐ。
 *
 * 版 7 より前は対象を 1 つだけ持ち、profile.sourceId に入れていた。選んでいた
 * ウィンドウをそのまま引き継げるよう、控えが無い場合は sourceId から拾い上げる。
 */
function mergeWindowCapture(
  base: WindowCaptureConfig,
  raw: Partial<CaptureProfile> | undefined
): WindowCaptureConfig {
  const merged = { ...base, ...raw?.windowCapture }

  if (raw?.windowCapture === undefined && raw?.sourceKind === 'window' && raw.sourceId) {
    merged.ids = [raw.sourceId]
  }

  return merged
}

/** 版 6 より前の静止画設定。連続撮影の間隔を 1 つの数値で持ち、0 を無効の意味に使っていた。 */
type LegacyStillImage = Partial<StillImageConfig> & { burstIntervalSec?: number }

/**
 * 静止画の設定を引き継ぐ。
 *
 * 定期キャプチャーを独立した設定へ作り直したため、旧版の burstIntervalSec を
 * そのまま残すと保存ファイルに使われないキーが居座り続ける。値だけを移し替え、
 * キーは持ち越さない。
 */
function mergeStillImage(base: StillImageConfig, raw: LegacyStillImage | undefined): StillImageConfig {
  const interval = { ...base.interval, ...raw?.interval }

  if (raw?.interval === undefined && typeof raw?.burstIntervalSec === 'number') {
    interval.enabled = raw.burstIntervalSec > 0
    if (raw.burstIntervalSec > 0) interval.intervalSec = Math.round(raw.burstIntervalSec)
  }

  return {
    format: raw?.format ?? base.format,
    jpegQuality: raw?.jpegQuality ?? base.jpegQuality,
    interval
  }
}

/**
 * 保存されているエンコーダがこの PC で使えない場合に、使える中で最も良いものへ降格する。
 *
 * 別の PC で書かれた設定を持ち込んだときや、GPU を載せ替えたときに、
 * 録画ボタンを押して初めて失敗するのを避けるため、起動直後にここで解決しておく。
 */
export function resolveUsableEncoder(
  requested: EncoderId,
  capabilities: EncoderCapability[]
): EncoderId {
  const usable = new Set(capabilities.filter((c) => c.available).map((c) => c.id))
  if (usable.has(requested)) return requested

  const fallback = ENCODER_FALLBACK_ORDER.find((id) => usable.has(id))
  if (fallback) {
    log.warn('要求されたエンコーダが使えないため代替へ切り替えます', { requested, fallback })
    return fallback
  }
  return 'x264'
}
