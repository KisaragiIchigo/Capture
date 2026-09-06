import type { ReactElement } from 'react'
import { Highlighter, MousePointerClick } from 'lucide-react'
import {
  DRAW_COLORS,
  DRAW_WIDTHS,
  type CaptureProfile,
  type DrawingConfig,
  type PointerConfig
} from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Slider } from '@renderer/components/ui/Slider'
import { NumberInput } from '@renderer/components/ui/NumberInput'
import { cn } from '@renderer/lib/cn'

interface DrawingSectionProps {
  profile: CaptureProfile
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

/**
 * 画面へ描き込むときの既定値。
 *
 * 描いている最中もパレットから色と太さを変えられるが、ここで決めた値が
 * 窓を開いたときの初期状態になる。毎回選び直す手間をなくすため。
 */
export function DrawingSection({ profile, onChange }: DrawingSectionProps): ReactElement {
  const drawing = profile.drawing

  const patch = (value: Partial<DrawingConfig>): void => {
    onChange((current) => ({ ...current, drawing: { ...current.drawing, ...value } }))
  }

  return (
    <Panel title="描き込み">
      <div className="flex items-start gap-2 pb-1">
        <Highlighter className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-fluid-xs leading-relaxed text-slate-400">
          録画中の画面に線や文字を直接描けます。描いた内容はそのまま映像に写ります。
          ただし、取り込み方が「ウィンドウ」または「ゲーム」のときは写りません。
          これらは対象自身の描画結果を録る仕組みのため、画面に重ねたものが映像へ入らないためです。
        </p>
      </div>

      <Field label="色" description="描き込みを始めるときの色です。">
        <div className="flex flex-wrap items-center gap-1.5">
          {DRAW_COLORS.map((entry) => (
            <button
              key={entry}
              aria-label={`色 ${entry}`}
              title={entry}
              onClick={() => patch({ color: entry })}
              style={{ background: entry }}
              className={cn(
                'h-6 w-6 rounded border transition-transform duration-150 hover:scale-110',
                drawing.color === entry
                  ? 'border-white ring-1 ring-teal-400'
                  : 'border-white/20'
              )}
            />
          ))}

          <label className="ml-1 flex items-center gap-1.5">
            <input
              type="color"
              aria-label="色を自由に指定"
              value={drawing.color}
              onChange={(event) => patch({ color: event.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-white/[0.08] bg-black/40"
            />
            <span className="tabular text-fluid-2xs uppercase text-slate-400">{drawing.color}</span>
          </label>
        </div>
      </Field>

      <Field label="線の太さ" readout={<Readout>{drawing.width} px</Readout>}>
        <div className="flex items-center gap-1.5">
          {DRAW_WIDTHS.map((entry) => (
            <button
              key={entry}
              aria-label={`太さ ${entry}`}
              onClick={() => patch({ width: entry })}
              className={cn(
                'flex h-7 flex-1 items-center justify-center rounded border transition-colors duration-150',
                drawing.width === entry
                  ? 'border-teal-500/30 bg-teal-500/10'
                  : 'border-white/[0.06] bg-black/30 hover:bg-white/[0.04]'
              )}
            >
              <span
                className="rounded-full bg-slate-200"
                style={{ width: '1.5rem', height: Math.min(entry, 10) }}
              />
            </button>
          ))}
        </div>
      </Field>

      <div className="mt-1 border-t border-white/[0.04] pt-1">
        <Field
          label="蛍光マーカーの濃さ"
          description="低くすると下の内容が透けます。薄すぎると画面に埋もれて見えなくなります。"
          readout={<Readout>{Math.round(drawing.markerOpacity * 100)}%</Readout>}
        >
          <Slider
            value={Math.round(drawing.markerOpacity * 100)}
            min={20}
            max={100}
            onChange={(percent) => patch({ markerOpacity: percent / 100 })}
          />
        </Field>
      </div>
    </Panel>
  )
}

interface PointerSectionProps {
  profile: CaptureProfile
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

/**
 * レーザーポインターの見た目。
 *
 * 割り当てたボタンを押している間だけ画面に現れ、離すと軌跡が消える。
 * 画面を覆わないので、指しながら操作を続けられる。
 * 描き込みの「蛍光マーカー」とは別物。あちらは描いたものを残すための道具。
 */
export function PointerSection({ profile, onChange }: PointerSectionProps): ReactElement {
  const pointer = profile.pointer

  const patch = (value: Partial<PointerConfig>): void => {
    onChange((current) => ({ ...current, pointer: { ...current.pointer, ...value } }))
  }

  return (
    <Panel title="レーザーポインター">
      <div className="flex items-start gap-2 pb-1">
        <MousePointerClick className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
        <p className="text-fluid-xs leading-relaxed text-slate-400">
          割り当てたボタンを押している間だけ、マウスの位置に光点が現れます。動かした跡は
          押している間そのまま残るため、指し示した経路を 1 本の線として見せられます。
          画面を覆わないため、操作を続けながら指し示せます。割り当ては一般のページで変更できます。
          描き込みの「蛍光マーカー」とは別の機能です。あちらはボタンを離しても消えません。
          描き込みと同じく、取り込み方が「ウィンドウ」または「ゲーム」のときは録画に写りません。
          録画にも残したい場合は「フルスクリーン」または「指定した領域」で録画してください。
        </p>
      </div>

      <Field label="色">
        <div className="flex flex-wrap items-center gap-1.5">
          {DRAW_COLORS.map((entry) => (
            <button
              key={entry}
              aria-label={`色 ${entry}`}
              title={entry}
              onClick={() => patch({ color: entry })}
              style={{ background: entry }}
              className={cn(
                'h-6 w-6 rounded border transition-transform duration-150 hover:scale-110',
                pointer.color === entry ? 'border-white ring-1 ring-teal-400' : 'border-white/20'
              )}
            />
          ))}

          <label className="ml-1 flex items-center gap-1.5">
            <input
              type="color"
              aria-label="色を自由に指定"
              value={pointer.color}
              onChange={(event) => patch({ color: event.target.value })}
              className="h-6 w-8 cursor-pointer rounded border border-white/[0.08] bg-black/40"
            />
            <span className="tabular text-fluid-2xs uppercase text-slate-400">{pointer.color}</span>
          </label>
        </div>
      </Field>

      <Field
        label="光点の大きさ"
        description="光点の直径です。軌跡の太さもここから決まります。画面の解像度に対して小さすぎると見失います。"
        readout={<Readout>{pointer.size} px</Readout>}
      >
        <Slider
          value={pointer.size}
          min={6}
          max={60}
          onChange={(size) => patch({ size })}
        />
      </Field>

      <Field
        label="消えるまでの時間"
        description="ボタンを離してから、光点と軌跡が形を保ったまま薄れて消え切るまでの長さです。長くするほど緩やかに消えます。"
        readout={
          <Readout tone="muted">
            {pointer.fadeOutMs === 0 ? 'すぐ消える' : `${(pointer.fadeOutMs / 1000).toFixed(1)} 秒`}
          </Readout>
        }
      >
        <NumberInput
          aria-label="消えるまでの時間"
          value={pointer.fadeOutMs}
          min={0}
          max={8000}
          step={100}
          suffix="ms"
          onChange={(fadeOutMs) => patch({ fadeOutMs })}
        />
      </Field>
    </Panel>
  )
}
