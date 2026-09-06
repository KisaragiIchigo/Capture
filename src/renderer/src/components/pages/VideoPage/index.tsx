import type { ReactElement } from 'react'
import type {
  CaptureProfile,
  EncoderCapability,
  HotkeyAction,
  HotkeyBinding,
  HotkeyConfig,
  SystemCapabilities
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { HotkeyList } from '@renderer/components/HotkeyList'
import { EncoderPanel } from '@renderer/components/EncoderPanel'
import { AudioPanel } from '@renderer/components/AudioPanel'

interface VideoPageProps {
  profile: CaptureProfile
  capabilities: SystemCapabilities | null
  hotkeys: HotkeyConfig
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  onChangeHotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void
}

const NO_ENCODERS: EncoderCapability[] = []

export function VideoPage({
  profile,
  capabilities,
  hotkeys,
  disabled,
  onChange,
  onChangeHotkey
}: VideoPageProps): ReactElement {
  return (
    <div className="flex flex-col gap-2">
      <Panel title="キャプチャー">
        <HotkeyList
          entries={[
            { action: 'toggleRecording', label: '開始・停止' },
            { action: 'pauseRecording', label: '一時停止・再開' }
          ]}
          hotkeys={hotkeys}
          onChange={onChangeHotkey}
        />
        <p className="mt-2 text-fluid-xs leading-relaxed text-slate-400">
          マウスカーソルの表示は上部ツールバーで切り替えます。設定は録画と静止画の両方に反映されます。
        </p>
      </Panel>

      {/* 情報密度を上げるため横に並べる。幅が足りないウィンドウでは自然に 1 列へ戻る。 */}
      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
        <EncoderPanel
          profile={profile}
          encoders={capabilities?.encoders ?? NO_ENCODERS}
          disabled={disabled}
          onChange={onChange}
        />

        <AudioPanel
          profile={profile}
          outputDevices={capabilities?.audioOutputDevices ?? []}
          inputDevices={capabilities?.audioInputDevices ?? []}
          disabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  )
}
