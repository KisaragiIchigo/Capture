import type { ReactElement } from 'react'
import { FolderOpen, FolderSearch } from 'lucide-react'
import type { AppSettings, HotkeyAction, HotkeyBinding, HotkeyConfig } from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Button } from '@renderer/components/ui/Button'
import { ToggleRow } from '@renderer/components/ui/ToggleRow'
import { NumberInput } from '@renderer/components/ui/NumberInput'
import { HotkeyList } from '@renderer/components/HotkeyList'

interface GeneralPageProps {
  settings: AppSettings
  hotkeys: HotkeyConfig
  disabled: boolean
  onChangeSettings: (patch: (settings: AppSettings) => AppSettings) => void
  onChangeHotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void
  onChangeOutputDirectory: () => void
  onOpenOutputDirectory: () => void
  onChangeFilenameTemplate: (template: string) => void
}

export function GeneralPage({
  settings,
  hotkeys,
  disabled,
  onChangeSettings,
  onChangeHotkey,
  onChangeOutputDirectory,
  onOpenOutputDirectory,
  onChangeFilenameTemplate
}: GeneralPageProps): ReactElement {
  const { profile, behavior } = settings

  const patchBehavior = (patch: Partial<AppSettings['behavior']>): void => {
    onChangeSettings((current) => ({ ...current, behavior: { ...current.behavior, ...patch } }))
  }

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
      <Panel title="オプション">
        <Field
          label="保存先"
          description="録画ファイルと静止画はこのフォルダに保存されます。"
          readout={
            <Button
              size="sm"
              variant="ghost"
              onClick={onOpenOutputDirectory}
              icon={<FolderOpen className="h-3 w-3" />}
            >
              開く
            </Button>
          }
        >
          <div className="flex items-center gap-2">
            <span className="well flex h-8 min-w-0 flex-1 items-center px-2.5 text-fluid-xs text-slate-300">
              <span className="truncate" title={profile.outputDirectory}>
                {profile.outputDirectory}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled}
              onClick={onChangeOutputDirectory}
              icon={<FolderSearch className="h-3.5 w-3.5" />}
              className="h-8 shrink-0"
            >
              参照
            </Button>
          </div>
        </Field>

        <Field
          label="ファイル名"
          description="%Y は年、%m は月、%d は日、%H %M %S は時分秒に置き換わります。"
        >
          <input
            type="text"
            aria-label="ファイル名テンプレート"
            value={profile.filenameTemplate}
            disabled={disabled}
            onChange={(event) => onChangeFilenameTemplate(event.target.value)}
            className="well well-focus no-drag h-8 w-full px-2.5 text-fluid-xs text-slate-200 outline-none focus:border-teal-500/50 disabled:pointer-events-none disabled:opacity-[0.35]"
          />
        </Field>

        <div className="mt-1 flex flex-col border-t border-white/[0.04] pt-1">
          <ToggleRow
            label="常に最前面に表示"
            description="他のウィンドウより手前に固定します。"
            checked={behavior.alwaysOnTop}
            onChange={(alwaysOnTop) => patchBehavior({ alwaysOnTop })}
          />
          <ToggleRow
            label="最小化した状態で起動"
            description="起動時にウィンドウを最小化して待機します。"
            checked={behavior.launchMinimized}
            onChange={(launchMinimized) => patchBehavior({ launchMinimized })}
          />
          <ToggleRow
            label="Windows 起動時に起動"
            description="サインイン時にこのアプリを自動的に起動します。"
            checked={behavior.launchOnStartup}
            onChange={(launchOnStartup) => patchBehavior({ launchOnStartup })}
          />
          <ToggleRow
            label="録画開始時に最小化"
            description="録画を開始したときに、このウィンドウをタスクバーへ収めます。"
            checked={behavior.minimizeOnRecord}
            disabled={disabled}
            onChange={(minimizeOnRecord) => patchBehavior({ minimizeOnRecord })}
          />
        </div>
      </Panel>

      <Panel title="ウィンドウ">
        <HotkeyList
          entries={[
            { action: 'toggleWindow', label: 'ウィンドウの表示・非表示' },
            { action: 'toggleDrawing', label: '画面への描き込みを開く・閉じる' },
            { action: 'marker', label: 'レーザーポインター（押している間だけ表示）' }
          ]}
          hotkeys={hotkeys}
          onChange={onChangeHotkey}
        />
      </Panel>

      <Panel title="キャプチャー自動終了">
        <Field
          label="録画時間の上限"
          description="指定した分数を超えると自動的に停止します。0 を指定すると無制限です。"
          readout={
            <Readout tone="muted">
              {behavior.autoStopMinutes === 0 ? '無制限' : `${behavior.autoStopMinutes} 分`}
            </Readout>
          }
        >
          <NumberInput
            aria-label="録画時間の上限"
            value={behavior.autoStopMinutes}
            min={0}
            max={1440}
            suffix="分"
            disabled={disabled}
            onChange={(autoStopMinutes) => patchBehavior({ autoStopMinutes })}
          />
        </Field>

        <Field
          label="空き容量の下限"
          description="保存先の空き容量がこの値を下回ると、録画を自動的に停止して書き込み失敗を防ぎます。"
          readout={<Readout tone="muted">{behavior.minFreeDiskGb} GB</Readout>}
        >
          <NumberInput
            aria-label="空き容量の下限"
            value={behavior.minFreeDiskGb}
            min={0}
            max={1024}
            suffix="GB"
            disabled={disabled}
            onChange={(minFreeDiskGb) => patchBehavior({ minFreeDiskGb })}
          />
        </Field>
      </Panel>
    </div>
  )
}
