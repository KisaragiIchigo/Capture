import type { ReactElement } from 'react'
import type {
  CaptureProfile,
  HotkeyAction,
  HotkeyBinding,
  HotkeyConfig,
  IntervalCaptureConfig,
  StillImageConfig,
  StillImageFormat
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { HotkeyList } from '@renderer/components/HotkeyList'
import { SegmentedTabs } from '@renderer/components/ui/SegmentedTabs'
import { Slider } from '@renderer/components/ui/Slider'
import { NumberInput } from '@renderer/components/ui/NumberInput'
import { ToggleRow } from '@renderer/components/ui/ToggleRow'

interface StillPageProps {
  profile: CaptureProfile
  hotkeys: HotkeyConfig
  disabled: boolean
  /** 定期キャプチャーの実行中。走っている条件を書き換えさせないために使う。 */
  intervalActive: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  onChangeHotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void
}

const FORMAT_TABS: Array<{ value: StillImageFormat; label: string }> = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'bmp', label: 'BMP' }
]

const FORMAT_NOTE: Record<StillImageFormat, string> = {
  png: '劣化のない可逆圧縮です。ファイルサイズは大きくなります。',
  jpg: '写真や動画の一場面に向いています。品質を下げるとファイルサイズが小さくなります。',
  bmp: '無圧縮です。編集ソフトへの受け渡し以外では推奨しません。'
}

/** 撮り続けた場合に何分ぶんになるかを添えるための換算。 */
function formatDuration(totalSec: number): string {
  if (totalSec < 60) return `${totalSec} 秒`

  const minutes = Math.floor(totalSec / 60)
  const seconds = totalSec % 60
  if (minutes < 60) return seconds === 0 ? `${minutes} 分` : `${minutes} 分 ${seconds} 秒`

  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} 時間` : `${hours} 時間 ${rest} 分`
}

export function StillPage({
  profile,
  hotkeys,
  disabled,
  intervalActive,
  onChange,
  onChangeHotkey
}: StillPageProps): ReactElement {
  const still = profile.stillImage
  const interval = still.interval

  const patchStill = (patch: Partial<StillImageConfig>): void => {
    onChange((current) => ({ ...current, stillImage: { ...current.stillImage, ...patch } }))
  }

  const patchInterval = (patch: Partial<IntervalCaptureConfig>): void => {
    onChange((current) => ({
      ...current,
      stillImage: { ...current.stillImage, interval: { ...current.stillImage.interval, ...patch } }
    }))
  }

  // 走っている最中に間隔や上限を書き換えると、いま何をしているのか読めなくなる。
  const intervalLocked = disabled || intervalActive

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
      <Panel title="キャプチャー">
        <HotkeyList
          entries={[{ action: 'screenshot', label: '静止画キャプチャー' }]}
          hotkeys={hotkeys}
          onChange={onChangeHotkey}
        />
      </Panel>

      <Panel title="フォーマット">
        <Field label="形式" description={FORMAT_NOTE[still.format]}>
          <SegmentedTabs
            layoutGroup="still-format"
            value={still.format}
            options={FORMAT_TABS}
            disabled={disabled}
            onChange={(format: StillImageFormat) => patchStill({ format })}
          />
        </Field>

        {still.format === 'jpg' ? (
          <Field
            label="画質"
            description="数値が大きいほど高画質になり、ファイルサイズも大きくなります。"
            readout={<Readout>{still.jpegQuality}</Readout>}
          >
            <Slider
              value={still.jpegQuality}
              min={20}
              max={100}
              disabled={disabled}
              onChange={(jpegQuality) => patchStill({ jpegQuality })}
            />
          </Field>
        ) : null}
      </Panel>

      <Panel title="定期キャプチャー">
        <ToggleRow
          label="定期キャプチャーを使う"
          description="指定した秒数ごとに静止画を自動で保存します。有効にしただけでは撮影は始まりません。開始と停止は、ツールバーのタイマーボタンか下のホットキーで行います。"
          checked={interval.enabled}
          disabled={intervalLocked}
          onChange={(enabled) => patchInterval({ enabled })}
        />

        <div className="mt-1 border-t border-white/[0.04] pt-1">
          <Field
            label="撮影の間隔"
            description="1 枚保存してから次を撮るまでの秒数です。保存に時間がかかった場合は、その完了を待ってから数え始めます。"
            readout={<Readout tone={interval.enabled ? 'accent' : 'muted'}>{`${interval.intervalSec} 秒ごと`}</Readout>}
          >
            <NumberInput
              aria-label="定期キャプチャーの間隔"
              value={interval.intervalSec}
              min={1}
              max={3600}
              suffix="秒"
              disabled={intervalLocked || !interval.enabled}
              onChange={(intervalSec) => patchInterval({ intervalSec })}
            />
          </Field>

          <Field
            label="枚数の上限"
            description={
              interval.maxShots === 0
                ? '0 を指定すると、停止するまで撮り続けます。保存先の空き容量にご注意ください。'
                : `この枚数を保存したら自動的に停止します。約 ${formatDuration(interval.maxShots * interval.intervalSec)}ぶんです。`
            }
            readout={
              <Readout tone="muted">
                {interval.maxShots === 0 ? '無制限' : `${interval.maxShots} 枚`}
              </Readout>
            }
          >
            <NumberInput
              aria-label="定期キャプチャーの枚数の上限"
              value={interval.maxShots}
              min={0}
              max={9999}
              suffix="枚"
              disabled={intervalLocked || !interval.enabled}
              onChange={(maxShots) => patchInterval({ maxShots })}
            />
          </Field>
        </div>

        <div className="mt-1 border-t border-white/[0.04] pt-1">
          <ToggleRow
            label="開始したら通知領域へ格納"
            description="撮影を始めたときにウィンドウを閉じて、タスクトレイのアイコンだけを残します。アイコンは撮影中が赤、停止中が黄で、クリックするとウィンドウが戻ります。"
            checked={interval.minimizeToTray}
            disabled={intervalLocked || !interval.enabled}
            onChange={(minimizeToTray) => patchInterval({ minimizeToTray })}
          />
        </div>

        <div className="mt-1 border-t border-white/[0.04] pt-2">
          <HotkeyList
            entries={[{ action: 'toggleIntervalCapture', label: '定期キャプチャーの開始・停止' }]}
            hotkeys={hotkeys}
            onChange={onChangeHotkey}
          />
        </div>

        {intervalActive ? (
          <p className="mt-1 rounded border border-teal-500/20 bg-teal-500/10 px-2.5 py-1.5 text-fluid-xs leading-relaxed text-teal-300">
            定期キャプチャーの実行中です。設定を変更するには、いったん停止してください。
          </p>
        ) : null}
      </Panel>
    </div>
  )
}
