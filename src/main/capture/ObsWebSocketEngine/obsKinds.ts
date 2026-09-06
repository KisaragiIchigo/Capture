import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'

const log = createLogger('obs-kinds')

/**
 * この OBS が扱えるソースとフィルタの種別。
 *
 * 種別の名前は OBS の版によって変わる（text_gdiplus が v2、v3 と枝分かれするなど）。
 * 存在しない名前を指定すると作成そのものが失敗するので、実行時に一覧を取得して
 * 使える名前を選ぶ。見つからなければその機能だけを静かに落とし、録画は続行させる。
 */
export interface ObsKinds {
  inputs: Set<string>
  filters: Set<string>
}

export async function readAvailableKinds(obs: OBSWebSocket): Promise<ObsKinds> {
  const [inputs, filters] = await Promise.all([
    obs.call('GetInputKindList').catch(() => ({ inputKinds: [] as string[] })),
    obs.call('GetSourceFilterKindList').catch(() => ({ sourceFilterKinds: [] as string[] }))
  ])

  const kinds: ObsKinds = {
    inputs: new Set(inputs.inputKinds),
    filters: new Set((filters as { sourceFilterKinds?: string[] }).sourceFilterKinds ?? [])
  }

  log.info('利用できる種別を取得しました', {
    inputCount: kinds.inputs.size,
    filterCount: kinds.filters.size
  })
  return kinds
}

/** 候補を新しい版から順に並べ、最初に使えるものを返す。 */
export function pickKind(available: Set<string>, candidates: string[]): string | null {
  return candidates.find((candidate) => available.has(candidate)) ?? null
}

/** 版によって名前が変わる種別の候補。新しいものから並べる。 */
export const KIND_CANDIDATES = {
  text: ['text_gdiplus_v3', 'text_gdiplus_v2', 'text_gdiplus'],
  image: ['image_source'],
  webcam: ['dshow_input'],
  colorFilter: ['color_filter_v2', 'color_filter']
} as const
