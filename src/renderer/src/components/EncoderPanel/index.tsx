import type { ReactElement } from 'react'
import type {
  CaptureProfile,
  EncoderCapability,
  EncoderId,
  OutputContainer,
  RateControl
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Select } from '@renderer/components/ui/Select'
import { Slider } from '@renderer/components/ui/Slider'
import { SegmentedTabs } from '@renderer/components/ui/SegmentedTabs'
import { formatBitrate } from '@renderer/lib/format'

interface EncoderPanelProps {
  profile: CaptureProfile
  encoders: EncoderCapability[]
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

const FPS_CHOICES = [24, 30, 48, 60, 120, 144]

const RATE_CONTROL_TABS = [
  { value: 'cbr' as const, label: 'CBR' },
  { value: 'vbr' as const, label: 'VBR' },
  { value: 'cqp' as const, label: '固定品質' }
]

const CONTAINER_CHOICES: Array<{ value: OutputContainer; label: string; note: string }> = [
  { value: 'mp4', label: 'MP4', note: '互換性が最も高い形式です。' },
  {
    value: 'mkv',
    label: 'MKV',
    note: '録画中にクラッシュしてもファイルが壊れません。長時間録画に向いています。'
  },
  { value: 'mov', label: 'MOV', note: '映像編集ソフトへの取り込みに向いています。' }
]

export function EncoderPanel({
  profile,
  encoders,
  disabled,
  onChange
}: EncoderPanelProps): ReactElement {
  const { video } = profile
  const usesBitrate = video.rateControl !== 'cqp'

  const patchVideo = (patch: Partial<CaptureProfile['video']>): void => {
    onChange((current) => ({ ...current, video: { ...current.video, ...patch } }))
  }

  return (
    <Panel title="Encoder">
      <Field
        label="エンコーダ"
        description="ハードウェアエンコーダを使うと、録画中の CPU 負荷が大きく下がります。"
      >
        <Select
          value={video.encoder}
          disabled={disabled}
          options={encoders.map((encoder) => ({
            value: encoder.id,
            label: encoder.label,
            disabled: !encoder.available,
            ...(encoder.unavailableReason ? { note: encoder.unavailableReason } : {})
          }))}
          onChange={(value) => patchVideo({ encoder: value as EncoderId })}
        />
      </Field>

      <Field label="フレームレート" readout={<Readout>{video.fps} fps</Readout>}>
        <Select
          value={String(video.fps)}
          disabled={disabled}
          options={FPS_CHOICES.map((fps) => ({ value: String(fps), label: `${fps} fps` }))}
          onChange={(value) => patchVideo({ fps: Number(value) })}
        />
      </Field>

      <Field label="レート制御">
        <SegmentedTabs
          layoutGroup="rate-control"
          value={video.rateControl}
          options={RATE_CONTROL_TABS}
          disabled={disabled}
          onChange={(rateControl: RateControl) => patchVideo({ rateControl })}
        />
      </Field>

      {usesBitrate ? (
        <Field
          label="ビットレート"
          description="1080p60 では 12 Mbps 前後が目安です。動きの激しいゲームでは高めに設定してください。"
          readout={<Readout>{formatBitrate(video.bitrateKbps)}</Readout>}
        >
          <Slider
            value={video.bitrateKbps}
            min={2000}
            max={80000}
            step={500}
            disabled={disabled}
            onChange={(bitrateKbps) => patchVideo({ bitrateKbps })}
          />
        </Field>
      ) : (
        <Field
          label="品質 (CQP)"
          description="数値が小さいほど高画質になり、ファイルサイズが大きくなります。"
          readout={<Readout>{video.cqp}</Readout>}
        >
          <Slider
            value={video.cqp}
            min={10}
            max={40}
            disabled={disabled}
            onChange={(cqp) => patchVideo({ cqp })}
          />
        </Field>
      )}

      <Field
        label="キーフレーム間隔"
        description="0 を指定するとエンコーダに任せます。編集を前提とする場合は 1 〜 2 秒が扱いやすくなります。"
        readout={<Readout tone="muted">{video.keyframeIntervalSec} 秒</Readout>}
      >
        <Slider
          value={video.keyframeIntervalSec}
          min={0}
          max={10}
          disabled={disabled}
          onChange={(keyframeIntervalSec) => patchVideo({ keyframeIntervalSec })}
        />
      </Field>

      <Field label="出力形式">
        <Select
          value={video.container}
          disabled={disabled}
          options={CONTAINER_CHOICES.map((choice) => ({
            value: choice.value,
            label: choice.label,
            note: choice.note
          }))}
          onChange={(value) => patchVideo({ container: value as OutputContainer })}
        />
      </Field>
    </Panel>
  )
}
