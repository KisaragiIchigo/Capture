import type { ReactElement, ReactNode } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { formatHotkey, type HotkeyAction, type HotkeyConfig } from '@shared/types'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** 実際の割り当てを出す。説明と手元の設定が食い違うと、書いてあること自体が信用されなくなる。 */
  hotkeys: HotkeyConfig
}

const HOTKEY_LABELS: Array<{ action: HotkeyAction; label: string; description: string }> = [
  {
    action: 'toggleRecording',
    label: '録画の開始 / 停止',
    description: '押すたびに録画を始めるか止めるかが切り替わります。'
  },
  {
    action: 'pauseRecording',
    label: '一時停止 / 再開',
    description: '録画を中断しても、同じファイルへ続けて記録します。'
  },
  {
    action: 'screenshot',
    label: '静止画の保存',
    description: '押すたびに、いまのキャプチャ対象を 1 枚だけ保存します。'
  },
  {
    action: 'toggleIntervalCapture',
    label: '定期キャプチャーの開始 / 停止',
    description:
      '指定した秒数ごとに静止画を撮り続けます。［静止画］の設定で有効にしてから使用します。開始すると、ウィンドウは通知領域のアイコンへ収まります。'
  },
  {
    action: 'toggleWindow',
    label: 'ウィンドウの表示 / 非表示',
    description: 'この設定ウィンドウを引っ込めたり呼び戻したりします。'
  },
  {
    action: 'toggleDrawing',
    label: '画面への描き込みを開く / 閉じる',
    description: '画面全体を覆う描画面を出します。閉じるまで下のアプリは操作できません。'
  },
  {
    action: 'marker',
    label: 'レーザーポインター',
    description: '押している間だけ、マウスの位置に光点と軌跡が現れます。'
  }
]

/**
 * 使い方の案内。
 *
 * 説明の要点は「見えているものが録画に入るとは限らない」ことに置いています。
 * 取り込み方によって画面へ重ねたものが映像に入らないという性質は、
 * 触っているだけでは気づけず、録り終えてから初めて分かるためです。
 */
export function HelpDialog({ open, onOpenChange, hotkeys }: HelpDialogProps): ReactElement {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[50] bg-black/70 backdrop-blur-sm" />
        <Dialog.Content
          className={[
            'fixed left-1/2 top-1/2 z-[50] flex max-h-[calc(100vh-5rem)] w-[min(48rem,calc(100vw-3rem))]',
            '-translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg',
            'border border-white/[0.08] bg-base-alt/95 shadow-panel backdrop-blur-md'
          ].join(' ')}
        >
          <header className="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] px-4">
            <Dialog.Title className="font-display text-fluid-sm font-semibold tracking-wider text-slate-200">
              使い方
            </Dialog.Title>
            <Dialog.Close
              aria-label="閉じる"
              className="flex h-7 w-7 items-center justify-center rounded text-slate-400 transition-colors duration-150 hover:bg-white/[0.06] hover:text-slate-200"
            >
              <X className="h-3.5 w-3.5" />
            </Dialog.Close>
          </header>

          <Dialog.Description className="shrink-0 border-b border-white/[0.04] px-4 py-2.5 text-fluid-xs leading-relaxed text-slate-400">
            録画の始め方から、画面に重ねたものが映像へ入る条件までをまとめています。
            設定の意味に迷ったときは、この画面を開いたまま設定を触って構いません。
          </Dialog.Description>

          <div className="flex flex-col gap-4 overflow-y-auto px-4 py-3.5">
            <Section title="基本の流れ">
              <ol className="flex flex-col gap-1.5">
                {[
                  '上部のツールバーで取り込み方（フルスクリーン / 指定した領域 / ウィンドウ / ゲーム）を選びます。',
                  'ウィンドウとゲームでは、ホームのページで対象を選びます。選ぶまで録画と静止画は始まりません。',
                  '［REC］を押すか、割り当てたキーで録画を開始します。',
                  '録画したファイルは一般のページで指定した保存先に置かれます。'
                ].map((step, index) => (
                  <li key={step} className="flex gap-2 text-fluid-xs leading-relaxed text-slate-300">
                    <span className="tabular shrink-0 text-teal-400">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="キーの割り当て">
              <p className="pb-2 text-fluid-xs leading-relaxed text-slate-400">
                一般のページで変更できます。マウスのサイドボタンや、Ctrl などの修飾キー単体も指定できます。
              </p>
              <div className="flex flex-col gap-1.5">
                {HOTKEY_LABELS.map((entry) => (
                  <div key={entry.action} className="flex flex-wrap items-start gap-x-3 gap-y-1">
                    <kbd className="tabular shrink-0 rounded border border-teal-500/25 bg-teal-500/10 px-2 py-0.5 text-fluid-2xs text-teal-300">
                      {formatHotkey(hotkeys[entry.action])}
                    </kbd>
                    <div className="min-w-[20rem] flex-1">
                      <p className="text-fluid-xs text-slate-300">{entry.label}</p>
                      <p className="text-fluid-xs leading-relaxed text-slate-400">
                        {entry.description}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="画面に重ねたものが録画に写る条件">
              <p className="pb-2 text-fluid-xs leading-relaxed text-slate-400">
                描き込み・蛍光マーカー・レーザーポインターは、画面の上に透明なウィンドウを重ねて
                描いています。そのため録画に入るかどうかは、取り込み方が何を録っているかで変わります。
                Webカメラ・テキスト・ロゴの重ね合わせは録画エンジン側で合成するため、
                どの取り込み方でも映像に入ります。
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[28rem] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <Th>取り込み方</Th>
                      <Th>録っているもの</Th>
                      <Th>重ねたものが写るか</Th>
                    </tr>
                  </thead>
                  <tbody>
                    <Row kind="フルスクリーン" target="モニタに映るすべて" visible />
                    <Row kind="指定した領域" target="モニタに映るすべて（切り出し）" visible />
                    <Row kind="ウィンドウ" target="対象ウィンドウ自身の描画結果" visible={false} />
                    <Row kind="ゲーム" target="ゲーム自身の描画結果" visible={false} />
                  </tbody>
                </table>
              </div>
              <p className="pt-2 text-fluid-xs leading-relaxed text-slate-400">
                ウィンドウとゲームは、対象が描いた結果を直接受け取る仕組みです。画面の上に別の
                ウィンドウを重ねても対象自身の描画は変わらないため、映像には入りません。
                描き込みも録画に残したい場合は、フルスクリーンか指定した領域で録画してください。
              </p>
              <p className="pt-2 text-fluid-xs leading-relaxed text-slate-400">
                この表の例外が、操作のためだけに浮かべているウィンドウです。ファインダー（枠と操作
                バー）と描き込みの道具のパレットは録画から除外しているため、どの取り込み方でも
                映像や静止画には写りません。
              </p>
            </Section>

            <Section title="画面への描き込み">
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  ペン・蛍光マーカー・直線・矢印・四角・文字・消しゴムが使えます。描いたものは、
                  消しゴムか全消しで消すまで残ります。
                </Bullet>
                <Bullet>
                  文字は、置きたい位置を押すと入力欄が開きます。Enter で確定、Shift + Enter で改行です。
                </Bullet>
                <Bullet>
                  描画中は録画範囲の内側で下のアプリを操作できません。パレットの「操作に戻す」を
                  選ぶか、Esc で閉じてください。
                </Bullet>
                <Bullet>
                  描けるのは録画される範囲の内側だけです。範囲の外は描いても映りません。
                </Bullet>
                <Bullet>
                  道具のパレットは録画から除外した別のウィンドウです。取り込み方に関わらず、
                  パレット自体が映像や静止画へ写ることはありません。置き場所も録画範囲の外側を
                  選ぶため、録りたい対象がパレットで隠れることもありません。
                </Bullet>
              </ul>
            </Section>

            <Section title="レーザーポインター">
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  割り当てたキーを押している間だけ現れます。動かした跡は押している間そのまま残るため、
                  指し示した経路を 1 本の線として見せられます。
                </Bullet>
                <Bullet>
                  離すと、形を保ったまま緩やかに薄れて消えます。色・大きさ・消えるまでの時間は
                  オーバーレイのページで変更できます。
                </Bullet>
                <Bullet>
                  画面を覆わないため、指し示しながらそのまま操作を続けられます。
                </Bullet>
              </ul>
            </Section>

            <Section title="ファインダーの操作バー">
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  指定した領域では録画範囲を示す枠が付きます。バーを掴んで移動、縁でリサイズできます。
                  枠の内側はクリックが通り抜けるため、録りたいアプリを操作したまま範囲を合わせられます。
                </Bullet>
                <Bullet>
                  バーからも録画の開始・停止、静止画、描き込み、音声とカーソルの切り替え、
                  重ね合わせの切り替えができます。設定ウィンドウを開かずに録り始められます。
                </Bullet>
                <Bullet>
                  範囲が狭いときは、並びきらない操作が畳まれます。設定ウィンドウのツールバーには
                  同じ操作がすべて並んでいます。
                </Bullet>
                <Bullet>
                  枠と操作バーは録画から除外しています。フルスクリーンで録画している最中でも、
                  バーが映像へ写り込むことはありません。
                </Bullet>
                <Bullet>
                  右端の赤い × はアプリごと終了します。録画中でも、録画を正しく終えてから
                  終了するため、ファイルが壊れることはありません。枠だけを消したい場合は、
                  設定ウィンドウのツールバーにある「範囲指定の枠」で切り替えてください。
                </Bullet>
              </ul>
            </Section>

            <Section title="静止画">
              <ul className="flex flex-col gap-1.5">
                <Bullet>
                  撮れると操作バーの輪郭が一度光り、保存したファイル名が画面の隅に数秒だけ出ます。
                  合図の札は録画範囲と重ならない位置に出るため、映像には写り込みません。
                </Bullet>
                <Bullet>
                  静止画には録画と同じ合成結果が写ります。Webカメラやロゴの重ね合わせも入ります。
                </Bullet>
                <Bullet>
                  静止画のページで定期キャプチャーを有効にすると、決めた間隔で撮り続けられます。
                  枚数の上限を決めておけば、そこまで撮った時点で自動的に止まります。
                  開始と停止は、静止画を 1 枚保存するのとは別のキーに割り当てます。
                </Bullet>
                <Bullet>
                  定期キャプチャーには、始めるとウィンドウを通知領域へ引っ込める設定があります。
                  撮りたい画面をこのアプリで隠さずに撮り続けるためです。
                </Bullet>
              </ul>
            </Section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactElement {
  return (
    <section>
      <h3 className="rail-label pb-1.5">{title}</h3>
      {children}
    </section>
  )
}

function Th({ children }: { children: ReactNode }): ReactElement {
  return (
    <th className="rail-label px-2 py-1.5 font-medium">{children}</th>
  )
}

function Row({
  kind,
  target,
  visible
}: {
  kind: string
  target: string
  visible: boolean
}): ReactElement {
  return (
    <tr className="border-b border-white/[0.04]">
      <td className="px-2 py-1.5 text-fluid-xs text-slate-300">{kind}</td>
      <td className="px-2 py-1.5 text-fluid-xs text-slate-400">{target}</td>
      <td className="px-2 py-1.5 text-fluid-xs">
        <span
          className={
            visible
              ? 'rounded border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-emerald-300'
              : 'rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-amber-300'
          }
        >
          {visible ? '写ります' : '写りません'}
        </span>
      </td>
    </tr>
  )
}

function Bullet({ children }: { children: ReactNode }): ReactElement {
  return (
    <li className="flex gap-2 text-fluid-xs leading-relaxed text-slate-300">
      <span className="mt-[0.55em] h-1 w-1 shrink-0 rounded-full bg-teal-400/70" />
      <span>{children}</span>
    </li>
  )
}
