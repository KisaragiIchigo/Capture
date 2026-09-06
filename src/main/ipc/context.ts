import type { BrowserWindow } from 'electron'
import type { AppSettings, CaptureProfile, IntervalCaptureState } from '@shared/types'
import type { CaptureEngine } from '@main/capture/CaptureEngine'

/**
 * IPC ハンドラが必要とする依存の受け渡し口。
 *
 * ハンドラ側でモジュールスコープの可変変数を持たせないためにここへ集約する。
 * ハンドラは main/index.ts が組み立てたこのオブジェクトだけを見る。
 */
export interface IpcContext {
  engine: CaptureEngine
  getWindow: () => BrowserWindow | null
  getSettings: () => AppSettings
  setSettings: (settings: AppSettings) => void
  /** 次の入力を割り当てとして捕まえる。 */
  beginHotkeyCapture: () => void
  cancelHotkeyCapture: () => void
  /** 録画開始直後の副作用（設定に応じたウィンドウ最小化など）を main 側に任せる。 */
  onRecordingStarted: () => void
  /** 静止画を保存し終えたことを全ウィンドウへ配る。撮れた合図をどこから撮っても揃えるため。 */
  onScreenshotSaved: (file: string) => void
  /**
   * ファインダーの移動やリサイズで録画範囲が確定したときに呼ぶ。
   *
   * 設定を書き換えるだけではソースは組み直されない。ここを通さないと、
   * 枠を動かしても録れる範囲は前のままになる。
   */
  onRegionSettled: (profile: CaptureProfile) => void
  /**
   * 定期キャプチャーの実行状況が変わった。
   *
   * 通知領域のアイコンの色と、撮影開始に伴うウィンドウの引っ込めを Main 側で行う。
   */
  onIntervalState: (state: IntervalCaptureState) => void
  /** キャプチャエンジンを起動して録画できる状態にする。セットアップ完了後にも呼ぶ。 */
  startEngine: () => Promise<void>
  /** 動いていないエンジンを畳んでから起動し直す。起動に失敗した状態からの復帰に使う。 */
  restartEngine: () => Promise<void>
}
