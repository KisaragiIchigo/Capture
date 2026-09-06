import type { ReactElement, ReactNode } from 'react'
import {
  AppWindow,
  Camera,
  FolderOpen,
  Image as ImageIcon,
  Mic,
  MousePointer2,
  Move,
  Pause,
  Pencil,
  Play,
  Square,
  Type,
  Video,
  Volume2,
  X
} from 'lucide-react'
import { m } from 'framer-motion'
import type {
  CaptureProfile,
  CaptureSourceKind,
  EngineState,
  RecordingStats
} from '@shared/types'
import { SHOT_NOTICE_MS } from '@shared/types'
import type { ShutterFlash } from '@renderer/hooks/useShutterFlash'
import { cn } from '@renderer/lib/cn'
import { formatTimecode } from '@renderer/lib/format'

interface FinderBarProps {
  engine: EngineState
  stats: RecordingStats | null
  size: { width: number; height: number }
  /** 今どの取り込み方に付いているか。枠が無いときは寸法の代わりに種類を出す。 */
  sourceKind: CaptureSourceKind
  onMoveStart: (event: React.MouseEvent) => void
  onToggleRecording: () => void
  onTogglePause: () => void
  onScreenshot: () => void
  /** 静止画が保存されたことの合図。撮れたかどうかを画面上で分かるようにする。 */
  shutter: ShutterFlash
  /** 入力と重ね合わせの切り替えに使う。読み込めていなければ null。 */
  profile: CaptureProfile | null
  onPatchProfile: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  drawingVisible: boolean
  onToggleDrawing: () => void
  onOpenFolder: () => void
  onShowWindow: () => void
  onClose: () => void
}

/** 撮れた合図の長さ。点滅ではなく一度きりの減衰にする。矩形波の明滅は安っぽく見える。 */
const SHUTTER_PULSE_SEC = 0.6

/** 枠を持たない姿で、何を録っているかを示す表示。 */
const SOURCE_LABELS: Record<CaptureSourceKind, string> = {
  display: '画面全体',
  window: 'ウィンドウ',
  game: 'ゲーム',
  region: '範囲指定'
}

/**
 * ファインダー上部の操作列。
 *
 * バーを掴むと枠ごと動く。移動はネイティブのドラッグ領域ではなく自前で処理する。
 * 透過ウィンドウでクリックスルーを切り替えていると、-webkit-app-region: drag は
 * マウス無視の状態を跨いだ瞬間に掴めなくなるため。
 * ボタンの上で始まった操作はボタンのものとして扱い、移動を開始しない。
 */
export function FinderBar({
  engine,
  stats,
  size,
  sourceKind,
  onMoveStart,
  onToggleRecording,
  onTogglePause,
  onScreenshot,
  shutter,
  profile,
  onPatchProfile,
  drawingVisible,
  onToggleDrawing,
  onOpenFolder,
  onShowWindow,
  onClose
}: FinderBarProps): ReactElement {
  const isRecording = engine.status === 'recording'
  const isPaused = engine.status === 'paused'
  const isActive = isRecording || isPaused
  const canOperate = engine.status === 'ready' || isActive
  const framed = sourceKind === 'region'

  /*
   * 範囲指定の姿ではバーは録画範囲の外にあり、何を出しても映像には入らない。
   * それ以外の姿ではバーが録画対象の上に浮かぶため、録画中にファイル名を出すと
   * その文字列がそのまま映像に残る。発光は 0.6 秒で消えるうえ、バー自体が
   * 元から映り込んでいるので残す。読ませたい文字だけを引っ込める。
   */
  const showFileName = shutter.fileName !== null && (framed || !isRecording)

  return (
    <div
      data-interactive
      onMouseDown={(event) => {
        // ボタンの上で始まった操作は、そのボタンの操作として扱う。
        if ((event.target as HTMLElement).closest('button')) return
        onMoveStart(event)
      }}
      className={cn(
        'relative flex h-8 shrink-0 cursor-move items-center gap-2 border border-white/[0.08]',
        'bg-base-alt/95 px-2 backdrop-blur-md',
        // 枠が続く姿では下辺を枠へ繋げ、バーだけの姿では独立した札として角を丸める。
        framed ? 'rounded-t-md' : 'rounded-md'
      )}
    >
      {/*
        撮れた瞬間にバーの輪郭が一度だけ光る。録画中も常時アニメーションさせないよう、
        鍵が変わったときにだけ走る一回きりの減衰にしてある。
      */}
      {shutter.flashKey ? (
        <m.span
          key={shutter.flashKey}
          aria-hidden
          initial={{ opacity: 0.95 }}
          animate={{ opacity: 0 }}
          transition={{ duration: SHUTTER_PULSE_SEC, ease: 'easeOut' }}
          className={cn(
            'pointer-events-none absolute inset-0 border border-teal-400/70 shadow-accent-glow',
            framed ? 'rounded-t-md' : 'rounded-md'
          )}
        />
      ) : null}

      <Move className="h-3.5 w-3.5 shrink-0 text-slate-500" />

      <span className="tabular shrink-0 text-fluid-2xs text-slate-300">
        {framed ? `${size.width}×${size.height}` : SOURCE_LABELS[sourceKind]}
      </span>

      {isActive && stats ? (
        <>
          <span className="text-slate-600">·</span>
          <span className="tabular shrink-0 text-fluid-2xs text-rose-200">
            {formatTimecode(stats.durationMs)}
          </span>
        </>
      ) : null}

      {/*
        保存したファイル名をその場に出す。光るだけでは「撮れた気がする」で終わるが、
        書けたファイルの名前が出れば、撮れたことも保存先も一度に確かめられる。
        幅は buttons を押し出さないよう min-w-0 + truncate で吸収する。
      */}
      <div className="flex min-w-0 flex-1 items-center justify-end pl-1">
        {showFileName ? (
          <m.span
            key={shutter.flashKey}
            // times は animate のすべての値へ同じ配分で掛かる。y のキーフレーム数を
            // opacity と揃えておかないと、沈み込みが表示時間いっぱいかけて緩む。
            initial={{ opacity: 0, y: -2 }}
            animate={{ opacity: [0, 1, 1, 0], y: [-2, 0, 0, 0] }}
            transition={{
              duration: SHOT_NOTICE_MS / 1000,
              times: [0, 0.06, 0.72, 1],
              ease: 'easeOut'
            }}
            className="tabular truncate text-fluid-2xs text-teal-300"
          >
            {shutter.fileName}
          </m.span>
        ) : null}
      </div>

      {/* 一時停止は録画中にしか意味を持たない。待機中は並びから外す。 */}
      {isActive ? (
        <BarButton
          label={isPaused ? '録画を再開' : '録画を一時停止'}
          onClick={onTogglePause}
        >
          {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
        </BarButton>
      ) : null}

      <m.button
        data-interactive
        aria-label={isActive ? '録画を停止' : '録画を開始'}
        disabled={!canOperate}
        onClick={onToggleRecording}
        whileHover={canOperate ? { scale: 1.05 } : undefined}
        whileTap={canOperate ? { scale: 0.95 } : undefined}
        className={cn(
          'flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5',
          'font-display text-[0.625rem] font-bold tracking-wider transition-colors duration-200',
          'disabled:pointer-events-none disabled:opacity-[0.3]',
          isActive
            ? 'border-tally-rec/50 bg-tally-rec/20 text-rose-200 shadow-tally-glow'
            : 'border-emerald-400/25 bg-accent-gradient text-emerald-50 shadow-accent-glow'
        )}
      >
        {isActive ? (
          <>
            <Square className="h-2.5 w-2.5 fill-current" />
            STOP
          </>
        ) : (
          <>
            <span className="h-2 w-2 rounded-full bg-current" />
            REC
          </>
        )}
      </m.button>

      <BarButton
        label="静止画を保存"
        disabled={!canOperate}
        flashKey={shutter.flashKey}
        onClick={onScreenshot}
      >
        <Camera className="h-3.5 w-3.5" />
      </BarButton>

      {/*
        入力と重ね合わせの切り替え。設定画面を開かずに、録る直前の最終確認として使う。
        狭い範囲を指定しているときは並びきらないため、その場合は畳んで右端の操作を守る。
      */}
      {profile ? (
        <div className="hidden shrink-0 items-center gap-2 md:flex">
          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

          <BarButton
            label="システム音"
            active={profile.audio.system.enabled}
            disabled={isActive}
            onClick={() =>
              onPatchProfile((current) => ({
                ...current,
                audio: {
                  ...current.audio,
                  system: { ...current.audio.system, enabled: !current.audio.system.enabled }
                }
              }))
            }
          >
            <Volume2 className="h-3.5 w-3.5" />
          </BarButton>

          <BarButton
            label="マイク"
            active={profile.audio.microphone.enabled}
            disabled={isActive}
            onClick={() =>
              onPatchProfile((current) => ({
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
            <Mic className="h-3.5 w-3.5" />
          </BarButton>

          <BarButton
            label="マウスカーソル"
            active={profile.cursor.capture}
            disabled={isActive}
            onClick={() =>
              onPatchProfile((current) => ({
                ...current,
                cursor: { capture: !current.cursor.capture }
              }))
            }
          >
            <MousePointer2 className="h-3.5 w-3.5" />
          </BarButton>

          <span className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

          <BarButton
            label="Webカメラ"
            active={profile.overlays.webcam.enabled}
            disabled={isActive}
            onClick={() =>
              onPatchProfile((current) => ({
                ...current,
                overlays: {
                  ...current.overlays,
                  webcam: { ...current.overlays.webcam, enabled: !current.overlays.webcam.enabled }
                }
              }))
            }
          >
            <Video className="h-3.5 w-3.5" />
          </BarButton>

          <BarButton
            label={
              profile.overlays.text.text.trim()
                ? 'テキスト'
                : 'テキスト（文字が未設定です）'
            }
            active={profile.overlays.text.enabled}
            disabled={isActive}
            onClick={() =>
              onPatchProfile((current) => ({
                ...current,
                overlays: {
                  ...current.overlays,
                  text: { ...current.overlays.text, enabled: !current.overlays.text.enabled }
                }
              }))
            }
          >
            <Type className="h-3.5 w-3.5" />
          </BarButton>

          <BarButton
            label={profile.overlays.logo.filePath ? 'ロゴ' : 'ロゴ（画像が未選択です）'}
            active={profile.overlays.logo.enabled}
            // 画像が無いまま有効にしても何も出ない。押せない理由は名前で伝える。
            disabled={isActive || !profile.overlays.logo.filePath}
            onClick={() =>
              onPatchProfile((current) => ({
                ...current,
                overlays: {
                  ...current.overlays,
                  logo: { ...current.overlays.logo, enabled: !current.overlays.logo.enabled }
                }
              }))
            }
          >
            <ImageIcon className="h-3.5 w-3.5" />
          </BarButton>
        </div>
      ) : null}

      <BarButton label="画面に描き込む" active={drawingVisible} onClick={onToggleDrawing}>
        <Pencil className="h-3.5 w-3.5" />
      </BarButton>

      <span className="mx-0.5 h-4 w-px shrink-0 bg-white/[0.08]" />

      <BarButton label="保存先フォルダを開く" onClick={onOpenFolder}>
        {/* フォルダだけ黄色にする。OS の見慣れた色に寄せて、操作の意味を読まずに掴ませる。 */}
        <FolderOpen className="h-3.5 w-3.5 text-folder" />
      </BarButton>

      <BarButton label="設定ウィンドウを表示" onClick={onShowWindow}>
        <AppWindow className="h-3.5 w-3.5" />
      </BarButton>

      <BarButton label="アプリを終了" danger onClick={onClose}>
        <X className="h-3.5 w-3.5" />
      </BarButton>
    </div>
  )
}

interface BarButtonProps {
  label: string
  disabled?: boolean
  danger?: boolean
  /** 状態を持つ操作のときだけ点灯させる。 */
  active?: boolean
  /** 値が変わったときだけ、ボタンから光の輪を一度広げる。0 なら何も出さない。 */
  flashKey?: number
  onClick: () => void
  children: ReactNode
}

function BarButton({
  label,
  disabled,
  danger,
  active,
  flashKey,
  onClick,
  children
}: BarButtonProps): ReactElement {
  return (
    <button
      data-interactive
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'relative flex h-6 w-6 shrink-0 items-center justify-center rounded transition-colors duration-150',
        'disabled:pointer-events-none disabled:opacity-[0.3]',
        active
          ? 'bg-teal-500/20 text-teal-300'
          : danger
            ? // 押すと戻せない操作なので、触る前から色で伝える。
              'text-rose-300 hover:bg-rose-500/80 hover:text-white'
            : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-200'
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
  )
}
