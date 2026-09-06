import type { ReactElement } from 'react'
import { Mic, Volume2 } from 'lucide-react'
import type { AudioInputConfig, CaptureProfile } from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Select } from '@renderer/components/ui/Select'
import { Slider } from '@renderer/components/ui/Slider'
import { Switch } from '@renderer/components/ui/Switch'
import { formatVolumeDb } from '@renderer/lib/format'

interface AudioPanelProps {
  profile: CaptureProfile
  outputDevices: Array<{ id: string; label: string }>
  inputDevices: Array<{ id: string; label: string }>
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

export function AudioPanel({
  profile,
  outputDevices,
  inputDevices,
  disabled,
  onChange
}: AudioPanelProps): ReactElement {
  const { audio } = profile

  const patchInput = (
    key: 'system' | 'microphone',
    patch: Partial<AudioInputConfig>
  ): void => {
    onChange((current) => ({
      ...current,
      audio: { ...current.audio, [key]: { ...current.audio[key], ...patch } }
    }))
  }

  return (
    <Panel title="Audio">
      <AudioInputSection
        icon={<Volume2 className="h-3.5 w-3.5 text-slate-400" />}
        title="システム音"
        description="PC から出ている音を録音します。"
        config={audio.system}
        devices={outputDevices}
        disabled={disabled}
        onChange={(patch) => patchInput('system', patch)}
      />

      <div className="my-1 border-t border-white/[0.04]" />

      <AudioInputSection
        icon={<Mic className="h-3.5 w-3.5 text-slate-400" />}
        title="マイク"
        description="マイク入力を録音します。"
        config={audio.microphone}
        devices={inputDevices}
        disabled={disabled}
        onChange={(patch) => patchInput('microphone', patch)}
      />

      <div className="my-1 border-t border-white/[0.04]" />

      <Field
        label="トラック分離"
        description="システム音とマイクを別々の音声トラックとして保存します。編集ソフトで片方だけ音量を調整できます。"
        readout={
          <Switch
            aria-label="音声トラックを分離する"
            checked={audio.separateTracks}
            disabled={disabled}
            onChange={(separateTracks) =>
              onChange((current) => ({
                ...current,
                audio: { ...current.audio, separateTracks }
              }))
            }
          />
        }
      />
    </Panel>
  )
}

interface AudioInputSectionProps {
  icon: ReactElement
  title: string
  description: string
  config: AudioInputConfig
  devices: Array<{ id: string; label: string }>
  disabled: boolean
  onChange: (patch: Partial<AudioInputConfig>) => void
}

function AudioInputSection({
  icon,
  title,
  description,
  config,
  devices,
  disabled,
  onChange
}: AudioInputSectionProps): ReactElement {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5">
          {icon}
          <span className="rail-label">{title}</span>
        </span>
        <Switch
          aria-label={`${title}を録音する`}
          checked={config.enabled}
          disabled={disabled}
          onChange={(enabled) => onChange({ enabled })}
        />
      </div>

      <p className="text-fluid-xs leading-relaxed text-slate-400">{description}</p>

      <Select
        value={config.deviceId}
        disabled={disabled || !config.enabled}
        options={[
          { value: 'default', label: '既定のデバイス' },
          ...devices
            .filter((device) => device.id !== 'default')
            .map((device) => ({ value: device.id, label: device.label }))
        ]}
        onChange={(deviceId) => onChange({ deviceId })}
      />

      <div className="flex items-center gap-2.5 pt-0.5">
        <Slider
          value={Math.round(config.volume * 100)}
          min={0}
          max={100}
          disabled={disabled || !config.enabled}
          onChange={(percent) => onChange({ volume: percent / 100 })}
          className="flex-1"
        />
        <Readout tone={config.muted ? 'muted' : 'accent'}>{formatVolumeDb(config.volume)}</Readout>
      </div>
    </div>
  )
}
