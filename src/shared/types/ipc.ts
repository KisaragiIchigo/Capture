import type { WindowBounds } from './finder'
import type { HotkeyAction, HotkeyBinding } from './hotkey'
import type {
  CaptureProfile,
  CaptureSourceKind,
  EngineState,
  IntervalCaptureState,
  RegionRect,
  RecordingResult,
  RecordingStats,
  SetupProgress,
  SystemCapabilities,
  WindowSource
} from './capture'
import type { PointerMovePayload, PointerOrigin } from './pointer'
import type { AppSettings } from './settings'

/**
 * Renderer から Main への要求（invoke）と、Main から Renderer への通知（on）を
 * それぞれ 1 箇所で列挙する。preload の contextBridge はこの型だけを公開する。
 */
export const IPC = {
  capture: {
    getCapabilities: 'capture:getCapabilities',
    listWindows: 'capture:listWindows',
    start: 'capture:start',
    stop: 'capture:stop',
    pause: 'capture:pause',
    resume: 'capture:resume',
    screenshot: 'capture:screenshot',
    restartEngine: 'capture:restartEngine'
  },
  settings: {
    load: 'settings:load',
    save: 'settings:save',
    pickOutputDirectory: 'settings:pickOutputDirectory',
    pickImageFile: 'settings:pickImageFile',
    beginHotkeyCapture: 'settings:beginHotkeyCapture',
    cancelHotkeyCapture: 'settings:cancelHotkeyCapture'
  },
  intervalCapture: {
    report: 'intervalCapture:report'
  },
  setup: {
    getState: 'setup:getState',
    install: 'setup:install',
    cancel: 'setup:cancel'
  },
  drawing: {
    open: 'drawing:open',
    close: 'drawing:close',
    toggle: 'drawing:toggle'
  },
  finder: {
    open: 'finder:open',
    close: 'finder:close',
    setBounds: 'finder:setBounds',
    setIgnoreMouse: 'finder:setIgnoreMouse'
  },
  window: {
    show: 'window:show',
    toggle: 'window:toggle',
    minimize: 'window:minimize',
    toggleMaximize: 'window:toggleMaximize',
    close: 'window:close',
    quit: 'window:quit'
  },
  system: {
    openPath: 'system:openPath',
    revealInExplorer: 'system:revealInExplorer',
    openLogFolder: 'system:openLogFolder',
    getAppInfo: 'system:getAppInfo'
  },
  events: {
    engineState: 'event:engineState',
    recordingStats: 'event:recordingStats',
    recordingFinished: 'event:recordingFinished',
    screenshotSaved: 'event:screenshotSaved',
    settingsChanged: 'event:settingsChanged',
    hotkeyTriggered: 'event:hotkeyTriggered',
    hotkeyReleased: 'event:hotkeyReleased',
    hotkeyCaptured: 'event:hotkeyCaptured',
    setupProgress: 'event:setupProgress',
    regionChanged: 'event:regionChanged',
    finderVisibility: 'event:finderVisibility',
    finderMode: 'event:finderMode',
    drawingVisibility: 'event:drawingVisibility',
    pointerStart: 'event:pointerStart',
    pointerMove: 'event:pointerMove',
    pointerClick: 'event:pointerClick',
    pointerEnd: 'event:pointerEnd'
  }
} as const

export interface SetupState {
  installed: boolean
  /** 取得と展開が進行中かどうか。 */
  installing: boolean
  /** エンジンがこのビルドに同梱されているかどうか。導入にネットワークが要るかが変わる。 */
  bundled: boolean
}

export interface AppInfo {
  version: string
  electronVersion: string
  platform: string
}

/** contextBridge で Renderer に露出する API の形。 */
export interface CaptureBridge {
  capture: {
    getCapabilities: () => Promise<SystemCapabilities>
    listWindows: () => Promise<WindowSource[]>
    start: (profile: CaptureProfile) => Promise<void>
    stop: () => Promise<RecordingResult | null>
    pause: () => Promise<void>
    resume: () => Promise<void>
    screenshot: () => Promise<string>
    /**
     * キャプチャエンジンを立て直す。
     *
     * 起動に失敗したままだと、以降どの操作も通らない。アプリごと再起動させずに
     * やり直せる道を 1 本持たせる。
     */
    restartEngine: () => Promise<void>
  }
  settings: {
    load: () => Promise<AppSettings>
    save: (settings: AppSettings) => Promise<void>
    pickOutputDirectory: () => Promise<string | null>
    /** オーバーレイに重ねる画像を選ぶ。取り消した場合は null。 */
    pickImageFile: () => Promise<string | null>
    /** 次の入力を割り当てとして捕まえる。結果は hotkeyCaptured で届く。 */
    beginHotkeyCapture: () => Promise<void>
    cancelHotkeyCapture: () => Promise<void>
  }
  intervalCapture: {
    /**
     * 定期キャプチャーの実行状況を Main へ知らせる。
     *
     * 実行状態そのものは Renderer が持つ。通知領域のアイコンと、撮影開始に伴う
     * ウィンドウの引っ込めは Main にしかできないため、事実だけをここで渡す。
     */
    report: (state: IntervalCaptureState) => Promise<void>
  }
  setup: {
    /** キャプチャエンジンが展開済みかどうか。 */
    getState: () => Promise<SetupState>
    /** 取得と展開を開始する。進捗は setupProgress イベントで届く。 */
    install: () => Promise<void>
    cancel: () => Promise<void>
  }
  drawing: {
    /** 画面へ描き込む窓を開く。 */
    open: () => Promise<void>
    close: () => Promise<void>
    /** 開いていれば閉じ、閉じていれば開く。判断は Main が行う。 */
    toggle: () => Promise<void>
  }
  finder: {
    /** 範囲指定ファインダーを開く。すでに開いていれば前面へ出す。 */
    open: () => Promise<void>
    close: () => Promise<void>
    /** ファインダー自身が自分のウィンドウ位置とサイズを更新する。 */
    setBounds: (bounds: WindowBounds) => Promise<void>
    /**
     * 透過部分をクリックスルーさせるかどうか。
     * 操作できる要素の上にカーソルが来たときだけ false にする。
     */
    setIgnoreMouse: (ignore: boolean) => Promise<void>
  }
  window: {
    /** 最小化や非表示から呼び戻して前面に出す。 */
    show: () => Promise<void>
    /** 出ていれば引っ込め、隠れていれば出す。 */
    toggle: () => Promise<void>
    minimize: () => Promise<void>
    toggleMaximize: () => Promise<void>
    close: () => Promise<void>
    /**
     * アプリごと終了する。
     *
     * メインウィンドウを閉じても結果として終了するが、ファインダーから
     * 「メインウィンドウを閉じる」を呼んで終了を期待するのは意図が読めない。
     * 終わらせたいときは終わらせると書ける口を分けて持つ。
     */
    quit: () => Promise<void>
  }
  system: {
    openPath: (target: string) => Promise<void>
    revealInExplorer: (target: string) => Promise<void>
    /**
     * 動作ログのフォルダを開く。
     *
     * 準備に失敗したとき、画面のメッセージだけでは原因まで辿れないことがある。
     * 何が起きたかを持ち出せる場所を、失敗した画面から 1 手で開けるようにする。
     */
    openLogFolder: () => Promise<void>
    getAppInfo: () => Promise<AppInfo>
  }
  events: {
    onEngineState: (listener: (state: EngineState) => void) => () => void
    onRecordingStats: (listener: (stats: RecordingStats) => void) => () => void
    onRecordingFinished: (listener: (result: RecordingResult) => void) => () => void
    /**
     * 静止画を保存し終えた。保存先のフルパスが届く。
     *
     * 撮影の起点はホットキー・メインウィンドウ・ファインダーのバーと複数あるため、
     * 起点側の戻り値ではなくこの通知を「撮れた」の唯一の情報源にする。
     */
    onScreenshotSaved: (listener: (file: string) => void) => () => void
    /**
     * 設定が保存された。書き換えた窓以外へ届く。
     *
     * 操作の入口はメインウィンドウとファインダーの操作バーの 2 つある。
     * 片方で切り替えたものがもう片方に映らないと、同じ設定が 2 つの姿で見えてしまう。
     */
    onSettingsChanged: (listener: (settings: AppSettings) => void) => () => void
    onHotkey: (listener: (action: HotkeyAction) => void) => () => void
    /** 押している間だけ働く機能のための解放通知。 */
    onHotkeyReleased: (listener: (action: HotkeyAction) => void) => () => void
    /** 記録中に捕まえた割り当て。 */
    onHotkeyCaptured: (listener: (binding: HotkeyBinding) => void) => () => void
    onSetupProgress: (listener: (progress: SetupProgress) => void) => () => void
    /** ファインダーの移動 / リサイズで録画範囲が変わったときに届く。 */
    onRegionChanged: (listener: (region: RegionRect) => void) => () => void
    /** ファインダーの開閉。UI のトグル表示を合わせるために使う。 */
    onFinderVisibility: (listener: (visible: boolean) => void) => () => void
    /** ファインダーが今どの取り込み方に付いているか。枠を描くかどうかがこれで決まる。 */
    onFinderMode: (listener: (kind: CaptureSourceKind) => void) => () => void
    onDrawingVisibility: (listener: (visible: boolean) => void) => () => void
    /** レーザーポインターの表示が始まった。そのときの窓の左上が届く。 */
    onPointerStart: (listener: (origin: PointerOrigin) => void) => () => void
    /** 表示中のマウス位置。画面座標と、そのときの窓の左上が届く。 */
    onPointerMove: (listener: (point: PointerMovePayload) => void) => () => void
    onPointerEnd: (listener: () => void) => () => void
    /**
     * マウスのボタンが押された。押した位置に波紋を出す。
     *
     * 録画にマウスカーソルを含める設定のときだけ届く。カーソルが映らない録画で
     * 波紋だけが出ると、何も無い場所で輪が広がることになる。
     */
    onPointerClick: (listener: (point: PointerMovePayload) => void) => () => void
  }
}
