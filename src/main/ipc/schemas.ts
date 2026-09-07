import { isAbsolute, normalize } from 'node:path'
import { z } from 'zod'

/**
 * Renderer から届くペイロードの検証。
 *
 * Renderer は自分たちのコードだが、IPC はシステム境界なので信頼しない。
 * とくにパスはそのまま fs へ渡ると任意の場所へ書き込めてしまうため、必ずここを通す。
 */

const absolutePath = z
  .string()
  .min(1)
  .refine((value) => isAbsolute(value), {
    message: 'パスは絶対パスで指定してください。'
  })
  .refine((value) => !normalize(value).includes('..'), {
    message: '上位ディレクトリへの参照を含むパスは指定できません。'
  })

const audioInputSchema = z.object({
  enabled: z.boolean(),
  deviceId: z.string().min(1).max(512),
  volume: z.number().min(0).max(1),
  muted: z.boolean()
})

const videoSchema = z.object({
  fps: z.number().int().min(1).max(240),
  outputWidth: z.number().int().min(16).max(7680).nullable(),
  outputHeight: z.number().int().min(16).max(4320).nullable(),
  encoder: z.enum(['nvenc_h264', 'nvenc_hevc', 'qsv_h264', 'qsv_hevc', 'amf_h264', 'x264']),
  rateControl: z.enum(['cbr', 'vbr', 'cqp']),
  bitrateKbps: z.number().int().min(500).max(300_000),
  cqp: z.number().int().min(1).max(51),
  keyframeIntervalSec: z.number().int().min(0).max(20),
  container: z.enum(['mp4', 'mkv', 'mov'])
})

const ANCHORS = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'middle-center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right'
] as const

/** オーバーレイ共通の配置。比率は 0-1 に収める。 */
const placementSchema = {
  anchor: z.enum(ANCHORS),
  scale: z.number().min(0).max(1),
  margin: z.number().min(0).max(0.5),
  opacity: z.number().min(0).max(1)
}

const overlaySchema = z.object({
  webcam: z.object({
    ...placementSchema,
    enabled: z.boolean(),
    deviceId: z.string().max(512)
  }),
  text: z.object({
    ...placementSchema,
    enabled: z.boolean(),
    text: z.string().max(500),
    fontSize: z.number().int().min(8).max(400),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, {
      message: '色は #rrggbb の形式で指定してください。'
    }),
    backgroundOpacity: z.number().min(0).max(1)
  }),
  logo: z.object({
    ...placementSchema,
    enabled: z.boolean(),
    // 未選択を許すため、空文字か絶対パスのどちらかを受け入れる。
    filePath: z.union([z.literal(''), absolutePath])
  })
})

const regionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int().min(16),
  height: z.number().int().min(16)
})

export const captureProfileSchema = z.object({
  sourceKind: z.enum(['display', 'window', 'game', 'region']),
  sourceId: z.string().max(1024).nullable(),
  region: regionSchema.nullable(),
  video: videoSchema,
  audio: z.object({
    system: audioInputSchema,
    microphone: audioInputSchema,
    separateTracks: z.boolean()
  }),
  cursor: z.object({
    capture: z.boolean()
  }),
  windowCapture: z.object({
    // 数が増えるほど 1 枚が細かくなる。実用の範囲で頭打ちにする。
    ids: z.array(z.string().max(1024)).max(8),
    layout: z.enum(['as-is', 'vertical', 'horizontal']),
    background: z.enum(['system', 'dark', 'light', 'transparent']),
    gap: z.number().int().min(0).max(200)
  }),
  overlays: overlaySchema,
  drawing: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    width: z.number().int().min(1).max(64),
    markerOpacity: z.number().min(0.05).max(1)
  }),
  pointer: z.object({
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    size: z.number().int().min(6).max(80),
    fadeOutMs: z.number().int().min(0).max(8000)
  }),
  stillImage: z.object({
    format: z.enum(['png', 'jpg', 'bmp']),
    jpegQuality: z.number().int().min(20).max(100),
    interval: z.object({
      enabled: z.boolean(),
      intervalSec: z.number().int().min(1).max(3600),
      maxShots: z.number().int().min(0).max(9999),
      minimizeToTray: z.boolean()
    })
  }),
  outputDirectory: absolutePath,
  // % 展開の対象外の文字にパス区切りが混ざるとサブフォルダを掘られるため、区切り文字を弾く。
  filenameTemplate: z
    .string()
    .min(1)
    .max(200)
    .refine((value) => !/[\\/:*?"<>|]/.test(value), {
      message: 'ファイル名に使用できない文字が含まれています。'
    })
})

/** 割り当て 1 つぶん。null は未割り当て。 */
const hotkeyBindingSchema = z
  .object({
    device: z.enum(['key', 'mouse']),
    code: z.number().int().min(0).max(70000),
    ctrl: z.boolean(),
    alt: z.boolean(),
    shift: z.boolean(),
    meta: z.boolean()
  })
  .nullable()

export const appSettingsSchema = z.object({
  version: z.number().int(),
  profile: captureProfileSchema,
  hotkeys: z.object({
    toggleRecording: hotkeyBindingSchema,
    pauseRecording: hotkeyBindingSchema,
    screenshot: hotkeyBindingSchema,
    toggleIntervalCapture: hotkeyBindingSchema,
    toggleWindow: hotkeyBindingSchema,
    toggleDrawing: hotkeyBindingSchema,
    marker: hotkeyBindingSchema
  }),
  behavior: z.object({
    minimizeOnRecord: z.boolean(),
    alwaysOnTop: z.boolean(),
    launchOnStartup: z.boolean(),
    countdownSec: z.number().int().min(0).max(30),
    autoStopMinutes: z.number().int().min(0).max(1440),
    minFreeDiskGb: z.number().min(0).max(1024),
    launchMinimized: z.boolean(),
    logToFile: z.boolean(),
    logRetentionDays: z.number().int().min(0).max(365)
  })
})

/**
 * 定期キャプチャーの実行状況。
 *
 * 枚数に上限を設けないのは、撮影の上限を無制限にできるため。1 秒間隔で回し続ければ
 * 設定の上限値（9999）はいずれ超える。ここで弾くと、その時点で通知領域の表示が止まる。
 */
export const intervalStateSchema = z.object({
  active: z.boolean(),
  shots: z.number().int().min(0)
})

export const pathPayloadSchema = absolutePath

/**
 * 外部ブラウザへ渡す URL。
 *
 * http と https 以外を弾く。file: や data: を通すと、外部を開く口が
 * そのままローカルの実行経路になる。
 */
export const externalUrlSchema = z
  .string()
  .max(2048)
  .refine((value) => {
    try {
      const { protocol } = new URL(value)
      return protocol === 'https:' || protocol === 'http:'
    } catch {
      return false
    }
  }, 'http または https の URL を指定してください')

/** ファインダーの位置とサイズ。仮想デスクトップ上では座標が負になることもある。 */
export const finderBoundsSchema = z.object({
  x: z.number().int().min(-32768).max(32768),
  y: z.number().int().min(-32768).max(32768),
  width: z.number().int().min(16).max(16384),
  height: z.number().int().min(16).max(16384)
})
