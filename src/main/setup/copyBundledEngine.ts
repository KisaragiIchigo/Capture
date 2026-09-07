import { existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { SetupProgress } from '@shared/types'
import { bundledEngineRoot, obsRoot } from '@main/lib/paths'

/**
 * インストーラへ同梱したエンジンを、書き込みできる場所へ複製する。
 *
 * ネットワークにも配布元にも依存しないため、導入がここで完結する。
 * 同梱の置き場所は読み取り専用になり得る（Program Files 配下）ので、そのままは使えない。
 */

/** 同梱されたエンジンがこのビルドに入っているかどうか。 */
export function hasBundledEngine(): boolean {
  return existsSync(join(bundledEngineRoot(), 'bin', '64bit', 'obs64.exe'))
}

/**
 * 同梱されたエンジンが、配置済みのものと違うかどうか。
 *
 * 配置は初回だけでは足りない。エンジンの版を上げたときや、実行に必要なものを足したときに、
 * 既に導入を済ませた PC へ届かないためである。実際、必要なランタイムを同梱しても、
 * 先に古い構成で配置を終えていた PC では何も変わらなかった。
 *
 * 控えが無いのは、この仕組みより前に配置されたということなので、入れ替えの対象とする。
 */
export function needsEngineRefresh(): boolean {
  if (!hasBundledEngine()) return false
  return readStamp(bundledEngineRoot()) !== readStamp(obsRoot())
}

/** 同梱物の内訳。版と、ランタイムを含むかどうかを 1 つの文字列にする。 */
function readStamp(root: string): string | null {
  try {
    const raw = JSON.parse(readFileSync(join(root, 'engine.json'), 'utf8')) as {
      version?: unknown
      runtime?: unknown
    }
    return `${String(raw.version ?? '')}/${String(raw.runtime ?? '')}`
  } catch {
    return null
  }
}

export async function copyBundledEngine(
  staging: string,
  onProgress: (progress: SetupProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const source = bundledEngineRoot()

  onProgress({ phase: 'copying', receivedBytes: 0, totalBytes: 0, ratio: 0, message: null })

  // 総数が分からないと進捗が「動いているだけ」の表示になる。先に数えてから複製する。
  const total = await countFiles(source, signal)
  let done = 0
  let lastSent = 0

  await copyTree(source, staging, signal, () => {
    done += 1

    const now = Date.now()
    if (now - lastSent < 200 && done !== total) return
    lastSent = now

    onProgress({
      phase: 'copying',
      receivedBytes: done,
      totalBytes: total,
      ratio: total > 0 ? done / total : 0,
      message: null
    })
  })
}

function abortIfNeeded(signal: AbortSignal): void {
  if (signal.aborted) throw new Error('エンジンの配置が中止されました。')
}

async function countFiles(directory: string, signal: AbortSignal): Promise<number> {
  abortIfNeeded(signal)

  const entries = await readdir(directory, { withFileTypes: true })
  let count = 0

  for (const entry of entries) {
    if (entry.isDirectory()) count += await countFiles(join(directory, entry.name), signal)
    else count += 1
  }

  return count
}

async function copyTree(
  source: string,
  destination: string,
  signal: AbortSignal,
  onFile: () => void
): Promise<void> {
  abortIfNeeded(signal)
  await mkdir(destination, { recursive: true })

  const entries = await readdir(source, { withFileTypes: true })

  for (const entry of entries) {
    abortIfNeeded(signal)

    const from = join(source, entry.name)
    const to = join(destination, entry.name)

    if (entry.isDirectory()) {
      await copyTree(from, to, signal, onFile)
      continue
    }

    // リンク類は同梱物に含まれない。実体だけを複製する。
    if (!entry.isFile()) continue

    await copyFile(from, to)
    onFile()
  }
}
