import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { SetupProgress } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { obsExecutable, obsPortableMarker, obsRoot } from '@main/lib/paths'
import { copyBundledEngine, hasBundledEngine, needsEngineRefresh } from './copyBundledEngine'
import { downloadEngine } from './downloadEngine'
import { removeTree, replaceEngineRoot, stagingRoot } from './stageEngine'

const log = createLogger('setup')

/**
 * キャプチャエンジン（OBS Studio ポータブル）の導入。
 *
 * 同梱されているならそれを複製する。ネットワークにも配布元にも触れないため、
 * 回線やセキュリティ対策ソフトの都合で導入に失敗する余地がない。
 * 同梱の無いビルドでは、従来どおり配布元から取得する。
 */
export async function installEngine(
  onProgress: (progress: SetupProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const staging = stagingRoot()
  const bundled = hasBundledEngine()

  await mkdir(dirname(obsRoot()), { recursive: true })
  await removeTree(staging)

  try {
    if (bundled) await copyBundledEngine(staging, onProgress, signal)
    else await downloadEngine(staging, onProgress, signal)

    await finalize(staging, onProgress)
    await replaceEngineRoot(staging)

    log.info('キャプチャエンジンの準備が完了しました', { bundled })
  } finally {
    // 差し替えが済んでいれば作業場所はもう無い。残っていても次回の妨げにしない。
    await removeTree(staging).catch((err) =>
      log.warn('作業用フォルダを片付けられませんでした', err)
    )
  }
}

/** 同梱されたエンジンを使えるかどうか。導入にネットワークが要るかの判断に使う。 */
export function isEngineBundled(): boolean {
  return hasBundledEngine()
}

/** 配置済みのエンジンが、このビルドの同梱物より古いかどうか。 */
export function isEngineOutdated(): boolean {
  return isEngineInstalled() && needsEngineRefresh()
}

/** 導入済みかどうか。実行ファイルとポータブル指定の両方が揃って初めて使える。 */
export function isEngineInstalled(): boolean {
  return existsSync(obsExecutable()) && existsSync(obsPortableMarker())
}

/**
 * 使える形に整えてから本番の場所へ据える。
 *
 * 実行ファイルの有無をここで確かめるのは、複製や展開そのものが成功しても、
 * セキュリティ対策ソフトが実行ファイルだけを隔離することがあるため。
 */
async function finalize(
  staging: string,
  onProgress: (progress: SetupProgress) => void
): Promise<void> {
  onProgress({ phase: 'verifying', receivedBytes: 0, totalBytes: 0, ratio: 1, message: null })

  // これが無いと OBS はユーザーの既存設定を読み書きしてしまう。
  await writeFile(join(staging, 'portable_mode.txt'), '', 'utf8')

  if (!existsSync(join(staging, 'bin', '64bit', 'obs64.exe'))) {
    throw new Error(
      'エンジンの実行ファイルを配置できませんでした。セキュリティ対策ソフトに隔離された可能性があります。除外設定を追加してから、もう一度お試しください。'
    )
  }
}
