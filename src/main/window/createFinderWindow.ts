import { BrowserWindow, screen } from 'electron'
import {
  FINDER_BAR_HEIGHT,
  FINDER_BAR_ONLY_WIDTH,
  minimumWindowSize,
  regionToWindowBounds,
  windowBoundsToRegion,
  type RegionRect,
  type WindowBounds
} from '@shared/types'
import { excludeFromCapture } from '@main/lib/captureExclusion'
import { appIcon, finderEntry, preloadScript } from '@main/lib/paths'

/**
 * 範囲指定ファインダー。
 *
 * 中央を透過させ、そのウィンドウが占める領域そのものが録画範囲になる。
 * 数値入力より直感的な代わりに、ウィンドウ座標と録画範囲の対応がずれると
 * 「見えている枠と録れる範囲が違う」という最悪の壊れ方をするので、
 * 換算は shared/types/finder.ts の関数だけに任せる。
 *
 * この窓は録画から外す。枠線と掴み代は範囲の外にあるので元から写らないが、
 * 操作バーは範囲指定以外の姿では録画対象の上に浮かぶ。バーは録りたいものではない。
 */
export function createFinderWindow(region: RegionRect | null): BrowserWindow {
  // 範囲指定でないときは枠を持たず、操作バーだけを画面上部へ置く。
  const bounds = region
    ? clampToDisplays(regionToWindowBounds(region))
    : clampToDisplays(barOnlyBounds())
  const minimum = region ? minimumWindowSize() : { width: 240, height: FINDER_BAR_HEIGHT }
  const icon = appIcon()

  const window = new BrowserWindow({
    ...bounds,
    minWidth: minimum.width,
    minHeight: minimum.height,
    show: false,
    frame: false,
    transparent: true,
    // 透過ウィンドウに影が付くと、影の矩形まで録画範囲だと誤解される。
    hasShadow: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    ...(icon ? { icon } : {}),
    // リサイズは自前のハンドルで行う。ネイティブの縁は透過ウィンドウでは掴みにくい。
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    webPreferences: {
      preload: preloadScript(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  excludeFromCapture(window)

  // 全画面のゲームより手前に出したいので、通常の alwaysOnTop より上の層に置く。
  window.setAlwaysOnTop(true, 'screen-saver')
  window.once('ready-to-show', () => window.showInactive())

  const { devUrl, file } = finderEntry()
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(file)

  return window
}

/** 枠を持たないときの初期位置。主モニタの上端中央へ寄せる。 */
function barOnlyBounds(): WindowBounds {
  const display = screen.getPrimaryDisplay()
  return {
    x: display.workArea.x + Math.round((display.workArea.width - FINDER_BAR_ONLY_WIDTH) / 2),
    y: display.workArea.y + 12,
    width: FINDER_BAR_ONLY_WIDTH,
    height: FINDER_BAR_HEIGHT
  }
}

/** ウィンドウの現在位置から録画範囲を読む。 */
export function readRegionFromWindow(window: BrowserWindow): RegionRect {
  return windowBoundsToRegion(window.getBounds())
}

/**
 * どのモニタにも載っていない位置に置かれると、枠が画面外へ消えて操作できなくなる。
 * 保存された座標がモニタ構成の変更で無効になっている場合に備えて寄せ直す。
 */
function clampToDisplays(bounds: WindowBounds): WindowBounds {
  const target =
    screen.getAllDisplays().find((display) => {
      const area = display.workArea
      return (
        bounds.x < area.x + area.width &&
        bounds.x + bounds.width > area.x &&
        bounds.y < area.y + area.height &&
        bounds.y + bounds.height > area.y
      )
    }) ?? screen.getPrimaryDisplay()

  const area = target.workArea
  const width = Math.min(bounds.width, area.width)
  const height = Math.min(bounds.height, area.height)

  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, area.x), area.x + area.width - width),
    y: Math.min(Math.max(bounds.y, area.y), area.y + area.height - height)
  }
}
