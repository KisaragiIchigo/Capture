import { app, type BrowserWindow } from 'electron'
import type { AppBehaviorConfig } from '@shared/types'

/**
 * ウィンドウと OS に紐づく設定を実際に反映する。
 *
 * 設定を保存しただけでは何も起きない項目をここへ集め、
 * 保存経路と起動経路の両方から同じ関数を呼ぶことで、UI と実挙動がずれないようにする。
 */
export function applyBehavior(window: BrowserWindow | null, behavior: AppBehaviorConfig): void {
  if (window && !window.isDestroyed()) {
    window.setAlwaysOnTop(behavior.alwaysOnTop)
  }

  app.setLoginItemSettings({
    openAtLogin: behavior.launchOnStartup,
    // 自動起動のときだけ最小化で立ち上げ、サインイン直後に前面を奪わないようにする。
    args: behavior.launchMinimized ? ['--minimized'] : []
  })
}

/** 自動起動から立ち上がったかどうか。起動時の見せ方を変えるために使う。 */
export function launchedMinimized(): boolean {
  return process.argv.includes('--minimized')
}
