import type { ReactElement } from 'react'
import { GripVertical, X } from 'lucide-react'
import type {
  CanvasBackground,
  CaptureProfile,
  WindowLayout,
  WindowSource
} from '@shared/types'
import { Field, Readout } from '@renderer/components/ui/Field'
import { Slider } from '@renderer/components/ui/Slider'
import { Select } from '@renderer/components/ui/Select'
import { SegmentedTabs } from '@renderer/components/ui/SegmentedTabs'
import { cn } from '@renderer/lib/cn'

interface WindowPickerProps {
  profile: CaptureProfile
  windows: WindowSource[]
  disabled: boolean
  onChange: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

/** 同時に扱えるウィンドウの上限。Main 側の上限と揃える。 */
const MAX_WINDOWS = 8

const LAYOUT_TABS: Array<{ value: WindowLayout; label: string }> = [
  { value: 'as-is', label: '画面のまま' },
  { value: 'vertical', label: '縦に並べる' },
  { value: 'horizontal', label: '横に並べる' }
]

const LAYOUT_NOTE: Record<WindowLayout, string> = {
  'as-is':
    '画面に置かれているとおりの位置関係で写します。離れて置いたウィンドウの間隔もそのまま余白になります。位置を取得できないウィンドウがある場合は、横に並べます。',
  vertical: 'ウィンドウを上から順に重ならないよう並べます。幅が違う場合は中央で揃えます。',
  horizontal: 'ウィンドウを左から順に重ならないよう並べます。高さが違う場合は中央で揃えます。'
}

const BACKGROUND_TABS: Array<{ value: CanvasBackground; label: string }> = [
  { value: 'system', label: 'システム' },
  { value: 'dark', label: 'ダーク' },
  { value: 'light', label: 'ライト' },
  { value: 'transparent', label: '透過' }
]

const BACKGROUND_NOTE: Record<CanvasBackground, string> = {
  system: 'Windows の配色設定に合わせて、黒か白で塗ります。',
  dark: '黒で塗ります。',
  light: '白で塗ります。',
  transparent:
    '塗らずに残します。静止画（PNG）では透明になります。動画は透明を扱えないため、録画では黒になります。'
}

/**
 * 録画するウィンドウの選択と、複数選んだときの並べ方。
 *
 * 選んだ順序がそのまま並ぶ順序になるため、一覧では選択済みを別枠にして順番を見せる。
 * 選択肢の中にチェックを散らすだけでは、何番目に写るのかが読めない。
 */
export function WindowPicker({
  profile,
  windows,
  disabled,
  onChange
}: WindowPickerProps): ReactElement {
  const selected = profile.windowCapture.ids
  const multiple = selected.length > 1

  const patch = (ids: string[]): void => {
    onChange((current) => ({
      ...current,
      windowCapture: { ...current.windowCapture, ids },
      // 単一選択だった頃の対象が残っていると、どちらが有効なのか読めなくなる。
      sourceId: ids[0] ?? null
    }))
  }

  const add = (id: string): void => {
    if (!id || selected.includes(id) || selected.length >= MAX_WINDOWS) return
    patch([...selected, id])
  }

  const remove = (id: string): void => patch(selected.filter((value) => value !== id))

  const move = (index: number, delta: number): void => {
    const next = [...selected]
    const target = index + delta
    if (target < 0 || target >= next.length) return

    const [moved] = next.splice(index, 1)
    if (moved !== undefined) next.splice(target, 0, moved)
    patch(next)
  }

  const options = windows
    .filter((window) => !selected.includes(window.id))
    .map((window) => ({ value: window.id, label: `${window.title} — ${window.executable}` }))

  const labelOf = (id: string): string => {
    const found = windows.find((window) => window.id === id)
    if (found) return `${found.title} — ${found.executable}`

    /*
     * 識別子はタイトルを含むため、中身で見出しが変わるウィンドウ（株価やタイマーを出すもの、
     * ブラウザ、編集中のファイル名を出すエディタ）は選んだ直後から一致しなくなる。
     * 録画側は同じ種類・同じアプリの窓へ結び直して掴み続けるので、ここも同じ見方をする。
     * 一致だけを見ると、実際には録れているものが「見つかりません」と出て食い違う。
     */
    const moved = windows.find((window) => windowKind(window.id) === windowKind(id))
    if (moved) return `${moved.title} — ${moved.executable}`

    // 一覧に無い＝閉じられたか最小化された。選択は残し、掴めないことだけ伝える。
    return `${id.split(':')[0] ?? id}（見つかりません）`
  }

  return (
    <>
      <Field
        label="ウィンドウ"
        description={
          selected.length >= MAX_WINDOWS
            ? `同時に選べるのは ${MAX_WINDOWS} つまでです。`
            : '最小化中のウィンドウは一覧に表示されません。複数選ぶと 1 枚にまとめて写します。'
        }
      >
        <Select
          value=""
          options={options}
          disabled={disabled || selected.length >= MAX_WINDOWS}
          placeholder={selected.length === 0 ? 'ウィンドウを選択' : 'ウィンドウを追加'}
          onChange={add}
        />
      </Field>

      {selected.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {selected.map((id, index) => (
            <li
              key={id}
              className="flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5"
            >
              <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded bg-teal-500/10 text-fluid-2xs font-medium text-teal-300">
                {index + 1}
              </span>

              <span className="min-w-0 flex-1 truncate text-fluid-xs text-slate-300" title={labelOf(id)}>
                {labelOf(id)}
              </span>

              {multiple ? (
                <span className="flex shrink-0 items-center">
                  <OrderButton
                    label="ひとつ前へ"
                    disabled={disabled || index === 0}
                    onClick={() => move(index, -1)}
                  >
                    <GripVertical className="h-3 w-3 rotate-180" />
                  </OrderButton>
                  <OrderButton
                    label="ひとつ後ろへ"
                    disabled={disabled || index === selected.length - 1}
                    onClick={() => move(index, 1)}
                  >
                    <GripVertical className="h-3 w-3" />
                  </OrderButton>
                </span>
              ) : null}

              <button
                type="button"
                aria-label="このウィンドウを外す"
                disabled={disabled}
                onClick={() => remove(id)}
                className={cn(
                  'no-drag shrink-0 rounded p-1 text-slate-500 transition-colors duration-150',
                  'hover:text-rose-300 disabled:pointer-events-none disabled:opacity-[0.25]'
                )}
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {multiple ? (
        <>
          <Field
            label="並べ方"
            description={LAYOUT_NOTE[profile.windowCapture.layout]}
            className="border-t border-white/[0.04] pt-2"
          >
            <SegmentedTabs
              layoutGroup="window-layout"
              value={profile.windowCapture.layout}
              options={LAYOUT_TABS}
              disabled={disabled}
              onChange={(layout: WindowLayout) =>
                onChange((current) => ({
                  ...current,
                  windowCapture: { ...current.windowCapture, layout }
                }))
              }
            />
          </Field>

          {profile.windowCapture.layout === 'as-is' ? null : (
            <Field
              label="間隔"
              readout={<Readout>{profile.windowCapture.gap} px</Readout>}
              description="並べたウィンドウの間に空ける余白です。0 にすると隙間なく詰めて並べます。"
            >
              <Slider
                value={profile.windowCapture.gap}
                min={0}
                max={200}
                step={2}
                disabled={disabled}
                onChange={(gap: number) =>
                  onChange((current) => ({
                    ...current,
                    windowCapture: { ...current.windowCapture, gap }
                  }))
                }
              />
            </Field>
          )}

          <Field label="背景" description={BACKGROUND_NOTE[profile.windowCapture.background]}>
            <SegmentedTabs
              layoutGroup="window-background"
              value={profile.windowCapture.background}
              options={BACKGROUND_TABS}
              disabled={disabled}
              onChange={(background: CanvasBackground) =>
                onChange((current) => ({
                  ...current,
                  windowCapture: { ...current.windowCapture, background }
                }))
              }
            />
          </Field>
        </>
      ) : null}
    </>
  )
}

/**
 * 識別子からタイトルを落とした「クラス名:実行ファイル名」。
 *
 * どのアプリのどの種類の窓か、だけが残る。タイトルが変わっても値は変わらない。
 */
function windowKind(id: string): string {
  return id.split(':').slice(1).join(':')
}

interface OrderButtonProps {
  label: string
  disabled: boolean
  onClick: () => void
  children: ReactElement
}

/** 並び順を入れ替える小さなボタン。並べ方が「画面のまま」以外のときだけ意味を持つ。 */
function OrderButton({ label, disabled, onClick, children }: OrderButtonProps): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'no-drag rounded p-1 text-slate-500 transition-colors duration-150',
        'hover:text-teal-300 disabled:pointer-events-none disabled:opacity-[0.25]'
      )}
    >
      {children}
    </button>
  )
}
