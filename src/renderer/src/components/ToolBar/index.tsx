import type { ReactElement, ReactNode } from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import * as Tooltip from '@radix-ui/react-tooltip'
import {
  Camera,
  Check,
  ChevronDown,
  Crop,
  Gamepad2,
  AppWindow,
  Mic,
  Monitor,
  MousePointer2,
  Image as ImageIcon,
  Pause,
  Pencil,
  Play,
  ScanSquare,
  Timer,
  Type,
  Video,
  Volume2
} from 'lucide-react'
import { m } from 'framer-motion'
import type { CaptureProfile, CaptureSourceKind, EngineState } from '@shared/types'
import type { ShutterFlash } from '@renderer/hooks/useShutterFlash'
import { cn } from '@renderer/lib/cn'

interface ToolBarProps {
  profile: CaptureProfile
  engine: EngineState
  onChangeProfile: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  onChangeSourceKind: (kind: CaptureSourceKind) => void
  finderVisible: boolean
  onToggleFinder: () => void
  drawingVisible: boolean
  onToggleDrawing: () => void
  onToggleRecording: () => void
  onTogglePause: () => void
  onScreenshot: () => void
  /** 定期キャプチャーが実行中かどうか。 */
  intervalActive: boolean
  onToggleInterval: () => void
  /** 静止画が保存されたことの合図。撮れたかどうかを画面上で分かるようにする。 */
  shutter: ShutterFlash
}

/** 撮れた合図の長さ。点滅ではなく一度きりの減衰にする。矩形波の明滅は安っぽく見える。 */
const SHUTTER_PULSE_SEC = 0.6

/** 画面録画のサブモード。ゲーム録画は独立したモードとして別ボタンに置く。 */
const SCREEN_MODES: Array<{ value: CaptureSourceKind; label: string; hint: string; icon: ReactNode }> = [
  {
    value: 'display',
    label: 'フルスクリーン',
    hint: 'モニタ全体を録画します。',
    icon: <Monitor className="h-4 w-4" />
  },
  {
    value: 'region',
    label: '指定した領域',
    hint: '画面の一部を座標とサイズで指定して録画します。',
    icon: <Crop className="h-4 w-4" />
  },
  {
    value: 'window',
    label: 'ウィンドウ',
    hint: '特定のウィンドウだけを録画します。対象ウィンドウ自身の描画結果を録るため、画面への描き込みとレーザーポインターは録画に写りません。',
    icon: <AppWindow className="h-4 w-4" />
  }
]

/**
 * 常時表示の操作列。モード、入力のオン / オフ、録画操作が一段に並ぶ。
 * どの画面を開いていても録画を始められることが、このバーの唯一の存在理由。
 */
export function ToolBar({
  profile,
  engine,
  onChangeProfile,
  onChangeSourceKind,
  finderVisible,
  onToggleFinder,
  drawingVisible,
  onToggleDrawing,
  onToggleRecording,
  onTogglePause,
  onScreenshot,
  intervalActive,
  onToggleInterval,
  shutter
}: ToolBarProps): ReactElement {
  const isRecording = engine.status === 'recording'
  const isPaused = engine.status === 'paused'
  const isActive = isRecording || isPaused
  const canOperate = engine.status === 'ready' || isActive
  const isGameMode = profile.sourceKind === 'game'
  const intervalEnabled = profile.stillImage.interval.enabled

  const activeScreenMode =
    SCREEN_MODES.find((mode) => mode.value === profile.sourceKind) ?? SCREEN_MODES[0]!

  return (
    <Tooltip.Provider delayDuration={400}>
      <div className="flex h-14 shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-base-alt/60 px-3 backdrop-blur-md">
        <div className="flex items-stretch">
          <ToolButton
            label={activeScreenMode.label}
            hint={activeScreenMode.hint}
            active={!isGameMode}
            disabled={isActive}
            onClick={() => onChangeSourceKind(activeScreenMode.value)}
            className="rounded-r-none"
          >
            {activeScreenMode.icon}
          </ToolButton>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                aria-label="画面録画モードを選択"
                disabled={isActive}
                className={cn(
                  'no-drag flex w-5 items-center justify-center rounded-r-md border border-l-0 transition-colors duration-150',
                  'disabled:pointer-events-none disabled:opacity-[0.3]',
                  !isGameMode
                    ? 'border-teal-500/30 bg-teal-500/12 text-teal-300'
                    : 'border-white/[0.05] bg-black/25 text-slate-500 hover:bg-white/[0.04] hover:text-slate-300'
                )}
              >
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenu.Trigger>

            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-50 min-w-[15rem] overflow-hidden rounded-md border border-white/[0.08] bg-base-alt/95 p-1 shadow-panel backdrop-blur-md"
              >
                {SCREEN_MODES.map((mode) => (
                  <DropdownMenu.Item
                    key={mode.value}
                    onSelect={() => onChangeSourceKind(mode.value)}
                    className={cn(
                      'flex cursor-default select-none items-start gap-2.5 rounded px-2 py-2 outline-none',
                      'data-[highlighted]:bg-teal-500/10'
                    )}
                  >
                    <span className="mt-0.5 text-slate-400">{mode.icon}</span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-fluid-xs text-slate-200">{mode.label}</span>
                      <span className="text-fluid-2xs leading-relaxed text-slate-400">
                        {mode.hint}
                      </span>
                    </span>
                    {profile.sourceKind === mode.value ? (
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-teal-300" />
                    ) : null}
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <ToolButton
          label="ゲーム録画"
          hint="DirectX / Vulkan のゲームをフックして録画します。ゲーム自身の描画結果を録るため、画面への描き込みとレーザーポインターは録画に写りません。"
          active={isGameMode}
          disabled={isActive}
          onClick={() => onChangeSourceKind('game')}
        >
          <Gamepad2 className="h-4 w-4" />
        </ToolButton>

        {profile.sourceKind === 'region' ? (
          <ToolButton
            label="範囲指定の枠"
            hint="録画する範囲を示す枠を画面に表示します。枠はドラッグで移動、縁でリサイズできます。"
            active={finderVisible}
            disabled={isActive}
            onClick={onToggleFinder}
          >
            <ScanSquare className="h-4 w-4" />
          </ToolButton>
        ) : null}

        <Separator />

        <ToolButton
          label="システム音"
          hint="PC から出ている音を録音します。"
          active={profile.audio.system.enabled}
          disabled={isActive}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              audio: {
                ...current.audio,
                system: { ...current.audio.system, enabled: !current.audio.system.enabled }
              }
            }))
          }
        >
          <Volume2 className="h-4 w-4" />
        </ToolButton>

        <ToolButton
          label="マイク"
          hint="マイク入力を録音します。"
          active={profile.audio.microphone.enabled}
          disabled={isActive}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              audio: {
                ...current.audio,
                microphone: {
                  ...current.audio.microphone,
                  enabled: !current.audio.microphone.enabled
                }
              }
            }))
          }
        >
          <Mic className="h-4 w-4" />
        </ToolButton>

        <ToolButton
          label="マウスカーソル"
          hint="録画映像にマウスカーソルを含めます。"
          active={profile.cursor.capture}
          disabled={isActive}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              cursor: { capture: !current.cursor.capture }
            }))
          }
        >
          <MousePointer2 className="h-4 w-4" />
        </ToolButton>

        <Separator />

        <ToolButton
          label="Webカメラ"
          hint="録画映像にカメラを重ねます。位置や大きさはオーバーレイの設定で調整します。"
          active={profile.overlays.webcam.enabled}
          disabled={isActive}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              overlays: {
                ...current.overlays,
                webcam: { ...current.overlays.webcam, enabled: !current.overlays.webcam.enabled }
              }
            }))
          }
        >
          <Video className="h-4 w-4" />
        </ToolButton>

        <ToolButton
          label="テキスト"
          hint={
            profile.overlays.text.text.trim()
              ? '録画映像に固定の文字を重ねます。'
              : '文字がまだ設定されていません。オーバーレイの設定で入力してください。'
          }
          active={profile.overlays.text.enabled}
          disabled={isActive}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              overlays: {
                ...current.overlays,
                text: { ...current.overlays.text, enabled: !current.overlays.text.enabled }
              }
            }))
          }
        >
          <Type className="h-4 w-4" />
        </ToolButton>

        <ToolButton
          label="ロゴ"
          hint={
            profile.overlays.logo.filePath
              ? '録画映像に画像を重ねます。'
              : '画像がまだ選ばれていません。オーバーレイの設定で選択してください。'
          }
          active={profile.overlays.logo.enabled}
          // 画像が無いまま有効にしても何も出ない。理由はツールチップで伝える。
          disabled={isActive || !profile.overlays.logo.filePath}
          onClick={() =>
            onChangeProfile((current) => ({
              ...current,
              overlays: {
                ...current.overlays,
                logo: { ...current.overlays.logo, enabled: !current.overlays.logo.enabled }
              }
            }))
          }
        >
          <ImageIcon className="h-4 w-4" />
        </ToolButton>

        <Separator />

        <ToolButton
          label="画面に描き込む"
          hint="画面の上に線や文字を直接描きます。描いた内容はそのまま録画に写ります。"
          active={drawingVisible}
          onClick={onToggleDrawing}
        >
          <Pencil className="h-4 w-4" />
        </ToolButton>

        <div className="flex-1" />

        {/*
          一時停止は録画中にしか意味を持たない。待機中に押せないボタンを置いたままにすると、
          何のための場所なのか読めないまま並びの幅だけを取る。要るときにだけ出す。
        */}
        {isActive ? (
          <ToolButton
            label={isPaused ? '録画を再開' : '録画を一時停止'}
            hint="録画を中断し、同じファイルへ続けて記録します。"
            onClick={onTogglePause}
          >
            {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </ToolButton>
        ) : null}

        <RecordButton
          isRecording={isRecording}
          isPaused={isPaused}
          disabled={!canOperate}
          onClick={onToggleRecording}
        />

        <ToolButton
          label="静止画を保存"
          hint="現在のキャプチャ対象から静止画を 1 枚書き出します。"
          disabled={!canOperate}
          flashKey={shutter.flashKey}
          onClick={onScreenshot}
        >
          <Camera className="h-4 w-4" />
        </ToolButton>

        <ToolButton
          label={intervalActive ? '定期キャプチャーを停止' : '定期キャプチャーを開始'}
          hint={
            intervalEnabled
              ? `設定した間隔（${profile.stillImage.interval.intervalSec} 秒ごと）で静止画を保存し続けます。`
              : '静止画の設定で［定期キャプチャーを使う］を有効にすると開始できます。'
          }
          active={intervalActive}
          disabled={!canOperate || !intervalEnabled}
          onClick={onToggleInterval}
        >
          <Timer className="h-4 w-4" />
        </ToolButton>
      </div>
    </Tooltip.Provider>
  )
}

function Separator(): ReactElement {
  return <span className="mx-1 h-6 w-px shrink-0 bg-white/[0.08]" />
}

interface ToolButtonProps {
  label: string
  hint: string
  active?: boolean
  disabled?: boolean
  /** 値が変わったときだけ、ボタンから光の輪を一度広げる。0 なら何も出さない。 */
  flashKey?: number
  onClick: () => void
  className?: string
  children: ReactNode
}

/** ツールバーの正方形ボタン。オンの状態だけティールで発光させる。 */
function ToolButton({
  label,
  hint,
  active,
  disabled,
  flashKey,
  onClick,
  className,
  children
}: ToolButtonProps): ReactElement {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>
        <button
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={cn(
            'no-drag relative flex h-9 w-9 items-center justify-center rounded-md border transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
            'disabled:pointer-events-none disabled:opacity-[0.3]',
            active
              ? 'border-teal-500/30 bg-teal-500/12 text-teal-300 shadow-accent-glow'
              : 'border-white/[0.05] bg-black/25 text-slate-500 shadow-inset-well hover:bg-white/[0.04] hover:text-slate-300',
            className
          )}
        >
          {flashKey ? (
            <m.span
              key={flashKey}
              aria-hidden
              initial={{ opacity: 0.8, scale: 0.65 }}
              animate={{ opacity: 0, scale: 1.7 }}
              transition={{ duration: SHUTTER_PULSE_SEC, ease: 'easeOut' }}
              className="pointer-events-none absolute inset-0 rounded-full bg-teal-400/50 shadow-accent-glow"
            />
          ) : null}
          {children}
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content
          sideOffset={6}
          className="z-[60] max-w-[16rem] rounded-md border border-white/[0.08] bg-base-alt/95 px-2.5 py-1.5 shadow-panel backdrop-blur-md"
        >
          <p className="text-fluid-2xs font-medium text-slate-200">{label}</p>
          <p className="mt-0.5 text-fluid-2xs leading-relaxed text-slate-400">{hint}</p>
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}

interface RecordButtonProps {
  isRecording: boolean
  isPaused: boolean
  disabled: boolean
  onClick: () => void
}

/**
 * ツールバーで最も大きい要素。ここを押せば録れる、が一目で分かることを優先する。
 * 待機中はティール、録画中はタリーの赤へ入れ替える。
 */
function RecordButton({ isRecording, isPaused, disabled, onClick }: RecordButtonProps): ReactElement {
  const active = isRecording || isPaused

  return (
    <m.button
      aria-label={active ? '録画を停止' : '録画を開始'}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { scale: 1.03 }}
      whileTap={disabled ? undefined : { scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={cn(
        'no-drag mx-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border',
        'font-display text-[0.6875rem] font-bold tracking-wider transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-teal-500/50',
        'disabled:pointer-events-none disabled:opacity-[0.3]',
        active
          ? 'border-tally-rec/50 bg-tally-rec/20 text-rose-200 shadow-tally-glow'
          : 'border-emerald-400/25 bg-accent-gradient text-emerald-50 shadow-accent-glow'
      )}
    >
      {active ? (
        <span className="flex flex-col items-center gap-0.5">
          <span className={cn('h-2 w-2 rounded-full bg-tally-rec', isRecording && 'animate-tally-breathe')} />
          <span className="text-[0.5625rem] leading-none">STOP</span>
        </span>
      ) : (
        'REC'
      )}
    </m.button>
  )
}
