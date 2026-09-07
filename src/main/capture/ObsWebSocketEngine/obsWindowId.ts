import type { DesktopWindow } from '@main/lib/windowBounds'

/**
 * OBS のウィンドウ識別子の読み書きと、選ばれた対象を今の実体へ結び直す計算。
 *
 * OBS には触れず、文字列と一覧だけを扱う。
 */

/** 識別子を構成する 3 つの要素。 */
export interface ObsWindowParts {
  title: string
  className: string
  executable: string
}

/**
 * OBS は識別子の中の記号を # + 2 桁で表す。対応は「#」と「:」の 2 つだけ。
 *
 * 戻すときは「:」を先に戻す。「#」を先に戻すと、戻した「#」と後続の文字が
 * 「#3A」を組み直してしまい、本来ただの文字だったものが区切りに化ける。
 */
export function decodeObsWindowField(value: string): string {
  return value.replace(/#3A/g, ':').replace(/#22/g, '#')
}

/** 組み立てるときは逆順。「#」を先に置き換えないと、置き換えで生まれた「#」がさらに化ける。 */
export function encodeObsWindowField(value: string): string {
  return value.replace(/#/g, '#22').replace(/:/g, '#3A')
}

/** `タイトル:クラス名:実行ファイル名` を読み解く。 */
export function parseObsWindowId(id: string): ObsWindowParts {
  const [title = '', className = '', executable = ''] = id.split(':')
  return {
    title: decodeObsWindowField(title),
    className: decodeObsWindowField(className),
    executable: decodeObsWindowField(executable)
  }
}

/** 実体から OBS の識別子を組み立てる。 */
export function buildObsWindowId(parts: ObsWindowParts): string {
  return [parts.title, parts.className, parts.executable].map(encodeObsWindowField).join(':')
}

/** 選ばれた対象 1 つぶんの解決結果。window が null なら画面上に見つからなかった。 */
export interface ResolvedWindow {
  /** OBS へ渡す識別子。見つかった場合は今のタイトルで組み直したもの。 */
  id: string
  window: DesktopWindow | null
}

/**
 * 選ばれた対象を、今そこにある窓へ結び直す。
 *
 * OBS の識別子はタイトルを含むため、タイトルが変わる窓（株価やタイマーを出すもの、
 * ブラウザ、編集中のファイル名を出すエディタ）は、選んだ直後から一致しなくなる。
 * 一致しなくなった識別子を渡すと OBS は何も掴めず、映像が真っ黒のまま残る。
 * 掴んだ大きさも測れないので、並べる寸法まで既定値へ落ちて配置ごと崩れる。
 *
 * 先にクラス名と実行ファイルで探し直し、今のタイトルで識別子を組み直してから渡す。
 *
 * 2 周に分けるのは、同じアプリの窓を複数選んだときに取り違えないため。
 * 1 周目で完全に一致するものを確定させ、2 周目で残りを埋める。1 周で処理すると、
 * 先に見た対象が「同じクラスの手前にある窓」を先取りして、後続が別の窓へずれる。
 * 一度使った窓は次の対象へ回さないため、2 つの枠が同じ窓を映すことも起きない。
 */
export function resolveWindowTargets(ids: string[], windows: DesktopWindow[]): ResolvedWindow[] {
  const resolved: Array<DesktopWindow | null> = ids.map(() => null)
  const taken = new Set<DesktopWindow>()

  const parts = ids.map(parseObsWindowId)

  const claim = (index: number, found: DesktopWindow | undefined): void => {
    if (!found || taken.has(found)) return
    resolved[index] = found
    taken.add(found)
  }

  // 1 周目。タイトルまで一致するものだけを取る。
  parts.forEach((part, index) => {
    claim(
      index,
      windows.find(
        (window) =>
          !taken.has(window) &&
          window.title === part.title &&
          window.className === part.className &&
          window.executable === part.executable
      )
    )
  })

  // 2 周目。タイトルが変わった対象を、クラス名と実行ファイルで拾い直す。手前にあるものを選ぶ。
  parts.forEach((part, index) => {
    if (resolved[index]) return
    claim(
      index,
      windows.find(
        (window) =>
          !taken.has(window) &&
          window.className === part.className &&
          window.executable === part.executable
      )
    )
  })

  return ids.map((id, index) => {
    const window = resolved[index] ?? null
    return { id: window ? buildObsWindowId(window) : id, window }
  })
}
