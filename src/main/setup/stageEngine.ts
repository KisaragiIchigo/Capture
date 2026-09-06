import { rename, rm } from 'node:fs/promises'
import { obsRoot } from '@main/lib/paths'

/**
 * エンジンを組み立てる作業場所と、出来上がったものへの差し替え。
 *
 * 展開や複製を本番の場所へ直接行わないのは、途中で失敗したときに
 * 動いていたエンジンまで壊してしまうため。作業場所で完成させてから入れ替える。
 */

/** 展開・複製の作業場所。完成するまで本番の場所には触れない。 */
export function stagingRoot(): string {
  return `${obsRoot()}.incoming`
}

/**
 * 書き込み直後のファイルは、セキュリティ対策ソフトのスキャンで一時的に掴まれることがある。
 * 掴んでいる側が離すまでの猶予として、この回数と間隔で試し直す。
 */
const LOCK_RETRIES = 12
const LOCK_RETRY_MS = 400

/** 掴まれていても諦めずに消す。存在しない場合は何もしない。 */
export function removeTree(path: string): Promise<void> {
  return rm(path, {
    recursive: true,
    force: true,
    maxRetries: LOCK_RETRIES,
    retryDelay: LOCK_RETRY_MS
  })
}

/**
 * 作業場所のエンジンを本番の場所へ据える。
 *
 * rename が EBUSY / EPERM で弾かれるのは、直前に書いたファイルをスキャンが読んでいる間に
 * 起こる。掴んでいる側が離せば通るので、間隔を置いて試し直す。
 */
export async function replaceEngineRoot(staging: string): Promise<void> {
  const destination = obsRoot()
  await removeTree(destination)

  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(staging, destination)
      return
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code
      const retryable = code === 'EBUSY' || code === 'EPERM' || code === 'ENOTEMPTY'
      if (!retryable || attempt >= LOCK_RETRIES) throw err
      await new Promise((resolve) => setTimeout(resolve, LOCK_RETRY_MS))
    }
  }
}
