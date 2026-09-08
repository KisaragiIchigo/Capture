import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import {
  IPC,
  type AppInfo,
  type AppSettings,
  type CaptureBridge,
  type CaptureProfile,
  type CaptureSourceKind,
  type DrawingCommand,
  type EngineState,
  type HotkeyAction,
  type HotkeyBinding,
  type IntervalCaptureState,
  type LogInfo,
  type PointerMovePayload,
  type PointerOrigin,
  type RecordingResult,
  type RecordingStats,
  type RegionRect,
  type SetupProgress,
  type SetupState,
  type SystemCapabilities,
  type WindowSource
} from '@shared/types'

/**
 * Renderer へ露出する唯一の口。
 *
 * ipcRenderer をそのまま渡すと任意チャンネルを叩けてしまうため、
 * CaptureBridge に列挙した操作だけを関数として公開する。
 * 各 on* は解除関数を返す。React 側は必ず useEffect のクリーンアップで呼ぶこと。
 */
function subscribe<T>(channel: string, listener: (payload: T) => void): () => void {
  const handler = (_event: IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, handler)
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

const bridge: CaptureBridge = {
  capture: {
    getCapabilities: () =>
      ipcRenderer.invoke(IPC.capture.getCapabilities) as Promise<SystemCapabilities>,
    listWindows: () => ipcRenderer.invoke(IPC.capture.listWindows) as Promise<WindowSource[]>,
    start: (profile: CaptureProfile) =>
      ipcRenderer.invoke(IPC.capture.start, profile) as Promise<void>,
    stop: () => ipcRenderer.invoke(IPC.capture.stop) as Promise<RecordingResult | null>,
    pause: () => ipcRenderer.invoke(IPC.capture.pause) as Promise<void>,
    resume: () => ipcRenderer.invoke(IPC.capture.resume) as Promise<void>,
    screenshot: () => ipcRenderer.invoke(IPC.capture.screenshot) as Promise<string>,
    restartEngine: () => ipcRenderer.invoke(IPC.capture.restartEngine) as Promise<void>
  },
  settings: {
    load: () => ipcRenderer.invoke(IPC.settings.load) as Promise<AppSettings>,
    save: (settings: AppSettings) =>
      ipcRenderer.invoke(IPC.settings.save, settings) as Promise<void>,
    pickOutputDirectory: () =>
      ipcRenderer.invoke(IPC.settings.pickOutputDirectory) as Promise<string | null>,
    pickImageFile: () =>
      ipcRenderer.invoke(IPC.settings.pickImageFile) as Promise<string | null>,
    beginHotkeyCapture: () =>
      ipcRenderer.invoke(IPC.settings.beginHotkeyCapture) as Promise<void>,
    cancelHotkeyCapture: () =>
      ipcRenderer.invoke(IPC.settings.cancelHotkeyCapture) as Promise<void>
  },
  intervalCapture: {
    report: (state: IntervalCaptureState) =>
      ipcRenderer.invoke(IPC.intervalCapture.report, state) as Promise<void>
  },
  setup: {
    getState: () => ipcRenderer.invoke(IPC.setup.getState) as Promise<SetupState>,
    install: () => ipcRenderer.invoke(IPC.setup.install) as Promise<void>,
    cancel: () => ipcRenderer.invoke(IPC.setup.cancel) as Promise<void>
  },
  drawing: {
    open: () => ipcRenderer.invoke(IPC.drawing.open) as Promise<void>,
    close: () => ipcRenderer.invoke(IPC.drawing.close) as Promise<void>,
    toggle: () => ipcRenderer.invoke(IPC.drawing.toggle) as Promise<void>,
    command: (command) => ipcRenderer.invoke(IPC.drawing.command, command) as Promise<void>,
    paletteReady: (height: number) =>
      ipcRenderer.invoke(IPC.drawing.paletteReady, height) as Promise<void>
  },
  finder: {
    open: () => ipcRenderer.invoke(IPC.finder.open) as Promise<void>,
    close: () => ipcRenderer.invoke(IPC.finder.close) as Promise<void>,
    setBounds: (bounds) => ipcRenderer.invoke(IPC.finder.setBounds, bounds) as Promise<void>,
    setIgnoreMouse: (ignore: boolean) =>
      ipcRenderer.invoke(IPC.finder.setIgnoreMouse, ignore) as Promise<void>
  },
  window: {
    show: () => ipcRenderer.invoke(IPC.window.show) as Promise<void>,
    toggle: () => ipcRenderer.invoke(IPC.window.toggle) as Promise<void>,
    minimize: () => ipcRenderer.invoke(IPC.window.minimize) as Promise<void>,
    toggleMaximize: () => ipcRenderer.invoke(IPC.window.toggleMaximize) as Promise<void>,
    close: () => ipcRenderer.invoke(IPC.window.close) as Promise<void>,
    quit: () => ipcRenderer.invoke(IPC.window.quit) as Promise<void>
  },
  system: {
    openPath: (target: string) => ipcRenderer.invoke(IPC.system.openPath, target) as Promise<void>,
    revealInExplorer: (target: string) =>
      ipcRenderer.invoke(IPC.system.revealInExplorer, target) as Promise<void>,
    openLogFolder: () => ipcRenderer.invoke(IPC.system.openLogFolder) as Promise<void>,
    getLogInfo: () => ipcRenderer.invoke(IPC.system.getLogInfo) as Promise<LogInfo>,
    clearLogs: () => ipcRenderer.invoke(IPC.system.clearLogs) as Promise<void>,
    getAppInfo: () => ipcRenderer.invoke(IPC.system.getAppInfo) as Promise<AppInfo>,
    openExternal: (url: string) =>
      ipcRenderer.invoke(IPC.system.openExternal, url) as Promise<void>
  },
  events: {
    onEngineState: (listener) => subscribe<EngineState>(IPC.events.engineState, listener),
    onRecordingStats: (listener) => subscribe<RecordingStats>(IPC.events.recordingStats, listener),
    onRecordingFinished: (listener) =>
      subscribe<RecordingResult>(IPC.events.recordingFinished, listener),
    onScreenshotSaved: (listener) => subscribe<string>(IPC.events.screenshotSaved, listener),
    onSettingsChanged: (listener) => subscribe<AppSettings>(IPC.events.settingsChanged, listener),
    onHotkey: (listener) => subscribe<HotkeyAction>(IPC.events.hotkeyTriggered, listener),
    onHotkeyReleased: (listener) => subscribe<HotkeyAction>(IPC.events.hotkeyReleased, listener),
    onHotkeyCaptured: (listener) => subscribe<HotkeyBinding>(IPC.events.hotkeyCaptured, listener),
    onSetupProgress: (listener) => subscribe<SetupProgress>(IPC.events.setupProgress, listener),
    onRegionChanged: (listener) => subscribe<RegionRect>(IPC.events.regionChanged, listener),
    onFinderVisibility: (listener) => subscribe<boolean>(IPC.events.finderVisibility, listener),
    onFinderMode: (listener) => subscribe<CaptureSourceKind>(IPC.events.finderMode, listener),
    onDrawingVisibility: (listener) => subscribe<boolean>(IPC.events.drawingVisibility, listener),
    onDrawingCommand: (listener) => subscribe<DrawingCommand>(IPC.events.drawingCommand, listener),
    onPointerStart: (listener) => subscribe<PointerOrigin>(IPC.events.pointerStart, listener),
    onPointerMove: (listener) => subscribe<PointerMovePayload>(IPC.events.pointerMove, listener),
    onPointerEnd: (listener) => subscribe<void>(IPC.events.pointerEnd, () => listener()),
    onPointerClick: (listener) => subscribe<PointerMovePayload>(IPC.events.pointerClick, listener)
  }
}

contextBridge.exposeInMainWorld('capture', bridge)
