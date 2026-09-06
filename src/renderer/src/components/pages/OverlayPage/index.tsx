import type { ReactElement, ReactNode } from 'react'
import { FileImage, Image as ImageIcon, Type, Video } from 'lucide-react'
import type {
  CaptureProfile,
  LogoOverlay,
  OverlayConfig,
  OverlayPlacement,
  TextOverlay,
  WebcamOverlay
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Slider } from '@renderer/components/ui/Slider'
import { Switch } from '@renderer/components/ui/Switch'
import { Select } from '@renderer/components/ui/Select'
import { Button } from '@renderer/components/ui/Button'
import { NumberInput } from '@renderer/components/ui/NumberInput'
import { AnchorPicker } from '@renderer/components/ui/AnchorPicker'
import { DrawingSection, PointerSection } from './DrawingSection'

interface OverlayPageProps {
  profile: CaptureProfile
  videoDevices: Array<{ id: string; label: string }>
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
  onPickLogo: () => void
}

export function OverlayPage({
  profile,
  videoDevices,
  disabled,
  onChange,
  onPickLogo
}: OverlayPageProps): ReactElement {
  const { overlays } = profile

  const patch = <K extends keyof OverlayConfig>(
    key: K,
    value: Partial<OverlayConfig[K]>
  ): void => {
    onChange((current) => ({
      ...current,
      overlays: { ...current.overlays, [key]: { ...current.overlays[key], ...value } }
    }))
  }

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
      <OverlaySection
        icon={<Video className="h-3.5 w-3.5 text-slate-400" />}
        title="Webカメラ"
        description="録画映像の上にカメラの映像を重ねます。実況の顔出しに使います。"
        enabled={overlays.webcam.enabled}
        disabled={disabled}
        onToggle={(enabled) => patch('webcam', { enabled })}
      >
        <Field label="カメラ" description="接続されているカメラから選択します。">
          <Select
            value={overlays.webcam.deviceId}
            disabled={disabled || !overlays.webcam.enabled}
            options={[
              { value: '', label: '既定のカメラ' },
              ...videoDevices.map((device) => ({ value: device.id, label: device.label }))
            ]}
            onChange={(deviceId) => patch('webcam', { deviceId })}
          />
        </Field>

        <PlacementFields
          placement={overlays.webcam}
          disabled={disabled || !overlays.webcam.enabled}
          onChange={(value) => patch('webcam', value as Partial<WebcamOverlay>)}
        />
      </OverlaySection>

      <OverlaySection
        icon={<Type className="h-3.5 w-3.5 text-slate-400" />}
        title="テキスト"
        description="固定の文字を映像に焼き込みます。配信名やクレジットの表示に使います。"
        enabled={overlays.text.enabled}
        disabled={disabled}
        onToggle={(enabled) => patch('text', { enabled })}
      >
        <Field label="表示する文字" description="改行を含めて指定できます。">
          <textarea
            aria-label="表示する文字"
            value={overlays.text.text}
            disabled={disabled || !overlays.text.enabled}
            rows={2}
            onChange={(event) => patch('text', { text: event.target.value })}
            className="well well-focus no-drag w-full resize-none px-2.5 py-1.5 text-fluid-xs text-slate-200 outline-none focus:border-teal-500/50 disabled:pointer-events-none disabled:opacity-[0.35]"
          />
        </Field>

        <Field
          label="文字サイズ"
          description="録画範囲の大きさに関わらず、指定したポイント数で描画します。"
          readout={<Readout>{overlays.text.fontSize} pt</Readout>}
        >
          <NumberInput
            aria-label="文字サイズ"
            value={overlays.text.fontSize}
            min={8}
            max={400}
            suffix="pt"
            disabled={disabled || !overlays.text.enabled}
            onChange={(fontSize) => patch('text', { fontSize })}
          />
        </Field>

        <Field label="文字色">
          <div className="flex items-center gap-2">
            <input
              type="color"
              aria-label="文字色"
              value={overlays.text.color}
              disabled={disabled || !overlays.text.enabled}
              onChange={(event) => patch('text', { color: event.target.value })}
              className="no-drag h-8 w-12 cursor-pointer rounded border border-white/[0.08] bg-black/40 disabled:pointer-events-none disabled:opacity-[0.35]"
            />
            <span className="tabular text-fluid-xs uppercase text-slate-400">
              {overlays.text.color}
            </span>
          </div>
        </Field>

        <Field
          label="背景の帯"
          description="文字の背後に黒い帯を敷いて読みやすくします。0% で帯なしです。"
          readout={
            <Readout tone="muted">{Math.round(overlays.text.backgroundOpacity * 100)}%</Readout>
          }
        >
          <Slider
            value={Math.round(overlays.text.backgroundOpacity * 100)}
            min={0}
            max={100}
            disabled={disabled || !overlays.text.enabled}
            onChange={(percent) => patch('text', { backgroundOpacity: percent / 100 })}
          />
        </Field>

        <PlacementFields
          placement={overlays.text}
          hideScale
          disabled={disabled || !overlays.text.enabled}
          onChange={(value) => patch('text', value as Partial<TextOverlay>)}
        />
      </OverlaySection>

      <OverlaySection
        icon={<ImageIcon className="h-3.5 w-3.5 text-slate-400" />}
        title="ロゴ"
        description="画像を映像に重ねます。透過 PNG を使うときれいに収まります。"
        enabled={overlays.logo.enabled}
        disabled={disabled}
        onToggle={(enabled) => patch('logo', { enabled })}
      >
        <Field label="画像ファイル" description="PNG、JPG、GIF、BMP を指定できます。">
          <div className="flex items-center gap-2">
            <span className="well flex h-8 min-w-0 flex-1 items-center px-2.5 text-fluid-xs text-slate-300">
              <span className="truncate" title={overlays.logo.filePath}>
                {overlays.logo.filePath || '未選択'}
              </span>
            </span>
            <Button
              size="sm"
              variant="ghost"
              disabled={disabled || !overlays.logo.enabled}
              onClick={onPickLogo}
              icon={<FileImage className="h-3.5 w-3.5" />}
              className="h-8 shrink-0"
            >
              選択
            </Button>
          </div>
        </Field>

        <PlacementFields
          placement={overlays.logo}
          disabled={disabled || !overlays.logo.enabled}
          onChange={(value) => patch('logo', value as Partial<LogoOverlay>)}
        />
      </OverlaySection>

      <DrawingSection profile={profile} onChange={onChange} />

      <PointerSection profile={profile} onChange={onChange} />
    </div>
  )
}

interface OverlaySectionProps {
  icon: ReactNode
  title: string
  description: string
  enabled: boolean
  disabled: boolean
  onToggle: (enabled: boolean) => void
  children: ReactNode
}

function OverlaySection({
  icon,
  title,
  description,
  enabled,
  disabled,
  onToggle,
  children
}: OverlaySectionProps): ReactElement {
  return (
    <Panel
      title={title}
      action={
        <Switch
          aria-label={`${title}を表示する`}
          checked={enabled}
          disabled={disabled}
          onChange={onToggle}
        />
      }
    >
      <div className="flex items-start gap-2 pb-1">
        <span className="mt-0.5">{icon}</span>
        <p className="text-fluid-xs leading-relaxed text-slate-400">{description}</p>
      </div>
      {children}
    </Panel>
  )
}

interface PlacementFieldsProps {
  placement: OverlayPlacement
  /** テキストは実寸で描くため、大きさの指定を出さない。 */
  hideScale?: boolean
  disabled: boolean
  onChange: (value: Partial<OverlayPlacement>) => void
}

function PlacementFields({
  placement,
  hideScale,
  disabled,
  onChange
}: PlacementFieldsProps): ReactElement {
  return (
    <div className="mt-1 border-t border-white/[0.04] pt-1">
      <Field label="配置" description="録画範囲のどこに置くかを選びます。">
        <AnchorPicker
          value={placement.anchor}
          disabled={disabled}
          onChange={(anchor) => onChange({ anchor })}
        />
      </Field>

      {hideScale ? null : (
        <Field
          label="大きさ"
          description="録画範囲の短い辺に対する割合で指定します。"
          readout={<Readout>{Math.round(placement.scale * 100)}%</Readout>}
        >
          <Slider
            value={Math.round(placement.scale * 100)}
            min={5}
            max={80}
            disabled={disabled}
            onChange={(percent) => onChange({ scale: percent / 100 })}
          />
        </Field>
      )}

      <Field
        label="端からの余白"
        readout={<Readout tone="muted">{Math.round(placement.margin * 100)}%</Readout>}
      >
        <Slider
          value={Math.round(placement.margin * 100)}
          min={0}
          max={20}
          disabled={disabled}
          onChange={(percent) => onChange({ margin: percent / 100 })}
        />
      </Field>

      <Field label="不透明度" readout={<Readout>{Math.round(placement.opacity * 100)}%</Readout>}>
        <Slider
          value={Math.round(placement.opacity * 100)}
          min={10}
          max={100}
          disabled={disabled}
          onChange={(percent) => onChange({ opacity: percent / 100 })}
        />
      </Field>
    </div>
  )
}
