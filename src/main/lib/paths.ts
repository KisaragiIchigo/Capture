import { join } from 'node:path'
import { app } from 'electron'

/**
 * キャプチャエンジン（OBS ポータブル）の展開先。
 *
 * インストーラには同梱せず、初回起動時にアプリがダウンロードして展開する。
 * パッケージ後の展開先を userData 配下にするのは、インストール先が Program Files のとき
 * 管理者権限なしでは書き込めないため。開発時はプロジェクトの resources/ を使う。
 */
export function obsRoot(): string {
  return app.isPackaged
    ? join(app.getPath('userData'), 'engine', 'obs-studio')
    : join(app.getAppPath(), 'resources', 'obs-studio')
}

/**
 * インストーラへ同梱したキャプチャエンジンの位置。
 *
 * ここにあるものは読み取り専用の場所へ置かれる（Program Files 配下になり得る）。
 * OBS はポータブルモードで自分のフォルダへ設定を書くため、直接は使えない。
 * 初回起動時に obsRoot() へ複製してから使う。
 *
 * 同梱せずにビルドすることもあるため、存在するかどうかは呼び出し側で確かめる。
 */
export function bundledEngineRoot(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'engine', 'obs-studio')
    : join(app.getAppPath(), 'build', 'engine', 'obs-studio')
}

/** OBS は data/ と obs-plugins/ を実行ファイルからの相対で探すため、cwd をここに合わせて起動する。 */
export function obsBinDir(): string {
  return join(obsRoot(), 'bin', '64bit')
}

export function obsExecutable(): string {
  return join(obsBinDir(), 'obs64.exe')
}

/** このファイルが存在すると OBS はポータブルモードで動き、設定を自分のフォルダ内に書く。 */
export function obsPortableMarker(): string {
  return join(obsRoot(), 'portable_mode.txt')
}

/** OBS がポータブルモードで設定を書き出す場所。 */
export function obsConfigDir(): string {
  return join(obsRoot(), 'config', 'obs-studio')
}

/** obs-websocket の設定ファイル。サーバーの有効化はここでしか行えない。 */
export function obsWebSocketConfigFile(): string {
  return join(obsConfigDir(), 'plugin_config', 'obs-websocket', 'config.json')
}

export function settingsFile(): string {
  return join(app.getPath('userData'), 'settings.json')
}

export function logDirectory(): string {
  return join(app.getPath('userData'), 'logs')
}

/** 出力先の初期値。ユーザーの動画フォルダ配下に専用フォルダを掘る。 */
export function defaultOutputDirectory(): string {
  return join(app.getPath('videos'), 'Capture')
}

/** Renderer の起動 URL / ファイル。dev はサーバ、パッケージ後は file:// 読み込み。 */
export function rendererEntry(): { devUrl: string | null; file: string } {
  const devUrl = process.env['ELECTRON_RENDERER_URL'] ?? null
  return { devUrl, file: join(__dirname, '../renderer/index.html') }
}

/** 範囲指定ファインダーの読み込み先。Renderer の 2 つ目のエントリになる。 */
export function finderEntry(): { devUrl: string | null; file: string } {
  const base = process.env['ELECTRON_RENDERER_URL']
  return {
    devUrl: base ? `${base}/finder.html` : null,
    file: join(__dirname, '../renderer/finder.html')
  }
}

/**
 * ウィンドウに使うアイコン。
 *
 * パッケージ後は electron-builder が exe へ埋め込むため、指定しなくても
 * タスクバーとウィンドウに反映される。開発時の実行ファイルは electron.exe なので、
 * そのままでは Electron の既定アイコンが出る。開発時だけ明示する。
 */
export function appIcon(): string | undefined {
  if (app.isPackaged) return undefined
  return join(app.getAppPath(), 'build', 'icon.ico')
}

/** 画面へ描き込む窓の読み込み先。 */
export function drawingEntry(): { devUrl: string | null; file: string } {
  const base = process.env['ELECTRON_RENDERER_URL']
  return {
    devUrl: base ? `${base}/drawing.html` : null,
    file: join(__dirname, '../renderer/drawing.html')
  }
}

/** 描き込みの道具を並べる窓の読み込み先。録画から外すため描画面とは別の窓になる。 */
export function paletteEntry(): { devUrl: string | null; file: string } {
  const base = process.env['ELECTRON_RENDERER_URL']
  return {
    devUrl: base ? `${base}/palette.html` : null,
    file: join(__dirname, '../renderer/palette.html')
  }
}

/** レーザーポインターの窓の読み込み先。 */
export function pointerEntry(): { devUrl: string | null; file: string } {
  const base = process.env['ELECTRON_RENDERER_URL']
  return {
    devUrl: base ? `${base}/pointer.html` : null,
    file: join(__dirname, '../renderer/pointer.html')
  }
}

/** 撮れたことを知らせる札の窓の読み込み先。 */
export function toastEntry(): { devUrl: string | null; file: string } {
  const base = process.env['ELECTRON_RENDERER_URL']
  return {
    devUrl: base ? `${base}/toast.html` : null,
    file: join(__dirname, '../renderer/toast.html')
  }
}

export function preloadScript(): string {
  return join(__dirname, '../preload/index.js')
}
