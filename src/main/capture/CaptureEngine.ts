import type {
  CaptureProfile,
  EngineState,
  RecordingResult,
  RecordingStats,
  SystemCapabilities,
  WindowSource
} from '@shared/types'

/**
 * Main が録画バックエンドに要求する契約。
 *
 * 実装は現状 ObsWebSocketEngine ひとつだが、将来 libobs を直接リンクする実装や
 * FFmpeg ddagrab による軽量実装へ差し替えられるよう、IPC ハンドラはこの型にだけ依存する。
 * 実装側の都合（OBS のシーン名、リクエスト名など）をこの境界から外へ漏らさないこと。
 */
export interface CaptureEngine {
  readonly state: EngineState

  /** バックエンドを起動して操作可能な状態にする。多重呼び出しは冪等。 */
  initialize(): Promise<void>

  /** 録画中なら停止したうえでバックエンドを終了する。 */
  shutdown(): Promise<void>

  /** 起動時に 1 度だけ収集する、この PC の能力一覧。 */
  getCapabilities(): Promise<SystemCapabilities>

  /** ウィンドウ一覧は起動中に増減するため、UI が開くたびに取り直す。 */
  listWindows(): Promise<WindowSource[]>

  /**
   * 録画を始めずに、指定のプロファイルでソースだけを組み立てる。
   * プレビューを出すために必要で、設定を変えた瞬間に見た目へ反映させる役割も持つ。
   */
  applySource(profile: CaptureProfile): Promise<void>
  /**
   * 録画を止めずに録画範囲の位置だけ追従させる。
   *
   * 大きさは変えられない。出力の解像度は録画の開始時に決まっており、
   * 途中で変えると録画そのものが壊れる。位置だけならクロップの掛け直しで済む。
   */
  followRegion(profile: CaptureProfile): Promise<void>

  startRecording(profile: CaptureProfile): Promise<void>

  /** 停止して出力結果を返す。録画していなければ null。 */
  stopRecording(): Promise<RecordingResult | null>

  pauseRecording(): Promise<void>

  resumeRecording(): Promise<void>

  /** 現在のソースから静止画を書き出し、そのファイルパスを返す。 */
  takeScreenshot(profile: CaptureProfile): Promise<string>

  onStateChange(listener: (state: EngineState) => void): () => void

  onStats(listener: (stats: RecordingStats) => void): () => void

  onFinished(listener: (result: RecordingResult) => void): () => void
}

/** バックエンド由来の失敗を、UI にそのまま出せる日本語メッセージ付きで表現する。 */
export class CaptureEngineError extends Error {
  constructor(
    /** です・ます調。UI にそのまま表示される。 */
    readonly userMessage: string,
    readonly cause?: unknown
  ) {
    super(userMessage)
    this.name = 'CaptureEngineError'
  }
}
