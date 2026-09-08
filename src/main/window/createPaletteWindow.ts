import { BrowserWindow } from 'electron'
import type { WindowBounds } from '@shared/types'
import { excludeFromCapture } from '@main/lib/captureExclusion'
import { appIcon, paletteEntry, preloadScript } from '@main/lib/paths'

/**
 * 描き込みの道具を並べる窓。
 *
 * 描画面と別の窓にするのは、録画から除外するため。除外の単位はウィンドウなので、
 * 描画面と同じ窓に置くと、パレットを消すつもりで描いた線まで映らなくなる。
 *
 * 除外の仕組みと効かない環境については lib/captureExclusion.ts を見ること。
 *
 * 掴んでも前面化しない窓にしておく。前面を奪うと、描画面の Esc と、
 * 文字入力中の入力欄がその場で切れる。
 */
export function createPaletteWindow(bounds: WindowBounds): BrowserWindow {
  const icon = appIcon()

  const window = new BrowserWindow({
    ...bounds,
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
    ...(icon ? { icon } : {}),
    webPreferences: {
      preload: preloadScript(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      backgroundThrottling: false
    }
  })

  excludeFromCapture(window)

  // 描画面と同じ層に置く。ゲームのフルスクリーンより手前に出す必要がある。
  window.setAlwaysOnTop(true, 'screen-saver')

  const { devUrl, file } = paletteEntry()
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(file)

  return window
}
