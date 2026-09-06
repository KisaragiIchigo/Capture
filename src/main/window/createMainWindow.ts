import { BrowserWindow, shell } from 'electron'
import { appIcon, preloadScript, rendererEntry } from '@main/lib/paths'

/**
 * メインウィンドウ。
 *
 * frame: false でネイティブ枠を外し、タイトルバーは Renderer 側で描く。
 * ドラッグ領域は CSS の -webkit-app-region で指定するため、
 * タイトルバー内のボタンには必ず no-drag を当てること（当て忘れると押せなくなる）。
 */
/** 開発時のみアイコンを与える。パッケージ後は exe に埋め込まれたものが使われる。 */
function iconOption(): { icon?: string } {
  const icon = appIcon()
  return icon ? { icon } : {}
}

export function createMainWindow(startMinimized: boolean): BrowserWindow {
  const window = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 960,
    minHeight: 620,
    show: false,
    frame: false,
    backgroundColor: '#0b0f19',
    autoHideMenuBar: true,
    ...iconOption(),
    webPreferences: {
      preload: preloadScript(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      // 録画中に背景へ回っても統計表示とタイマーを止めない。
      backgroundThrottling: false
    }
  })

  window.once('ready-to-show', () => {
    if (startMinimized) {
      // 表示してから最小化する。順序が逆だと、表示の時点で最小化が解かれてしまう。
      window.showInactive()
      window.minimize()
      return
    }
    window.show()
  })

  // アプリ内から外部サイトへ遷移させない。リンクは既定ブラウザへ渡す。
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })

  const { devUrl, file } = rendererEntry()
  if (devUrl) {
    void window.loadURL(devUrl)
  } else {
    void window.loadFile(file)
  }

  return window
}
