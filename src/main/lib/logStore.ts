import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { logDirectory } from './paths'
import { createLogger } from './logger'

const log = createLogger('log-store')

/** 動作ログのファイル名。日付ごとに 1 本になる。 */
const LOG_FILE = /^capture-\d{4}-\d{2}-\d{2}\.log$/

const DAY_MS = 24 * 60 * 60 * 1000

export interface LogInfo {
  directory: string
  /** 保存されているログの合計サイズ。 */
  totalBytes: number
  fileCount: number
}

/** 保存されているログの量。設定画面で、消すかどうかを判断するために使う。 */
export function readLogInfo(): LogInfo {
  const directory = logDirectory()

  try {
    const files = readdirSync(directory).filter((name) => LOG_FILE.test(name))
    let totalBytes = 0

    for (const name of files) {
      try {
        totalBytes += statSync(join(directory, name)).size
      } catch {
        // 数え上げている最中に消えることがある。その 1 本を飛ばせばよい。
      }
    }

    return { directory, totalBytes, fileCount: files.length }
  } catch {
    // フォルダがまだ無い状態も、何も保存されていないのと同じこと。
    return { directory, totalBytes: 0, fileCount: 0 }
  }
}

/**
 * 保持期間を過ぎたログを消す。
 *
 * 起動のたびに 1 度だけ行う。日付ごとにファイルが増える作りなので、放っておけば
 * 使うほど溜まり続ける。古い記録は再現も追跡もできないため、残しても場所を取るだけになる。
 *
 * 日数が 0 のときは消さない。長く残したい利用者の選択を、こちらの都合で上書きしない。
 */
export function pruneLogs(retentionDays: number): void {
  if (retentionDays <= 0) return

  const directory = logDirectory()
  const deadline = Date.now() - retentionDays * DAY_MS
  let removed = 0

  try {
    for (const name of readdirSync(directory)) {
      if (!LOG_FILE.test(name)) continue

      const file = join(directory, name)
      try {
        // 書き込みが止まった時刻で判断する。名前の日付は、日付をまたいだ書き込みとずれる。
        if (statSync(file).mtimeMs >= deadline) continue
        unlinkSync(file)
        removed += 1
      } catch {
        // 開かれている最中のものは消せない。次回の起動で改めて対象になる。
      }
    }
  } catch {
    // フォルダが無ければ消すものも無い。
    return
  }

  if (removed > 0) log.info('保持期間を過ぎたログを削除しました', { removed, retentionDays })
}

/** 保存されているログをすべて消す。設定画面からの明示的な操作で使う。 */
export function clearLogs(): void {
  const directory = logDirectory()

  try {
    for (const name of readdirSync(directory)) {
      if (!LOG_FILE.test(name)) continue
      try {
        unlinkSync(join(directory, name))
      } catch {
        // 書き込み中のものは残る。消せたものだけで十分に効果がある。
      }
    }
  } catch {
    return
  }
}
