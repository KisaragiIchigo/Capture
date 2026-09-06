import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { useCaptureStore } from '@renderer/store/useCaptureStore'
import { useEngineEvents } from '@renderer/hooks/useEngineEvents'
import { useHotkeyActions } from '@renderer/hooks/useHotkeyActions'
import { useAutoStop } from '@renderer/hooks/useAutoStop'
import { useIntervalCapture } from '@renderer/hooks/useIntervalCapture'
import { useIntervalReport } from '@renderer/hooks/useIntervalReport'
import { useShutterFlash } from '@renderer/hooks/useShutterFlash'
import { TitleBar } from '@renderer/components/TitleBar'
import { ToolBar } from '@renderer/components/ToolBar'
import { InfoBar } from '@renderer/components/InfoBar'
import { SideNav, type PageKey } from '@renderer/components/SideNav'
import { StatusBar } from '@renderer/components/StatusBar'
import { ErrorBanner } from '@renderer/components/ErrorBanner'
import { HelpDialog } from '@renderer/components/HelpDialog'
import { SetupScreen } from '@renderer/components/SetupScreen'
import { HomePage } from '@renderer/components/pages/HomePage'
import { GeneralPage } from '@renderer/components/pages/GeneralPage'
import { VideoPage } from '@renderer/components/pages/VideoPage'
import { OverlayPage } from '@renderer/components/pages/OverlayPage'
import { StillPage } from '@renderer/components/pages/StillPage'
import { AboutPage } from '@renderer/components/pages/AboutPage'

/**
 * 画面全体の組み立て。
 *
 * 状態の出どころは store、副作用は hooks に閉じてあるので、ここは配置と受け渡しに専念する。
 * 判断はひとつだけ持つ ── 録画中は設定を触らせない、という不変条件をここで一元的に決める。
 */
export function App(): ReactElement {
  const settings = useCaptureStore((state) => state.settings)
  const capabilities = useCaptureStore((state) => state.capabilities)
  const windows = useCaptureStore((state) => state.windows)
  const engine = useCaptureStore((state) => state.engine)
  const stats = useCaptureStore((state) => state.stats)
  const lastResult = useCaptureStore((state) => state.lastResult)
  const error = useCaptureStore((state) => state.error)
  const intervalActive = useCaptureStore((state) => state.intervalActive)
  const intervalShots = useCaptureStore((state) => state.intervalShots)
  const finderVisible = useCaptureStore((state) => state.finderVisible)
  const drawingVisible = useCaptureStore((state) => state.drawingVisible)
  const engineInstalled = useCaptureStore((state) => state.engineInstalled)
  const engineBundled = useCaptureStore((state) => state.engineBundled)
  const setupProgress = useCaptureStore((state) => state.setupProgress)

  const bootstrap = useCaptureStore((state) => state.bootstrap)
  const refreshCapabilities = useCaptureStore((state) => state.refreshCapabilities)
  const refreshWindows = useCaptureStore((state) => state.refreshWindows)
  const updateProfile = useCaptureStore((state) => state.updateProfile)
  const setSourceKind = useCaptureStore((state) => state.setSourceKind)
  const toggleFinder = useCaptureStore((state) => state.toggleFinder)
  const toggleDrawing = useCaptureStore((state) => state.toggleDrawing)
  const updateSettings = useCaptureStore((state) => state.updateSettings)
  const updateHotkey = useCaptureStore((state) => state.updateHotkey)
  const pickOutputDirectory = useCaptureStore((state) => state.pickOutputDirectory)
  const pickLogoFile = useCaptureStore((state) => state.pickLogoFile)
  const startRecording = useCaptureStore((state) => state.startRecording)
  const stopRecording = useCaptureStore((state) => state.stopRecording)
  const togglePause = useCaptureStore((state) => state.togglePause)
  const takeScreenshot = useCaptureStore((state) => state.takeScreenshot)
  const toggleIntervalCapture = useCaptureStore((state) => state.toggleIntervalCapture)
  const clearError = useCaptureStore((state) => state.clearError)
  const restartEngine = useCaptureStore((state) => state.restartEngine)
  const engineRestarting = useCaptureStore((state) => state.engineRestarting)
  const installEngine = useCaptureStore((state) => state.installEngine)
  const cancelInstall = useCaptureStore((state) => state.cancelInstall)

  const [page, setPage] = useState<PageKey>('home')
  const [helpOpen, setHelpOpen] = useState(false)

  useEngineEvents()
  useHotkeyActions()
  useAutoStop()
  useIntervalCapture()
  useIntervalReport()

  const shutter = useShutterFlash()

  useEffect(() => {
    void bootstrap()
  }, [bootstrap])

  useEffect(() => {
    // エンジンが起動しきってから能力を取る。それより前に聞くと必ず失敗する。
    if (engine.status === 'ready' && !capabilities) void refreshCapabilities()
  }, [engine.status, capabilities, refreshCapabilities])

  // HomePage の useEffect の依存に載るため、参照を固定する。
  // 毎レンダー新しい関数を渡すと一覧取得が際限なく走る。
  const handleRefreshWindows = useCallback(() => {
    void refreshWindows()
  }, [refreshWindows])

  const isActive = engine.status === 'recording' || engine.status === 'paused'

  const handleToggleRecording = useCallback(() => {
    if (isActive) void stopRecording()
    else void startRecording()
  }, [isActive, startRecording, stopRecording])

  if (!settings) {
    return (
      <div className="flex h-full flex-col bg-base">
        <TitleBar engine={engine} onOpenHelp={() => setHelpOpen(true)} />
        <div className="flex flex-1 items-center justify-center">
          <span className="text-fluid-sm text-slate-400">設定を読み込んでいます…</span>
        </div>
      </div>
    )
  }

  // エンジンが無ければ録画設定はすべて意味を持たない。用意できるまでここへ集中させる。
  if (engineInstalled === false) {
    const installing =
      setupProgress.phase !== 'idle' &&
      setupProgress.phase !== 'error' &&
      setupProgress.phase !== 'done'

    return (
      <div className="flex h-full flex-col bg-base">
        <TitleBar engine={engine} onOpenHelp={() => setHelpOpen(true)} />
        <SetupScreen
          progress={setupProgress}
          installing={installing}
          bundled={engineBundled}
          onInstall={() => void installEngine()}
          onCancel={() => void cancelInstall()}
          onOpenLogFolder={() => void window.capture.system.openLogFolder()}
        />
      </div>
    )
  }

  // 設定の変更が録画中の出力に反映されない以上、触れないようにするのが唯一の正しい振る舞い。
  const settingsLocked = isActive

  return (
    <div className="flex h-full flex-col bg-base">
      <TitleBar engine={engine} onOpenHelp={() => setHelpOpen(true)} />

      <ToolBar
        profile={settings.profile}
        engine={engine}
        onChangeProfile={updateProfile}
        onChangeSourceKind={setSourceKind}
        finderVisible={finderVisible}
        onToggleFinder={toggleFinder}
        drawingVisible={drawingVisible}
        onToggleDrawing={toggleDrawing}
        onToggleRecording={handleToggleRecording}
        onTogglePause={() => void togglePause()}
        onScreenshot={() => void takeScreenshot()}
        intervalActive={intervalActive}
        onToggleInterval={toggleIntervalCapture}
        shutter={shutter}
      />

      <InfoBar
        profile={settings.profile}
        displays={capabilities?.displays ?? []}
        windows={windows}
        engine={engine}
        stats={stats}
      />

      {/*
        エンジンが立っていないときの失敗は、閉じても何も変わらない。
        立て直せる状況にあるときだけ、その場でやり直せるようにする。
      */}
      <ErrorBanner
        message={error ?? engine.message}
        onRetry={engine.status === 'error' || engine.status === 'idle' ? () => void restartEngine() : undefined}
        retrying={engineRestarting}
        onDismiss={clearError}
      />

      <div className="flex min-h-0 flex-1">
        <SideNav value={page} onChange={setPage} />

        <main className="min-w-0 flex-1 overflow-y-auto p-2">
          {page === 'home' ? (
            <HomePage
              profile={settings.profile}
              displays={capabilities?.displays ?? []}
              windows={windows}
              hotkeys={settings.hotkeys}
              engine={engine}
              onChange={updateProfile}
              onChangeHotkey={updateHotkey}
              onRefreshWindows={handleRefreshWindows}
              onStart={() => void startRecording()}
            />
          ) : null}

          {page === 'general' ? (
            <GeneralPage
              settings={settings}
              disabled={settingsLocked}
              hotkeys={settings.hotkeys}
              onChangeSettings={updateSettings}
              onChangeHotkey={updateHotkey}
              onChangeOutputDirectory={() => void pickOutputDirectory()}
              onOpenOutputDirectory={() =>
                void window.capture.system.openPath(settings.profile.outputDirectory)
              }
              onChangeFilenameTemplate={(filenameTemplate) =>
                updateProfile((profile) => ({ ...profile, filenameTemplate }))
              }
            />
          ) : null}

          {page === 'video' ? (
            <VideoPage
              profile={settings.profile}
              capabilities={capabilities}
              hotkeys={settings.hotkeys}
              disabled={settingsLocked}
              onChange={updateProfile}
              onChangeHotkey={updateHotkey}
            />
          ) : null}

          {page === 'overlay' ? (
            <OverlayPage
              profile={settings.profile}
              videoDevices={capabilities?.videoInputDevices ?? []}
              disabled={settingsLocked}
              onChange={updateProfile}
              onPickLogo={() => void pickLogoFile()}
            />
          ) : null}

          {page === 'still' ? (
            <StillPage
              profile={settings.profile}
              hotkeys={settings.hotkeys}
              disabled={settingsLocked}
              intervalActive={intervalActive}
              onChange={updateProfile}
              onChangeHotkey={updateHotkey}
            />
          ) : null}

          {page === 'about' ? <AboutPage engine={engine} /> : null}
        </main>
      </div>

      <StatusBar
        engine={engine}
        stats={stats}
        lastResult={lastResult}
        targetFps={settings.profile.video.fps}
        interval={
          intervalActive
            ? {
                shots: intervalShots,
                intervalSec: settings.profile.stillImage.interval.intervalSec,
                maxShots: settings.profile.stillImage.interval.maxShots
              }
            : null
        }
        onRevealResult={() => {
          if (lastResult?.filePath) void window.capture.system.revealInExplorer(lastResult.filePath)
        }}
      />

      {/* 実際の割り当てを載せるため、設定が読めている画面にだけ置く。 */}
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} hotkeys={settings.hotkeys} />
    </div>
  )
}
