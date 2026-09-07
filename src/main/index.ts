import { app, BrowserWindow, screen } from 'electron'
import {
  CLICK_RIPPLE_MS,
  IPC,
  SHOT_NOTICE_MS,
  type AppSettings,
  type HotkeyAction
} from '@shared/types'
import { configureFileLogging, createLogger } from './lib/logger'
import { pruneLogs } from './lib/logStore'
import { createMainWindow } from './window/createMainWindow'
import { HotkeyHook } from './window/hotkeyHook'
import { createPointerWindow, movePointerWindowTo } from './window/createPointerWindow'
import { createToastWindow, resolveToastPlacement } from './window/createToastWindow'
import { applyBehavior, launchedMinimized } from './window/applyBehavior'
import { CaptureTray, hideToTray } from './window/createTray'
import { registerIpc } from './ipc/registerIpc'
import { openFinder } from './ipc/handlers/finderHandlers'
import { toggleDrawingWindow, updateDrawingArea } from './ipc/handlers/drawingHandlers'
import { runInstall } from './ipc/handlers/setupHandlers'
import { isEngineBundled, isEngineInstalled, isEngineOutdated } from './setup/installEngine'
import type { IpcContext } from './ipc/context'
import { ObsWebSocketEngine } from './capture/ObsWebSocketEngine'
import { detectEncoders } from './capture/ObsWebSocketEngine/detectEncoders'
import {
  ensureOutputDirectory,
  loadSettings,
  resolveUsableEncoder,
  saveSettings
} from './settings/store'

const log = createLogger('main')

let mainWindow: BrowserWindow | null = null
let settings: AppSettings = loadSettings()

/*
 * ログの扱いは、他のどの処理より先に確定させる。ここまでの行は控えに溜まっており、
 * 保存する設定なら書き出され、しない設定なら 1 行も残らない。
 */
configureFileLogging(settings.behavior.logToFile)
pruneLogs(settings.behavior.logRetentionDays)
let releaseIpc: (() => void) | null = null
let hotkeys: HotkeyHook | null = null
let engine: ObsWebSocketEngine | null = null
let pointerWindow: BrowserWindow | null = null
let toastWindow: BrowserWindow | null = null
let toastHideTimer: ReturnType<typeof setTimeout> | null = null
let pointerHideTimer: ReturnType<typeof setTimeout> | null = null
let tray: CaptureTray | null = null

/** 定期キャプチャーの実行状況。Renderer から届いた事実をそのまま持つ。 */
let intervalState = { active: false, shots: 0 }

// 二重起動を許すとホットキーの奪い合いと OBS の多重起動が起きる。
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

/**
 * 保存済みのエンコーダがこの PC で使えるかを、OBS を起動する前に解決しておく。
 * 録画ボタンを押した瞬間に初めて失敗する、という体験を避けるため。
 */
async function reconcileEncoder(): Promise<void> {
  const capabilities = await detectEncoders()
  const usable = resolveUsableEncoder(settings.profile.video.encoder, capabilities)
  if (usable === settings.profile.video.encoder) return

  settings = {
    ...settings,
    profile: { ...settings.profile, video: { ...settings.profile.video, encoder: usable } }
  }
  saveSettings(settings)
}

async function bootstrap(): Promise<void> {
  await reconcileEncoder()
  ensureOutputDirectory(settings.profile.outputDirectory)

  engine = new ObsWebSocketEngine(settings.profile)
  mainWindow = createMainWindow(settings.behavior.launchMinimized || launchedMinimized())
  applyBehavior(mainWindow, settings.behavior)

  const sendToWindows = (channel: string, payload: unknown): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(channel, payload)
    }
  }

  const showMainWindow = (): void => {
    const window = mainWindow
    if (!window || window.isDestroyed()) return

    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  }

  /** 通知領域の見た目を、いまの設定と実行状況に合わせる。 */
  const refreshTray = (): void => {
    const interval = settings.profile.stillImage.interval
    tray?.update({
      enabled: interval.enabled,
      active: intervalState.active,
      shots: intervalState.shots,
      intervalSec: interval.intervalSec
    })
  }

  tray = new CaptureTray({
    // 開始と停止の判断は Renderer が持つ。押された事実だけを、ホットキーと同じ経路で渡す。
    toggleCapture: () => sendToWindows(IPC.events.hotkeyTriggered, 'toggleIntervalCapture'),
    showWindow: showMainWindow,
    quit: () => app.quit()
  })

  /**
   * 押されたホットキーを配る。
   *
   * ウィンドウの出し入れだけは Renderer の状態と無関係なので Main で完結させる。
   * それ以外は事実だけを送り、何をするかは受け取った側が決める。
   */
  /**
   * レーザーポインターの表示。
   *
   * 押している間だけ見せ、離したら軌跡が消え切るのを待って隠す。
   * 隠すまでの猶予を置かないと、尾が残ったまま窓が消えて途切れて見える。
   */
  /**
   * 効果が消え切るまで窓を出しておく。
   *
   * この窓はレーザーの軌跡とクリックの波紋の両方を映す。どちらの都合でも出し入れするため、
   * 隠す判断を 1 か所に集める。押しっぱなしの間は、待ち時間が過ぎても隠さない。
   */
  const keepPointerVisible = (durationMs: number): void => {
    const window = pointerWindow
    if (!window || window.isDestroyed()) return

    if (!window.isVisible()) window.showInactive()

    if (pointerHideTimer) clearTimeout(pointerHideTimer)
    pointerHideTimer = setTimeout(() => {
      pointerHideTimer = null
      if (window.isDestroyed() || hotkeysHeld.has('marker')) return
      window.hide()
    }, durationMs)
  }

  const showPointer = (): void => {
    const window = pointerWindow
    if (!window || window.isDestroyed()) return

    // 窓は起動時にプライマリへ作られ、その後はマウスが動いたときだけ追従する。
    // 出す前に今カーソルがいるモニタへ移しておかないと、押した瞬間だけ前回のモニタに現れる。
    // 録画しているモニタと違えば、指しているつもりの光が映像のどこにも入らない。
    const cursor = screen.getCursorScreenPoint()
    movePointerWindowTo(window, cursor.x, cursor.y)

    // 押している間は隠さない。波紋の予約が残っていれば取り消す。
    if (pointerHideTimer) {
      clearTimeout(pointerHideTimer)
      pointerHideTimer = null
    }

    window.showInactive()

    // 押し始めの原点も渡す。まだマウスを動かしていない間に古い原点で描くと、
    // 前に描いた軌跡が薄れながら別のモニタへ居座って見える。
    const bounds = window.getBounds()
    window.webContents.send(IPC.events.pointerStart, {
      originX: bounds.x,
      originY: bounds.y
    })
  }

  const hidePointer = (): void => {
    const window = pointerWindow
    if (!window || window.isDestroyed()) return

    window.webContents.send(IPC.events.pointerEnd)

    // 薄れ切る前に窓を隠すと、途中で断ち切られたように見える。
    // 消えるまでの長さは設定で変えられるので、待ち時間もそこから決める。
    keepPointerVisible(settings.profile.pointer.fadeOutMs + POINTER_HIDE_MARGIN_MS)
  }

  /**
   * 押した場所に波紋を出す。
   *
   * 録画にマウスカーソルを含める設定のときだけ出す。カーソルが映らない録画で
   * 波紋だけが広がると、何も無い場所で輪が出ることになる。
   */
  const showClickRipple = (x: number, y: number): void => {
    if (!settings.profile.cursor.capture) return

    const window = pointerWindow
    if (!window || window.isDestroyed()) return

    // レーザーを出している間は窓を動かさない。溜めてある軌跡の原点が変わってしまう。
    if (!hotkeysHeld.has('marker')) movePointerWindowTo(window, x, y)

    keepPointerVisible(CLICK_RIPPLE_MS + POINTER_HIDE_MARGIN_MS)

    const bounds = window.getBounds()
    window.webContents.send(IPC.events.pointerClick, {
      x,
      y,
      originX: bounds.x,
      originY: bounds.y
    })
  }

  /**
   * 撮れたことを知らせる札を出す。
   *
   * ファインダーもメインウィンドウも画面に無いことがあるため、合図をこの窓へ集約する。
   * ただし逃げ場が無い場所へ出すと、札がそのまま録画映像へ写り込む。
   * 録画していなければ映像には残らないので、そのときだけ重なりを許す。
   */
  const showShotToast = (): void => {
    const window = toastWindow
    if (!window || window.isDestroyed()) return

    const placement = resolveToastPlacement(settings.profile)
    if (placement.overlapsTarget && engine?.state.status === 'recording') return

    window.setBounds(placement.bounds)
    window.showInactive()

    // 連写では出しっぱなしにせず、最後の 1 枚から数え直す。
    if (toastHideTimer) clearTimeout(toastHideTimer)
    toastHideTimer = setTimeout(() => {
      toastHideTimer = null
      if (!window.isDestroyed()) window.hide()
    }, SHOT_NOTICE_MS + TOAST_HIDE_MARGIN_MS)
  }

  const handlePressed = (action: HotkeyAction): void => {
    if (action === 'marker') {
      hotkeysHeld.add('marker')
      showPointer()
      return
    }

    if (action === 'toggleWindow') {
      const window = mainWindow
      if (!window || window.isDestroyed()) return
      if (window.isVisible() && !window.isMinimized()) window.hide()
      else {
        if (window.isMinimized()) window.restore()
        window.show()
        window.focus()
      }
      return
    }

    // 描き込みの開閉もウィンドウの操作なので Main で完結させる。
    if (action === 'toggleDrawing') {
      toggleDrawingWindow()
      return
    }

    sendToWindows(IPC.events.hotkeyTriggered, action)
  }

  /**
   * エンジンを起動してソースを組み立てる。
   * 起動時と、セットアップ完了直後の両方から同じ経路を通す。
   */
  const startEngine = async (): Promise<void> => {
    if (!engine) return
    await engine.initialize()

    try {
      await engine.applySource(settings.profile)
    } finally {
      /*
       * ソースの構築に失敗してもファインダーは出す。既定でメインウィンドウは最小化して
       * 起動するため、ここで出さないと画面に触れる場所がひとつも残らず、
       * 設定を直して立て直すこともできなくなる。
       * 範囲指定なら枠つき、それ以外は操作バーだけの姿で出る。
       */
      openFinder()
    }
  }

  /**
   * エンジンを立て直す。
   *
   * 起動の途中で失敗すると、接続だけ残った中途半端な状態になり得る。掛け直す前に
   * 必ず畳むのは、その残骸の上に組み直しても同じ場所で失敗するため。
   */
  const restartEngine = async (): Promise<void> => {
    if (!engine) return

    log.info('キャプチャエンジンを起動し直します')
    await engine.shutdown().catch((err) => log.warn('立て直しの前に畳めませんでした', err))
    await startEngine()
  }

  const context: IpcContext = {
    engine,
    getWindow: () => mainWindow,
    getSettings: () => settings,
    setSettings: (next) => {
      settings = next
      configureFileLogging(next.behavior.logToFile)
      hotkeys?.setConfig(next.hotkeys)
      applyBehavior(mainWindow, next.behavior)

      // 設定の書き換えはすべてここを通る。描き込み面も同じ範囲へ合わせ直す。
      updateDrawingArea(next.profile)
      refreshTray()
    },
    beginHotkeyCapture: () => hotkeys?.beginCapture(),
    cancelHotkeyCapture: () => hotkeys?.cancelCapture(),
    onRecordingStarted: () => {
      if (settings.behavior.minimizeOnRecord) mainWindow?.minimize()
    },
    onRegionSettled: (profile) => {
      const target = engine
      if (!target) return

      /*
       * 録画中はキャンバスの寸法を変えられないため、位置だけを追う道を通す。
       * 止まっているときは音声も重ね合わせも含めて普通に組み直してよい。
       */
      const recording = target.state.status === 'recording' || target.state.status === 'paused'
      const applied = recording ? target.followRegion(profile) : target.applySource(profile)
      applied.catch((err) => log.warn('録画範囲の変更を反映できませんでした', err))
    },
    onScreenshotSaved: (file) => {
      sendToWindows(IPC.events.screenshotSaved, file)
      showShotToast()
    },
    onIntervalState: (state) => {
      const started = state.active && !intervalState.active
      intervalState = state
      refreshTray()

      /*
       * 撮り始めた合図でウィンドウを退かせる。撮っている最中の画面に自分が写り込まないため。
       * ただし通知領域にアイコンが出ていないなら隠さない。呼び戻す手がかりが
       * ホットキーだけになり、割り当てを外している利用者は戻せなくなる。
       */
      const canHide = settings.profile.stillImage.interval.minimizeToTray && tray?.isPresent()
      if (started && canHide) hideToTray(mainWindow)
    },
    startEngine,
    restartEngine
  }

  releaseIpc = registerIpc(context)

  hotkeys = new HotkeyHook({
    onPressed: handlePressed,
    onReleased: (action) => {
      if (action === 'marker') {
        hotkeysHeld.delete('marker')
        hidePointer()
        return
      }
      sendToWindows(IPC.events.hotkeyReleased, action)
    },
    onCaptured: (binding) => sendToWindows(IPC.events.hotkeyCaptured, binding),
    onMouseMove: (x, y) => {
      const window = pointerWindow
      if (!window || window.isDestroyed() || !hotkeysHeld.has('marker')) return

      // 別のモニタへ移ったら窓ごと移す。
      movePointerWindowTo(window, x, y)
      const bounds = window.getBounds()

      // 画面座標のまま渡し、窓の左上も添える。窓がモニタを跨いだ瞬間に原点が変わるため、
      // 窓の中の座標で渡すと、受け取った側が溜めてある軌跡すべてがそこでずれる。
      window.webContents.send(IPC.events.pointerMove, {
        x,
        y,
        originX: bounds.x,
        originY: bounds.y
      })
    },
    onMouseClick: showClickRipple
  })
  hotkeys.setConfig(settings.hotkeys)
  hotkeys.start()

  // 押された瞬間に出せるよう、隠したまま先に用意しておく。
  pointerWindow = createPointerWindow()
  toastWindow = createToastWindow()

  // ファインダーが残っていると window-all-closed が発火せず、アプリが終了できなくなる。
  // メインウィンドウが閉じた時点で終了へ進め、後片付けは before-quit に任せる。
  mainWindow.on('closed', () => {
    mainWindow = null
    app.quit()
  })


  refreshTray()

  if (isEngineInstalled() && !isEngineOutdated()) {
    // OBS の起動には数秒かかる。UI は先に出し、状態は engineState イベントで追わせる。
    startEngine().catch((err) => log.error('キャプチャエンジンの初期化に失敗しました', err))
  } else if (isEngineBundled()) {
    /*
     * 同梱されたエンジンがあるなら、ボタンを押させずにその場で据える。
     * ネットワークにも配布元にも触れないので、押して待たせる意味がない。
     * 進捗は setupProgress で流れ、準備画面がそのまま経過を映す。
     */
    log.info('同梱されたキャプチャエンジンを配置します', { refresh: isEngineInstalled() })
    runInstall(context).catch((err) => log.error('キャプチャエンジンの配置に失敗しました', err))
  }
  // 同梱が無く未展開の場合は、Renderer が準備画面を出して取得を待つ。
}

app.whenReady().then(bootstrap).catch((err) => {
  log.error('アプリの起動に失敗しました', err)
  app.quit()
})

app.on('window-all-closed', () => {
  app.quit()
})

// 録画中の強制終了で壊れたファイルが残らないよう、OBS の終了を待ってからプロセスを畳む。
/** 押しっぱなしを追う。離すまで続く機能はこれを見る。 */
const hotkeysHeld = new Set<HotkeyAction>()

/** 薄れ切ってから窓を隠すまでの上乗せ分。描画の 1 フレームぶんの取りこぼしを防ぐ。 */
const POINTER_HIDE_MARGIN_MS = 200

/** 札が薄れ切ってから窓を隠すまでの上乗せ分。窓の消滅で消え際を断ち切らないため。 */
const TOAST_HIDE_MARGIN_MS = 200

let shuttingDown = false
app.on('before-quit', (event) => {
  if (shuttingDown || !engine) return
  event.preventDefault()
  shuttingDown = true

  hotkeys?.stop()
  releaseIpc?.()
  if (pointerHideTimer) {
    clearTimeout(pointerHideTimer)
    pointerHideTimer = null
  }
  if (pointerWindow && !pointerWindow.isDestroyed()) pointerWindow.destroy()
  pointerWindow = null

  if (toastHideTimer) {
    clearTimeout(toastHideTimer)
    toastHideTimer = null
  }
  if (toastWindow && !toastWindow.isDestroyed()) toastWindow.destroy()
  toastWindow = null

  tray?.destroy()
  tray = null

  engine
    .shutdown()
    .catch((err) => log.error('キャプチャエンジンの終了に失敗しました', err))
    .finally(() => app.quit())
})
