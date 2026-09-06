import { join } from 'node:path'
import { mkdirSync } from 'node:fs'
import { screen } from 'electron'
import type { OBSWebSocket } from 'obs-websocket-js'
import type {
  CaptureProfile,
  DisplaySource,
  EncoderId,
  EngineState,
  EngineStatus,
  RecordingResult,
  RecordingStats,
  SystemCapabilities,
  WindowSource
} from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { findFreePort } from '@main/lib/findFreePort'
import { CaptureEngine, CaptureEngineError } from '../CaptureEngine'
import { launchObs, terminateObs, type ObsProcessHandle } from './obsProcess'
import { connectObs } from './connectObs'
import {
  PROFILE_NAME,
  SCENE_NAME,
  toObsFilenameFormat,
  writeBasicProfile,
  writeGlobalConfig
} from './obsProfile'
import { writeRecordEncoderSettings } from './encoderProfile'
import {
  applyRegionCropFilter,
  buildVideoSource,
  ensureScene,
  resetManagedSources,
  resolveCanvasSize
} from './buildSceneGraph'
import { applyAudioProfile } from './applyAudioProfile'
import { applyOverlays } from './applyOverlays'
import { readAvailableKinds, type ObsKinds } from './obsKinds'
import { ensureProfile } from './ensureProfile'
import { collectStats, toEngineStatus } from './mapObsEvents'
import {
  probeAudioDevices,
  probeMonitors,
  probeVideoDevices,
  probeWindows
} from './probeSources'
import { detectEncoders } from './detectEncoders'

const log = createLogger('obs-engine')

const STATS_INTERVAL_MS = 1000

/**
 * 同梱 OBS を obs-websocket 越しに操作する CaptureEngine 実装。
 *
 * このクラスは各 step を宣言順に呼ぶオーケストレーションに専念し、
 * OBS 固有の知識（ini の書式、inputKind、リクエスト名）はすべて同階層のモジュールへ委ねる。
 */
/**
 * 録画や静止画を始めてよい状態かを確かめる。
 *
 * ウィンドウ録画は対象が決まるまで何も映らない。待機している間はそれでよいが、
 * そのまま録画や静止画へ進むと、中身の無いファイルだけが残って何が起きたか分からなくなる。
 * 何も起きないより、理由の書かれた失敗のほうが立て直せる。
 */
function assertCaptureTarget(profile: CaptureProfile): void {
  if (profile.sourceKind === 'window' && !profile.sourceId) {
    throw new CaptureEngineError(
      'キャプチャするウィンドウが選択されていません。ホームのページで対象のウィンドウを選んでください。'
    )
  }
}

export class ObsWebSocketEngine implements CaptureEngine {
  private obs: OBSWebSocket | null = null
  private handle: ObsProcessHandle | null = null
  private displays: DisplaySource[] = []
  private capabilities: SystemCapabilities | null = null
  private statsTimer: NodeJS.Timeout | null = null
  private lastStats: RecordingStats | null = null

  /** OBS 起動時に basic.ini へ焼き込んだエンコーダ。変更にはバックエンド再起動が要る。 */
  private bootedEncoder: EncoderId | null = null

  /** この OBS が扱えるソースとフィルタの種別。版によって名前が変わるため実行時に取得する。 */
  private kinds: ObsKinds = { inputs: new Set(), filters: new Set() }

  /**
   * ソース構築を直列に並べるための待ち行列。
   *
   * 起動直後は「起動処理による構築」と「主モニタの自動選択で走る保存」がほぼ同時に来る。
   * 並行して走らせると、片方の削除ともう片方の作成が交錯して
   * 「A source already exists by that input name」で失敗する。
   */
  private applyChain: Promise<void> = Promise.resolve()

  private currentState: EngineState = { status: 'idle', backendVersion: null, message: null }

  private readonly stateListeners = new Set<(state: EngineState) => void>()
  private readonly statsListeners = new Set<(stats: RecordingStats) => void>()
  private readonly finishedListeners = new Set<(result: RecordingResult) => void>()

  constructor(private profile: CaptureProfile) {}

  get state(): EngineState {
    return this.currentState
  }

  async initialize(): Promise<void> {
    if (this.obs) return

    try {
      await this.bootBackend(this.profile)
      this.capabilities = await this.collectCapabilities()
      this.setState('ready')
    } catch (err) {
      const message =
        err instanceof CaptureEngineError
          ? err.userMessage
          : 'キャプチャエンジンの起動中に予期しないエラーが発生しました。'
      this.setState('error', message)
      throw err
    }
  }

  async shutdown(): Promise<void> {
    this.stopStatsPolling()
    const obs = this.obs
    const handle = this.handle
    const wasRecording =
      this.currentState.status === 'recording' || this.currentState.status === 'paused'
    this.obs = null
    this.handle = null

    /*
     * 接続まで届かずに起動が失敗すると、つなぎ先を持たないまま OBS のプロセスだけが残る。
     * 接続の有無で早期に降りると、その残骸を抱えたまま次の起動へ進み、OBS が二重に動く。
     * 畳むべきものはプロセスであって、接続ではない。
     */
    if (!handle) {
      this.setState('idle')
      return
    }

    await terminateObs(handle, async () => {
      if (!obs) return
      // 録画中なら先に停止させ、コンテナのインデックスを確実に書かせる。
      if (wasRecording) await obs.call('StopRecord')
      await obs.disconnect()
    })

    this.bootedEncoder = null
    this.setState('idle')
  }

  async getCapabilities(): Promise<SystemCapabilities> {
    if (this.capabilities) return this.capabilities
    this.capabilities = await this.collectCapabilities()
    return this.capabilities
  }

  async listWindows(): Promise<WindowSource[]> {
    return probeWindows(this.requireObs(), SCENE_NAME)
  }

  async applySource(profile: CaptureProfile): Promise<void> {
    // 直前の構築が失敗していても、次の構築は必ず実行する。
    const next = this.applyChain.then(
      () => this.rebuildSources(profile),
      () => this.rebuildSources(profile)
    )
    // 呼び出し側へは失敗を伝えつつ、鎖自体は次へ進めるようにする。
    this.applyChain = next.catch(() => undefined)
    return next
  }

  /**
   * 録画中に録画範囲の位置が変わったときだけ通る道。
   *
   * キャンバスの寸法・音声・重ね合わせには触らない。録画中にキャンバスを変えると
   * 出力そのものが壊れるため、映像ソースの設定とクロップの掛け直しに絞る。
   */
  async followRegion(profile: CaptureProfile): Promise<void> {
    const obs = this.requireObs()
    this.profile = profile
    await applyRegionCropFilter(obs, profile, this.displays)
  }

  private async rebuildSources(profile: CaptureProfile): Promise<void> {
    // エンコーダは起動時に basic.ini から読まれるため、変更されたらバックエンドごと入れ替える。
    if (this.bootedEncoder !== null && this.bootedEncoder !== profile.video.encoder) {
      log.info('エンコーダが変更されたためバックエンドを再起動します', {
        from: this.bootedEncoder,
        to: profile.video.encoder
      })
      await this.shutdown()
      await this.bootBackend(profile)
      // bootBackend は接続までしか進めないので、ここで操作可能状態へ戻す。
      this.setState('ready')
    }

    const obs = this.requireObs()
    this.profile = profile

    const canvas = resolveCanvasSize(profile, this.displays)
    await this.applyLiveSettings(obs, profile, canvas)
    // 映像ソースを作り直したときは、重ね合わせを映像より手前へ積み直す必要がある。
    const videoRecreated = await buildVideoSource(obs, profile, this.displays)
    await applyAudioProfile(obs, profile.audio)
    await applyOverlays(
      obs,
      profile.overlays,
      canvas,
      this.kinds,
      this.capabilities?.videoInputDevices ?? [],
      videoRecreated
    )
  }

  async startRecording(profile: CaptureProfile): Promise<void> {
    assertCaptureTarget(profile)
    await this.applySource(profile)
    mkdirSync(profile.outputDirectory, { recursive: true })

    await this.requireObs().call('StartRecord')
    this.startStatsPolling()
  }

  async stopRecording(): Promise<RecordingResult | null> {
    if (this.currentState.status !== 'recording' && this.currentState.status !== 'paused') {
      return null
    }

    const obs = this.requireObs()
    this.setState('stopping')
    const stats = this.lastStats
    const { outputPath } = await obs.call('StopRecord')
    this.stopStatsPolling()

    return {
      filePath: outputPath,
      durationMs: stats?.durationMs ?? 0,
      bytesWritten: stats?.bytesWritten ?? 0
    }
  }

  async pauseRecording(): Promise<void> {
    await this.requireObs().call('PauseRecord')
  }

  async resumeRecording(): Promise<void> {
    await this.requireObs().call('ResumeRecord')
  }

  async takeScreenshot(profile: CaptureProfile): Promise<string> {
    assertCaptureTarget(profile)
    const obs = this.requireObs()
    mkdirSync(profile.outputDirectory, { recursive: true })

    const { format, jpegQuality } = profile.stillImage
    const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
    const filePath = join(profile.outputDirectory, `capture-${stamp}.${format}`)

    /*
     * 撮るのはシーン。映像ソースを直に撮ると、その入力そのものの絵しか写らず、
     * 重ね合わせたWebカメラ・テキスト・ロゴが一切入らない。録画はシーンの合成結果を
     * 書き出しているので、静止画も同じものを撮らないと録画と食い違う。
     */
    await obs.call('SaveSourceScreenshot', {
      sourceName: SCENE_NAME,
      imageFormat: format,
      imageFilePath: filePath,
      // 品質指定が意味を持つのは jpg だけ。-1 はエンコーダ既定を使う指示。
      imageCompressionQuality: format === 'jpg' ? jpegQuality : -1
    })
    return filePath
  }

  onStateChange(listener: (state: EngineState) => void): () => void {
    this.stateListeners.add(listener)
    return () => {
      this.stateListeners.delete(listener)
    }
  }

  onStats(listener: (stats: RecordingStats) => void): () => void {
    this.statsListeners.add(listener)
    return () => {
      this.statsListeners.delete(listener)
    }
  }

  onFinished(listener: (result: RecordingResult) => void): () => void {
    this.finishedListeners.add(listener)
    return () => {
      this.finishedListeners.delete(listener)
    }
  }

  /** 設定ファイルの書き出しから WebSocket 接続確立までの一連。 */
  private async bootBackend(profile: CaptureProfile): Promise<void> {
    this.setState('launching')
    this.displays = readElectronDisplays()
    const canvas = resolveCanvasSize(profile, this.displays)

    writeGlobalConfig()
    writeBasicProfile(profile, canvas)
    writeRecordEncoderSettings(PROFILE_NAME, profile.video)

    const port = await findFreePort()
    this.handle = launchObs(port)

    this.setState('connecting')
    this.obs = await connectObs(port, this.handle.password)
    this.bootedEncoder = profile.video.encoder

    this.bindObsEvents(this.obs)
    // シーンより先にプロファイルを揃える。出力設定はプロファイル単位で持たれている。
    await ensureProfile(this.obs)
    await ensureScene(this.obs)
    // 前回のソースが残っていると、以降の作成がすべて名前の重複で失敗する。
    await resetManagedSources(this.obs)
    this.kinds = await readAvailableKinds(this.obs)

    const { obsVersion } = await this.obs.call('GetVersion')
    this.currentState = { ...this.currentState, backendVersion: obsVersion }
  }

  /** OBS 再起動なしで反映できる設定だけを WebSocket 経由で更新する。 */
  private async applyLiveSettings(
    obs: OBSWebSocket,
    profile: CaptureProfile,
    canvas: { width: number; height: number }
  ): Promise<void> {
    await obs.call('SetVideoSettings', {
      baseWidth: canvas.width,
      baseHeight: canvas.height,
      outputWidth: profile.video.outputWidth ?? canvas.width,
      outputHeight: profile.video.outputHeight ?? canvas.height,
      fpsNumerator: profile.video.fps,
      fpsDenominator: 1
    })

    const parameters: Array<[string, string, string]> = [
      ['AdvOut', 'RecFilePath', profile.outputDirectory],
      ['AdvOut', 'RecFormat2', profile.video.container],
      ['AdvOut', 'RecTracks', profile.audio.separateTracks ? '3' : '1'],
      ['Output', 'FilenameFormatting', toObsFilenameFormat(profile.filenameTemplate)]
    ]

    for (const [category, name, value] of parameters) {
      await obs.call('SetProfileParameter', {
        parameterCategory: category,
        parameterName: name,
        parameterValue: value
      })
    }
  }

  private async collectCapabilities(): Promise<SystemCapabilities> {
    const obs = this.requireObs()
    const electronDisplays = readElectronDisplays()
    const displays = await probeMonitors(obs, SCENE_NAME, electronDisplays)
    this.displays = displays.length > 0 ? displays : electronDisplays

    const audio = await probeAudioDevices(obs, SCENE_NAME)
    const videoInputDevices = await probeVideoDevices(obs, SCENE_NAME)
    const encoders = await detectEncoders()

    return {
      displays: this.displays,
      encoders,
      audioOutputDevices: audio.outputs,
      audioInputDevices: audio.inputs,
      videoInputDevices
    }
  }

  private bindObsEvents(obs: OBSWebSocket): void {
    obs.on('RecordStateChanged', (event) => {
      const status = toEngineStatus(event.outputState)
      if (status) this.setState(status)

      if (event.outputState === 'OBS_WEBSOCKET_OUTPUT_STOPPED') {
        this.stopStatsPolling()
        const stats = this.lastStats
        const result: RecordingResult = {
          filePath: event.outputPath ?? '',
          durationMs: stats?.durationMs ?? 0,
          bytesWritten: stats?.bytesWritten ?? 0
        }
        this.finishedListeners.forEach((listener) => listener(result))
      }
    })

    obs.on('ConnectionClosed', () => {
      this.stopStatsPolling()
      this.obs = null
      this.setState('error', 'キャプチャエンジンとの接続が切断されました。再起動してください。')
    })
  }

  private startStatsPolling(): void {
    this.stopStatsPolling()
    this.statsTimer = setInterval(() => {
      const obs = this.obs
      if (!obs) return
      collectStats(obs)
        .then((stats) => {
          this.lastStats = stats
          this.statsListeners.forEach((listener) => listener(stats))
        })
        .catch((err) => log.warn('統計値の取得に失敗しました', err))
    }, STATS_INTERVAL_MS)
  }

  private stopStatsPolling(): void {
    if (this.statsTimer) {
      clearInterval(this.statsTimer)
      this.statsTimer = null
    }
  }

  private setState(status: EngineStatus, message: string | null = null): void {
    this.currentState = { ...this.currentState, status, message }
    this.stateListeners.forEach((listener) => listener(this.currentState))
  }

  private requireObs(): OBSWebSocket {
    if (!this.obs) {
      throw new CaptureEngineError('キャプチャエンジンが起動していません。')
    }
    return this.obs
  }
}

/** Electron 側から見たモニタ構成。OBS の monitor_id と突き合わせるための下敷きにする。 */
function readElectronDisplays(): DisplaySource[] {
  const primary = screen.getPrimaryDisplay()
  return screen.getAllDisplays().map((display, index) => ({
    id: String(display.id),
    label: `Display ${index + 1}`,
    x: display.bounds.x,
    y: display.bounds.y,
    width: display.bounds.width,
    height: display.bounds.height,
    refreshRate: Math.round(display.displayFrequency),
    isPrimary: display.id === primary.id
  }))
}
