import type { DrawingConfig } from './drawing'
import type { PointerConfig } from './pointer'
import type { OverlayConfig } from './overlay'

/** キャプチャ対象の種別。UI のソース選択タブと 1:1 で対応する。 */
export type CaptureSourceKind = 'display' | 'window' | 'game' | 'region'

/** 物理モニタ。座標はマルチモニタ仮想デスクトップ上の絶対位置。 */
export interface DisplaySource {
  id: string
  label: string
  x: number
  y: number
  width: number
  height: number
  refreshRate: number
  isPrimary: boolean
}

/** 可視ウィンドウ。executable はゲーム判定とフック対象の指定に使う。 */
export interface WindowSource {
  id: string
  title: string
  executable: string
  className: string
}

/**
 * 複数のウィンドウを 1 枚へまとめるときの並べ方。
 *
 * as-is は画面に置かれているとおりの位置関係を保つ。位置を取得できなかったウィンドウが
 * ある場合は、並べ方として成立しないため横並びへ落とす。
 */
export type WindowLayout = 'as-is' | 'vertical' | 'horizontal'

/**
 * 映像で埋まらない部分の扱い。
 *
 * transparent は静止画（PNG）でのみ透明として残る。動画のコンテナは透明を持てないため、
 * 録画では黒になる。
 */
export type CanvasBackground = 'system' | 'dark' | 'light' | 'transparent'

/** 複数ウィンドウ録画の設定。1 つだけ選んだ場合も同じ道を通る。 */
export interface WindowCaptureConfig {
  /** 取り込む対象。OBS のウィンドウ識別子をそのまま持つ。 */
  ids: string[]
  layout: WindowLayout
  background: CanvasBackground
  /** 並べるときのウィンドウ同士の間隔（ピクセル）。 */
  gap: number
}

/** 矩形指定。座標は仮想デスクトップ絶対座標で保持する。 */
export interface RegionRect {
  x: number
  y: number
  width: number
  height: number
}

export type EncoderId =
  | 'nvenc_h264'
  | 'nvenc_hevc'
  | 'qsv_h264'
  | 'qsv_hevc'
  | 'amf_h264'
  | 'x264'

/** 実機で使えるかどうかを検出した結果。使えない場合は理由を UI に出す。 */
export interface EncoderCapability {
  id: EncoderId
  label: string
  hardware: boolean
  available: boolean
  unavailableReason?: string
}

export type RateControl = 'cbr' | 'vbr' | 'cqp'

export type OutputContainer = 'mp4' | 'mkv' | 'mov'

/** 音声入力 1 系統ぶんの設定。システム音とマイクを別トラックに分けて録る前提。 */
export interface AudioInputConfig {
  enabled: boolean
  deviceId: string
  /** 0.0 - 1.0。UI 側では dB 換算して表示する。 */
  volume: number
  muted: boolean
}

export interface AudioConfig {
  system: AudioInputConfig
  microphone: AudioInputConfig
  /** true でシステム音とマイクを別トラックに分離して出力する（編集で分離できる）。 */
  separateTracks: boolean
}

export interface VideoConfig {
  fps: number
  /** 出力解像度。null なら入力解像度そのまま。 */
  outputWidth: number | null
  outputHeight: number | null
  encoder: EncoderId
  rateControl: RateControl
  /** cbr / vbr のときのビットレート。 */
  bitrateKbps: number
  /** cqp のときの量子化パラメータ。 */
  cqp: number
  keyframeIntervalSec: number
  container: OutputContainer
}

export interface CursorConfig {
  /** 録画映像と静止画の両方に反映される。個別指定はキャプチャ元の制約でできない。 */
  capture: boolean
}

export type StillImageFormat = 'png' | 'jpg' | 'bmp'

/**
 * 定期キャプチャーの設定。
 *
 * 実行中かどうかはここに持たない。設定として保存すると、次の起動でいきなり
 * 撮り始めることになり、画面に何が出ているか分からないまま保存が走ってしまう。
 */
export interface IntervalCaptureConfig {
  /** 定期キャプチャーを使うかどうか。無効の間は開始の操作を受け付けない。 */
  enabled: boolean
  /** 1 枚保存してから次を撮るまでの秒数。 */
  intervalSec: number
  /** この枚数まで撮ったら自動的に止める。0 で無制限。 */
  maxShots: number
  /** 撮影を始めたらウィンドウを通知領域へ引っ込める。 */
  minimizeToTray: boolean
}

/** 定期キャプチャーの実行状況。Renderer が持つ実行状態を Main へ知らせるために使う。 */
export interface IntervalCaptureState {
  active: boolean
  /** 今回の実行で保存できた枚数。 */
  shots: number
}

export interface StillImageConfig {
  format: StillImageFormat
  /** jpg のときの品質。png / bmp では使わない。 */
  jpegQuality: number
  interval: IntervalCaptureConfig
}

/** 1 回の録画を成立させるのに必要な設定一式。 */
export interface CaptureProfile {
  sourceKind: CaptureSourceKind
  /** display / window / game のときの対象 id。region のときは対象ディスプレイ id。 */
  sourceId: string | null
  region: RegionRect | null
  video: VideoConfig
  audio: AudioConfig
  cursor: CursorConfig
  /** ウィンドウ録画の対象と並べ方。sourceKind が window のときだけ使う。 */
  windowCapture: WindowCaptureConfig
  stillImage: StillImageConfig
  overlays: OverlayConfig
  drawing: DrawingConfig
  pointer: PointerConfig
  outputDirectory: string
  /** 出力ファイル名のテンプレート。%Y %m %d %H %M %S と %SOURCE を展開する。 */
  filenameTemplate: string
}

export type EngineStatus =
  | 'idle'
  | 'launching'
  | 'connecting'
  | 'ready'
  | 'recording'
  | 'paused'
  | 'stopping'
  | 'error'

export interface EngineState {
  status: EngineStatus
  /** ready 以降で埋まる。UI のフッタに出す。 */
  backendVersion: string | null
  /** error のときの人間向けメッセージ（です・ます調）。 */
  message: string | null
}

/** 録画中に 1 秒間隔で Renderer へ push する実測値。 */
export interface RecordingStats {
  durationMs: number
  bytesWritten: number
  /** エンコーダが実際に出せているフレームレート。 */
  fps: number
  droppedFrames: number
  totalFrames: number
  cpuUsage: number
  freeDiskBytes: number
}

export interface RecordingResult {
  filePath: string
  durationMs: number
  bytesWritten: number
}

export type SetupPhase =
  | 'idle'
  | 'resolving'
  | 'downloading'
  | 'extracting'
  /** 同梱されたエンジンを、書き込みできる場所へ複製している。 */
  | 'copying'
  | 'verifying'
  | 'done'
  | 'error'

/** キャプチャエンジンの取得と展開の進み具合。 */
export interface SetupProgress {
  phase: SetupPhase
  /** downloading ではバイト数、extracting ではエントリ数。 */
  receivedBytes: number
  totalBytes: number
  /** 0-1 の進捗。総量が不明な場合は 0。 */
  ratio: number
  /** error のときの人間向けメッセージ（です・ます調）。 */
  message: string | null
}

/** 起動時に 1 度だけ収集する、この PC で何ができるかの一覧。 */
export interface SystemCapabilities {
  displays: DisplaySource[]
  encoders: EncoderCapability[]
  audioOutputDevices: Array<{ id: string; label: string }>
  audioInputDevices: Array<{ id: string; label: string }>
  /** Webカメラなどの映像入力。オーバーレイの選択肢に使う。 */
  videoInputDevices: Array<{ id: string; label: string }>
}
