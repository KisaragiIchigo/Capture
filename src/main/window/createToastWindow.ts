import { BrowserWindow, screen } from 'electron'
import {
  pickToastBounds,
  TOAST_HEIGHT,
  TOAST_WIDTH,
  type CaptureProfile,
  type ToastPlacement
} from '@shared/types'
import { toastEntry, preloadScript } from '@main/lib/paths'

/**
 * 静止画が撮れたことを知らせる札の窓。
 *
 * ファインダーの操作バーもメインウィンドウも画面に無いとき、合図を出す先が
 * どこにも残らない。どの窓の生死にも依存しない合図として、起動時から常駐させる。
 *
 * 見せるだけの窓なので、常にクリックスルーにしてフォーカスも奪わない。
 * 撮った直後に操作を続けられなくなると、合図が邪魔になって本末転倒になる。
 */
export function createToastWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: TOAST_WIDTH,
    height: TOAST_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    focusable: false,
    fullscreenable: false,
    webPreferences: {
      preload: preloadScript(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  window.setIgnoreMouseEvents(true, { forward: false })
  window.setAlwaysOnTop(true, 'screen-saver')

  const { devUrl, file } = toastEntry()
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(file)

  return window
}

/**
 * 札を出す場所を決める。
 *
 * 避けたい相手は取り込み方で変わる。
 *   範囲指定           … 範囲そのもの。四隅のうち重ならない所へ逃がせる。
 *   ウィンドウ / ゲーム … 対象ウィンドウの中身だけが録られるため、避ける相手はいない。
 *   画面全体           … そのモニタに映るものはすべて録られるため、逃げ場が無い。
 *
 * 画面全体の取り込みでどのモニタが対象かは、保存されている monitor_id からは
 * 確実には引けない。逃げ場が無いことに変わりはないので、位置はプライマリの隅に置き、
 * 重なる事実だけを返す。実際に出すかどうかは録画中かどうかを知っている側が決める。
 */
export function resolveToastPlacement(profile: CaptureProfile): ToastPlacement {
  // 範囲が未設定なら避ける相手が定まらない。位置決めもプライマリに委ねる。
  const region = profile.sourceKind === 'region' ? profile.region : null
  const display = region ? screen.getDisplayMatching(region) : screen.getPrimaryDisplay()
  const area = display.workArea

  if (profile.sourceKind === 'display') {
    return { bounds: pickToastBounds(area, null).bounds, overlapsTarget: true }
  }

  // ウィンドウとゲームは対象ウィンドウの中身だけが録られるため、避ける相手はいない。
  return pickToastBounds(area, region)
}
