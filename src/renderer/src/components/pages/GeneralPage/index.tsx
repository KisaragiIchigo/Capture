import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { FileText, FolderOpen, FolderSearch, Trash2 } from 'lucide-react'
import type { AppSettings, HotkeyAction, HotkeyBinding, HotkeyConfig, LogInfo } from '@shared/types'
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

  const [logInfo, setLogInfo] = useState<LogInfo | null>(null)

  const refreshLogInfo = useCallback(() => {
    window.capture.system
      .getLogInfo()
      .then(setLogInfo)
      .catch(() => setLogInfo(null))
  }, [])

  // 溜まっている量が見えないと、保存を切るかどうかを決められない。
  useEffect(refreshLogInfo, [refreshLogInfo])

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

      <Panel title="ログ">
        <ToggleRow
          label="動作ログを保存する"
          description="操作の時刻とエンジンからの応答をファイルに記録します。不具合の原因を調べるときに使います。映像や個人を特定する情報は含まれません。"
          checked={behavior.logToFile}
          onChange={(logToFile) => patchBehavior({ logToFile })}
        />

        <div className="mt-1 border-t border-white/[0.04] pt-1">
          <Field
            label="保存する期間"
            description="この日数を過ぎたログを、起動時に自動で削除します。0 を指定すると削除しません。"
            readout={
              <Readout tone="muted">
                {behavior.logRetentionDays === 0 ? '削除しない' : `${behavior.logRetentionDays} 日`}
              </Readout>
            }
          >
            <NumberInput
              aria-label="ログを保存する期間"
              value={behavior.logRetentionDays}
              min={0}
              max={365}
              suffix="日"
              disabled={!behavior.logToFile}
              onChange={(logRetentionDays) => patchBehavior({ logRetentionDays })}
            />
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-2 py-1.5">
            <span className="text-fluid-xs text-slate-400">
              現在の保存量：
              <span className="tabular ml-1 text-slate-300">
                {logInfo ? `${formatLogSize(logInfo.totalBytes)}（${logInfo.fileCount} 件）` : '—'}
              </span>
            </span>

            <div className="flex shrink-0 items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void window.capture.system.openLogFolder()}
                icon={<FileText className="h-3 w-3" />}
              >
                開く
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={!logInfo || logInfo.fileCount === 0}
                onClick={() => {
                  void window.capture.system.clearLogs().then(refreshLogInfo)
                }}
                icon={<Trash2 className="h-3 w-3" />}
              >
                今すぐ削除
              </Button>
            </div>
          </div>
        </div>
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

/** 保存量の表示。桁が変わっても読み取りやすい単位へ丸める。 */
function formatLogSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
