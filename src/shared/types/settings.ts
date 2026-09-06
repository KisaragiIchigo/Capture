import type { CaptureProfile } from './capture'
import type { HotkeyConfig } from './hotkey'

export interface AppBehaviorConfig {
  /** 録画開始時にウィンドウを最小化します。 */
  minimizeOnRecord: boolean
  /** ウィンドウを常に他のウィンドウより前面に表示します。 */
  alwaysOnTop: boolean
  /** Windows へのサインイン時にこのアプリを自動起動します。 */
  launchOnStartup: boolean
  /** 録画開始前のカウントダウン秒数。0 で無効です。 */
  countdownSec: number
  /** 指定分数で自動的に録画を停止します。0 で無制限です。 */
  autoStopMinutes: number
  /** 出力先の空き容量がこの値を下回ったら録画を停止します（GB）。 */
  minFreeDiskGb: number
  /** 起動時にウィンドウを最小化した状態で待機します。 */
  launchMinimized: boolean
}

export interface AppSettings {
  version: number
  profile: CaptureProfile
  hotkeys: HotkeyConfig
  behavior: AppBehaviorConfig
}
