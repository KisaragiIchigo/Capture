import { BrowserWindow, screen } from 'electron'
import { pointerEntry, preloadScript } from '@main/lib/paths'

/**
 * レーザーポインターの軌跡を映す窓。
 *
 * 描き込みの窓と分けているのは、求められる挙動が正反対のため。
 * あちらは描くために画面を占有するが、こちらは操作を一切妨げてはいけない。
 * 常にクリックスルーにし、マウスの位置は入力フックから受け取る。
 *
 * 使うたびに作ると出るまでに間があく。起動時に用意して隠しておき、
 * 押された瞬間に見せる。
 */
export function createPointerWindow(): BrowserWindow {
  const display = screen.getPrimaryDisplay()

  const window = new BrowserWindow({
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
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

  // 指し示すだけの窓なので、マウスは常に素通しさせる。
  window.setIgnoreMouseEvents(true, { forward: false })
  window.setAlwaysOnTop(true, 'screen-saver')

  const { devUrl, file } = pointerEntry()
  if (devUrl) void window.loadURL(devUrl)
  else void window.loadFile(file)

  return window
}

/** マウスの位置に合わせて、その座標を含むモニタへ窓を移す。 */
export function movePointerWindowTo(window: BrowserWindow, x: number, y: number): void {
  const display = screen.getDisplayNearestPoint({ x, y })
  const bounds = window.getBounds()

  if (
    bounds.x === display.bounds.x &&
    bounds.y === display.bounds.y &&
    bounds.width === display.bounds.width &&
    bounds.height === display.bounds.height
  ) {
    return
  }

  window.setBounds(display.bounds)
}
