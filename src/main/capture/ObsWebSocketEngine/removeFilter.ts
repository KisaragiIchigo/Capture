import type { OBSWebSocket } from 'obs-websocket-js'

/**
 * フィルタが付いていれば外す。
 *
 * CreateSourceFilter は同じ名前のフィルタが既にあると失敗する。設定を変えるたびに
 * ソースを組み直す作りなので、掛ける前に必ず外す形にしないと、一度掛けたフィルタが
 * 二度目以降の構築をそのまま止めてしまう。
 *
 * 外してから掛け直すことには、値を元へ戻したときに前回のフィルタが残らないという
 * 効果もある。付いていなければ何も起きないため、存在を確かめてから呼ぶ必要はない。
 */
export async function removeFilterIfExists(
  obs: OBSWebSocket,
  sourceName: string,
  filterName: string
): Promise<void> {
  try {
    await obs.call('RemoveSourceFilter', { sourceName, filterName })
  } catch {
    // 付いていなければここへ来る。
  }
}
