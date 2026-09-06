import { BrowserWindow, screen } from 'electron'
import type { CaptureProfile } from '@shared/types'
import { appIcon, drawingEntry, preloadScript } from '@main/lib/paths'

/**
 * 画面へ直接描き込むための窓。
 *
 * 録画される範囲だけを覆う。画面全体を覆うと、範囲の外にある操作バーへ
 * 手が届かなくなり、録画を止めることすらできなくなる。
 * 範囲の外は描いても映らないので、覆う理由もない。
 *
 * OBS のソースとして持たないのは、描いている最中の見え方と録画結果を
 * 必ず一致させるため。別経路で合成すると位置や縮尺がずれる余地が生まれる。
 */
export function createDrawingWindow(profile: CaptureProfile): BrowserWindow {
  const area = resolveDrawingArea(profile)
  const icon = appIcon()

  const window = new BrowserWindow({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    show: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    fullscreenable: false,
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadScript(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  // ゲームのフルスクリーンより手前に出したいので、通常より上の層へ置く。
  window.setAlwaysOnTop(true, 'screen-saver')
  window.once('ready-to-show', () => window.show())

  const { devUrl, file } = drawingEntry()
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(file)

  return window
}

interface Area {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 描ける範囲を決める。
 *
 * 範囲指定なら枠の内側だけ。それ以外は対象モニタの全面になる。
 * ウィンドウやゲームを録る場合、その位置は動くため追えない。モニタ全体を対象にする。
 *
 * 窓を作るときだけでなく、録画範囲が変わったときの追従にも使う。
 * 同じ計算を 2 か所に持つと、片方だけ直したときに描いた位置と映る位置が食い違う。
 */
export function resolveDrawingArea(profile: CaptureProfile): Area {
  if (profile.sourceKind === 'region' && profile.region) return profile.region

  const display = resolveDisplay(profile.sourceId)
  return display.bounds
}

/** 録画対象のモニタへ重ねる。特定できない場合は主モニタを使う。 */
function resolveDisplay(monitorId: string | null): Electron.Display {
  if (!monitorId) return screen.getPrimaryDisplay()

  // OBS の monitor_id は Electron の id と体系が異なるため、数値 id のときだけ照合する。
  const numeric = Number(monitorId)
  if (Number.isFinite(numeric)) {
    const found = screen.getAllDisplays().find((display) => display.id === numeric)
    if (found) return found
  }

  return screen.getPrimaryDisplay()
}
