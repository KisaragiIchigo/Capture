import { create } from 'zustand'
import { isSameHotkey } from '@shared/types'
import { defaultRegion } from '@renderer/lib/region'
import type {
  AppSettings,
  CaptureSourceKind,
  HotkeyAction,
  HotkeyBinding,
  CaptureProfile,
  EngineState,
  RecordingResult,
  RecordingStats,
  RegionRect,
  SetupProgress,
  SystemCapabilities,
  WindowSource
} from '@shared/types'

const SETTINGS_SAVE_DEBOUNCE_MS = 400

interface CaptureStore {
  settings: AppSettings | null
  capabilities: SystemCapabilities | null
  windows: WindowSource[]
  engine: EngineState
  stats: RecordingStats | null
  lastResult: RecordingResult | null
  /** 直近の操作失敗。UI 上部のバナーへ出し、次の操作成功で消す。 */
  error: string | null
  /** 定期キャプチャーが動作中かどうか。設定ではなく実行状態なので保存しない。 */
  intervalActive: boolean
  /** 今回の定期キャプチャーで保存できた枚数。開始のたびに 0 から数え直す。 */
  intervalShots: number
  /** 範囲指定ファインダーが開いているかどうか。 */
  finderVisible: boolean
  /** 画面へ描き込む窓が開いているかどうか。 */
  drawingVisible: boolean
  /** キャプチャエンジンが展開済みかどうか。null は確認前。 */
  engineInstalled: boolean | null
  /** エンジンがこのビルドに同梱されているかどうか。準備画面の案内が変わる。 */
  engineBundled: boolean
  setupProgress: SetupProgress

  bootstrap: () => Promise<void>
  /** エンジンが動き出してから、この PC の能力を取り直す。 */
  refreshCapabilities: () => Promise<void>
  refreshWindows: () => Promise<void>
  updateProfile: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  /** キャプチャモードを切り替え、そのモードに必要な値を同時に確定させる。 */
  setSourceKind: (kind: CaptureSourceKind) => void
  updateSettings: (patch: (settings: AppSettings) => AppSettings) => void
  updateHotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void
  pickOutputDirectory: () => Promise<void>
  pickLogoFile: () => Promise<void>

  /** エンジンの起動に失敗した状態から立て直す。 */
  restartEngine: () => Promise<void>
  /** 立て直しの最中かどうか。押しっぱなしで何度も走らせないために持つ。 */
  engineRestarting: boolean

  startRecording: () => Promise<void>
  stopRecording: () => Promise<void>
  togglePause: () => Promise<void>
  takeScreenshot: () => Promise<void>
  /** 定期キャプチャーを開始 / 停止する。設定で無効なら何もしない。 */
  toggleIntervalCapture: () => void
  setIntervalActive: (active: boolean) => void
  /** 1 枚保存できたことを数える。上限の判定は実行役の hook が行う。 */
  noteIntervalShot: () => void
  setFinderVisible: (visible: boolean) => void
  setDrawingVisible: (visible: boolean) => void
  toggleDrawing: () => void
  setSetupProgress: (progress: SetupProgress) => void
  installEngine: () => Promise<void>
  cancelInstall: () => Promise<void>
  /** ファインダーの移動で変わった範囲を、保存せずに表示だけ合わせる。 */
  applyExternalRegion: (region: RegionRect) => void
  toggleFinder: () => void

  /** 他の窓で書き換えられた設定を取り込む。保存し直さないので往復しない。 */
  adoptSettings: (settings: AppSettings) => void

  setEngineState: (state: EngineState) => void
  setStats: (stats: RecordingStats) => void
  setResult: (result: RecordingResult) => void
  clearError: () => void
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 保留中の保存を取り消し、その場で書き込む。
 *
 * Main 側は自分が持つ設定を見て窓を組み立てる。デバウンスの完了を待ってから
 * 組み立てを頼まないと、1 回ぶん古い内容で作られる。
 */
async function saveNow(settings: AppSettings): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  await window.capture.settings.save(settings)
}

/** 設定はスライダー操作のたびに変わるため、まとめてから 1 度だけ保存する。 */
function scheduleSave(settings: AppSettings): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void window.capture.settings.save(settings)
    saveTimer = null
  }, SETTINGS_SAVE_DEBOUNCE_MS)
}

function toMessage(err: unknown): string {
  if (err instanceof Error) {
    // Electron は IPC の例外を "Error invoking remote method '...': Error: 本文" に包む。
    const match = /Error:\s*(.+)$/.exec(err.message)
    return match?.[1] ?? err.message
  }
  return '不明なエラーが発生しました。'
}

export const useCaptureStore = create<CaptureStore>((set, get) => ({
  settings: null,
  capabilities: null,
  windows: [],
  engine: { status: 'idle', backendVersion: null, message: null },
  stats: null,
  lastResult: null,
  error: null,
  intervalActive: false,
  intervalShots: 0,
  finderVisible: false,
  drawingVisible: false,
  engineInstalled: null,
  engineBundled: false,
  engineRestarting: false,
  setupProgress: { phase: 'idle', receivedBytes: 0, totalBytes: 0, ratio: 0, message: null },

  bootstrap: async () => {
    const settings = await window.capture.settings.load()
    set({ settings })

    // エンジンが未展開なら準備画面を出す。能力の取得はここでは行わない。
    // 起動直後はまだ OBS が立ち上がっておらず、聞いても必ず失敗するため。
    const setup = await window.capture.setup.getState()
    set({ engineInstalled: setup.installed, engineBundled: setup.bundled })

    /*
     * 同梱されたエンジンがある場合、Main はこの窓が出るより先に配置を始めている。
     * 進んでいる事実だけを先に映しておかないと、実際は動いているのに
     * 「エンジンを準備する」ボタンが押せる状態で出てしまう。実際の段階はすぐ通知で届く。
     */
    if (setup.installing) {
      set({
        setupProgress: { phase: 'copying', receivedBytes: 0, totalBytes: 0, ratio: 0, message: null }
      })
    }
  },

  refreshCapabilities: async () => {
    const settings = get().settings
    if (!settings) return

    try {
      const capabilities = await window.capture.capture.getCapabilities()
      set({ capabilities, error: null })

      // モニタ未選択のままでは録画を始められないので、主モニタへ寄せておく。
      const needsMonitor =
        settings.profile.sourceId === null &&
        (settings.profile.sourceKind === 'display' || settings.profile.sourceKind === 'region')
      if (needsMonitor) {
        const primary =
          capabilities.displays.find((display) => display.isPrimary) ?? capabilities.displays[0]
        if (primary) get().updateProfile((profile) => ({ ...profile, sourceId: primary.id }))
      }
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  refreshWindows: async () => {
    try {
      set({ windows: await window.capture.capture.listWindows() })
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  updateProfile: (patch) => {
    const current = get().settings
    if (!current) return
    const next: AppSettings = { ...current, profile: patch(current.profile) }
    set({ settings: next })
    scheduleSave(next)
  },

  setSourceKind: (kind) => {
    const { settings: current, capabilities, finderVisible } = get()
    if (!current || current.profile.sourceKind === kind) return

    const displays = capabilities?.displays ?? []

    // 種別が変われば sourceId の意味も変わる。持ち越すと別のものを掴む。
    const profile: CaptureProfile = { ...current.profile, sourceKind: kind, sourceId: null }

    if (kind === 'display' || kind === 'region') {
      const primary = displays.find((display) => display.isPrimary) ?? displays[0]
      profile.sourceId = primary?.id ?? null
    }

    // 表示だけ既定値で埋めて実体が null のままだと、情報バーと食い違う。ここで確定させる。
    if (kind === 'region' && !profile.region) profile.region = defaultRegion(displays)

    const next: AppSettings = { ...current, profile }
    set({ settings: next })

    /*
     * ファインダーの姿は Main が持つ設定から決まる。範囲指定なら枠つき、それ以外は操作バーだけ。
     * 保存を待たずに開き直すと、Main はまだ 1 つ前の種別を持っているため古い姿で組み立てる。
     * 「2 回選ばないと切り替わらない」のはこれが原因なので、書き込みを終えてから作り直す。
     */
    void saveNow(next)
      .then(() => window.capture.finder.close())
      .then(() => (finderVisible ? window.capture.finder.open() : undefined))
      .catch(() => undefined)
  },

  updateSettings: (patch) => {
    const current = get().settings
    if (!current) return
    const next = patch(current)
    set({ settings: next })
    scheduleSave(next)
  },

  updateHotkey: (action, binding) => {
    get().updateSettings((current) => {
      const hotkeys = { ...current.hotkeys }

      // 同じ入力が別の操作に残っていると、どちらが働くか分からなくなる。
      // 新しく割り当てた側を優先し、古い側は解除する。
      if (binding) {
        for (const key of Object.keys(hotkeys) as HotkeyAction[]) {
          if (key !== action && isSameHotkey(hotkeys[key], binding)) hotkeys[key] = null
        }
      }

      hotkeys[action] = binding
      return { ...current, hotkeys }
    })
  },

  pickOutputDirectory: async () => {
    const directory = await window.capture.settings.pickOutputDirectory()
    if (!directory) return
    get().updateProfile((profile) => ({ ...profile, outputDirectory: directory }))
  },

  pickLogoFile: async () => {
    const filePath = await window.capture.settings.pickImageFile()
    if (!filePath) return
    get().updateProfile((profile) => ({
      ...profile,
      overlays: { ...profile.overlays, logo: { ...profile.overlays.logo, filePath } }
    }))
  },

  restartEngine: async () => {
    if (get().engineRestarting) return

    set({ engineRestarting: true, error: null })
    try {
      await window.capture.capture.restartEngine()
    } catch (err) {
      set({ error: toMessage(err) })
    } finally {
      set({ engineRestarting: false })
    }
  },

  startRecording: async () => {
    const settings = get().settings
    if (!settings) return
    try {
      await window.capture.capture.start(settings.profile)
      set({ error: null, lastResult: null })
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  stopRecording: async () => {
    try {
      const result = await window.capture.capture.stop()
      set({ error: null, stats: null, ...(result ? { lastResult: result } : {}) })
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  togglePause: async () => {
    const { engine } = get()
    try {
      if (engine.status === 'paused') await window.capture.capture.resume()
      else if (engine.status === 'recording') await window.capture.capture.pause()
      set({ error: null })
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  takeScreenshot: async () => {
    try {
      await window.capture.capture.screenshot()
      set({ error: null })
    } catch (err) {
      set({ error: toMessage(err) })
    }
  },

  toggleIntervalCapture: () => {
    const { settings, intervalActive } = get()

    // 設定で無効にしたままボタンやホットキーで始められると、いつ撮られるか読めなくなる。
    if (!settings?.profile.stillImage.interval.enabled) return
    get().setIntervalActive(!intervalActive)
  },

  // 開始のたびに枚数を数え直す。前回の続きから数えると上限の意味が変わってしまう。
  setIntervalActive: (intervalActive) =>
    set(intervalActive ? { intervalActive, intervalShots: 0 } : { intervalActive }),

  noteIntervalShot: () => set((state) => ({ intervalShots: state.intervalShots + 1 })),
  setFinderVisible: (finderVisible) => set({ finderVisible }),
  setDrawingVisible: (drawingVisible) => set({ drawingVisible }),

  // 開閉の判断は Main が持つ。こちらの状態で切り替えると通知の行き違いで噛み合わなくなる。
  toggleDrawing: () => void window.capture.drawing.toggle(),

  setSetupProgress: (setupProgress) => {
    set({ setupProgress })
    // 展開が終われば録画画面へ切り替える。能力はエンジンが立ってから取り直す。
    if (setupProgress.phase === 'done') set({ engineInstalled: true })
  },

  installEngine: async () => {
    set({
      setupProgress: { phase: 'resolving', receivedBytes: 0, totalBytes: 0, ratio: 0, message: null }
    })
    await window.capture.setup.install()
  },

  cancelInstall: async () => {
    await window.capture.setup.cancel()
  },

  applyExternalRegion: (region) => {
    // Main 側が既に保存まで済ませている。ここで書き戻すと往復して発振する。
    const current = get().settings
    if (!current) return
    set({ settings: { ...current, profile: { ...current.profile, region } } })
  },

  toggleFinder: () => {
    if (get().finderVisible) void window.capture.finder.close()
    else void window.capture.finder.open()
  },

  adoptSettings: (settings) => set({ settings }),

  setEngineState: (state) => set({ engine: state }),
  setStats: (stats) => set({ stats }),
  setResult: (result) => set({ lastResult: result }),
  // エンジン由来のメッセージも一緒に消さないと、バナーを閉じても出続けてしまう。
  clearError: () => set((state) => ({ error: null, engine: { ...state.engine, message: null } }))
}))
