import { useEffect, type ReactElement } from 'react'
import { Circle, RefreshCw } from 'lucide-react'
import type {
  CaptureProfile,
  DisplaySource,
  EngineState,
  HotkeyAction,
  HotkeyBinding,
  HotkeyConfig,
  RegionRect,
  WindowSource
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field } from '@renderer/components/ui/Field'
import { Select, type SelectOption } from '@renderer/components/ui/Select'
import { WindowPicker } from './WindowPicker'
import { NumberInput } from '@renderer/components/ui/NumberInput'
import { Button } from '@renderer/components/ui/Button'
import { HotkeyList } from '@renderer/components/HotkeyList'
import { defaultRegion } from '@renderer/lib/region'

interface HomePageProps {
  profile: CaptureProfile
  displays: DisplaySource[]
  windows: WindowSource[]
  hotkeys: HotkeyConfig
  engine: EngineState
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  onChangeHotkey: (action: HotkeyAction, binding: HotkeyBinding | null) => void
  onRefreshWindows: () => void
  onStart: () => void
}

/** ゲーム録画で対象を選ばなかった場合の自動追従を表す番兵値。 */
const AUTO_FULLSCREEN = '__auto_fullscreen'

/** モードごとの見出しと使い方。上部ツールバーで選んだモードに追従する。 */
const MODE_GUIDE: Record<CaptureProfile['sourceKind'], { title: string; steps: string[] }> = {
  display: {
    title: '画面録画モード — フルスクリーン',
    steps: [
      '録画するモニタを下の一覧から選択します。',
      '上部の［REC］ボタンを押すか、ホットキーで録画を開始します。'
    ]
  },
  region: {
    title: '画面録画モード — 指定した領域',
    steps: [
      '基準となるモニタを選び、録画する範囲の座標とサイズを指定します。',
      '上部の［REC］ボタンを押すか、ホットキーで録画を開始します。'
    ]
  },
  window: {
    title: '画面録画モード — ウィンドウ',
    steps: [
      '録画するウィンドウを一覧から選択します。最小化中のウィンドウは表示されません。',
      '上部の［REC］ボタンを押すか、ホットキーで録画を開始します。'
    ]
  },
  game: {
    title: 'ゲーム録画モード',
    steps: [
      '対象を指定しない場合、前面のフルスクリーンアプリケーションを自動的に捕捉します。',
      '個別に指定する場合は、ゲームを起動してから一覧を更新して選択します。',
      '上部の［REC］ボタンを押すか、ホットキーで録画を開始します。'
    ]
  }
}

export function HomePage({
  profile,
  displays,
  windows,
  hotkeys,
  engine,
  onChange,
  onChangeHotkey,
  onRefreshWindows,
  onStart
}: HomePageProps): ReactElement {
  const needsWindowList = profile.sourceKind === 'window' || profile.sourceKind === 'game'
  const guide = MODE_GUIDE[profile.sourceKind]
  const locked = engine.status === 'recording' || engine.status === 'paused'

  // ウィンドウは開閉するので、この種別を選んでいる間だけ一覧を取り直す。
  useEffect(() => {
    if (needsWindowList) onRefreshWindows()
  }, [needsWindowList, onRefreshWindows])

  const windowOptions: SelectOption[] = windows.map((source) => ({
    value: source.id,
    label: source.title || source.executable,
    note: source.executable
  }))

  return (
    <div className="flex flex-col gap-2">
      <Panel title="はじめましょう">
        <h3 className="text-fluid-sm font-semibold text-slate-200">{guide.title}</h3>
        <ol className="mt-2 flex flex-col gap-1.5">
          {guide.steps.map((step, index) => (
            <li key={step} className="flex gap-2 text-fluid-xs leading-relaxed text-slate-400">
              <span className="tabular shrink-0 text-teal-400">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <div className="mt-3.5">
          <Button
            variant="primary"
            disabled={engine.status !== 'ready'}
            onClick={onStart}
            icon={<Circle className="h-3.5 w-3.5 fill-current" />}
          >
            キャプチャーを開始する
          </Button>
        </div>
      </Panel>

      <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
        <Panel
          title="Target"
          action={
            needsWindowList ? (
              <Button
                size="sm"
                variant="ghost"
                onClick={onRefreshWindows}
                icon={<RefreshCw className="h-3 w-3" />}
              >
                更新
              </Button>
            ) : undefined
          }
        >
          {profile.sourceKind === 'display' ? (
            <Field label="モニタ" description="録画するモニタを選択します。">
              <Select
                value={profile.sourceId ?? displays.find((d) => d.isPrimary)?.id ?? ''}
                options={displays.map((display) => ({
                  value: display.id,
                  label: display.label,
                  note: `${display.width}×${display.height} / ${display.refreshRate} Hz`
                }))}
                disabled={locked}
                placeholder="モニタを選択"
                onChange={(value) => onChange((current) => ({ ...current, sourceId: value }))}
              />
            </Field>
          ) : null}

          {profile.sourceKind === 'window' ? (
            <WindowPicker
              profile={profile}
              windows={windows}
              disabled={locked}
              onChange={onChange}
            />
          ) : null}

          {profile.sourceKind === 'game' ? (
            <Field
              label="ゲーム"
              description="ゲームを起動してから［更新］を押すと、一覧に表示されます。"
            >
              <Select
                value={profile.sourceId ?? AUTO_FULLSCREEN}
                options={[
                  { value: AUTO_FULLSCREEN, label: '自動（前面のフルスクリーン）' },
                  ...windowOptions
                ]}
                disabled={locked}
                onChange={(value) =>
                  onChange((current) => ({
                    ...current,
                    sourceId: value === AUTO_FULLSCREEN ? null : value
                  }))
                }
              />
            </Field>
          ) : null}

          {profile.sourceKind === 'region' ? (
            <RegionFields profile={profile} displays={displays} disabled={locked} onChange={onChange} />
          ) : null}
        </Panel>

        <Panel title="Hotkey">
          <HotkeyList
            entries={[
              { action: 'toggleRecording', label: 'キャプチャー開始・停止' },
              { action: 'screenshot', label: '静止画キャプチャー' }
            ]}
            hotkeys={hotkeys}
            onChange={onChangeHotkey}
          />
        </Panel>
      </div>
    </div>
  )
}

interface RegionFieldsProps {
  profile: CaptureProfile
  displays: DisplaySource[]
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

function RegionFields({ profile, displays, disabled, onChange }: RegionFieldsProps): ReactElement {
  const region = profile.region ?? defaultRegion(displays)

  const patchRegion = (patch: Partial<RegionRect>): void => {
    onChange((current) => ({ ...current, region: { ...region, ...patch } }))
  }

  return (
    <>
      <Field label="基準モニタ" description="範囲の座標はこのモニタを基準に切り出します。">
        <Select
          value={profile.sourceId ?? displays.find((d) => d.isPrimary)?.id ?? ''}
          options={displays.map((display) => ({
            value: display.id,
            label: display.label,
            note: `${display.width}×${display.height}`
          }))}
          disabled={disabled}
          placeholder="モニタを選択"
          onChange={(value) => onChange((current) => ({ ...current, sourceId: value }))}
        />
      </Field>

      <Field label="位置" description="モニタ左上からの座標をピクセルで指定します。">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            aria-label="X 座標"
            value={region.x}
            suffix="X"
            disabled={disabled}
            onChange={(x) => patchRegion({ x })}
          />
          <NumberInput
            aria-label="Y 座標"
            value={region.y}
            suffix="Y"
            disabled={disabled}
            onChange={(y) => patchRegion({ y })}
          />
        </div>
      </Field>

      <Field label="サイズ" description="偶数でない値は、エンコーダ側で自動的に切り詰められます。">
        <div className="grid grid-cols-2 gap-2">
          <NumberInput
            aria-label="幅"
            value={region.width}
            min={16}
            step={2}
            suffix="W"
            disabled={disabled}
            onChange={(width) => patchRegion({ width })}
          />
          <NumberInput
            aria-label="高さ"
            value={region.height}
            min={16}
            step={2}
            suffix="H"
            disabled={disabled}
            onChange={(height) => patchRegion({ height })}
          />
        </div>
      </Field>
    </>
  )
}
