import { createWriteStream } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import type { SetupProgress } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { obsRoot } from '@main/lib/paths'
import { extractZip } from './extractZip'

/**
 * 配布元からエンジンを取得して展開する。
 *
 * インストーラへ同梱していないビルドのための経路。ネットワークの状態も配布元の応答も
 * 利用者の手には負えないため、一度の失敗で諦めずに試し直す。
 */

const log = createLogger('setup-download')

const RELEASE_API = 'https://api.github.com/repos/obsproject/obs-studio/releases/latest'

/** PDB・arm64・インストーラ形式を除外するため、末尾まで厳密に一致させる。 */
const WINDOWS_ASSET = /^OBS-Studio-.+-Windows-x64\.zip$/i

/**
 * 版の一覧を引けなかったときに使う既知の版。
 *
 * 一覧の取得には回数制限があり、同じ回線から繰り返し試すと弾かれる。
 * 一覧が引けないことと、ファイルを取得できないことは別なので、ここで諦めない。
 */
const FALLBACK: EngineDownload = {
  version: '32.2.2',
  url: 'https://github.com/obsproject/obs-studio/releases/download/32.2.2/OBS-Studio-32.2.2-Windows-x64.zip',
  size: 187_800_000
}

const ATTEMPTS = 3
const RETRY_BASE_MS = 1500
const API_TIMEOUT_MS = 30_000

export interface EngineDownload {
  version: string
  url: string
  size: number
}

interface ReleaseAsset {
  name: string
  browser_download_url: string
  size: number
}

export async function downloadEngine(
  staging: string,
  onProgress: (progress: SetupProgress) => void,
  signal: AbortSignal
): Promise<void> {
  const archivePath = join(dirname(obsRoot()), 'obs-download.zip')

  try {
    onProgress({ phase: 'resolving', receivedBytes: 0, totalBytes: 0, ratio: 0, message: null })
    const target = await resolveDownload(signal)
    log.info('キャプチャエンジンの取得先を決定しました', {
      version: target.version,
      url: target.url,
      sizeMb: Math.round(target.size / 1024 / 1024)
    })

    await withRetry(signal, (attempt) => download(target, archivePath, onProgress, signal, attempt))
    await extract(archivePath, staging, onProgress, signal)
  } finally {
    await rm(archivePath, { force: true, maxRetries: 5, retryDelay: 300 })
  }
}

/**
 * 一時的な失敗を挟んでも諦めない。
 *
 * 中止の指示だけは即座に伝える。利用者が取り消したのに裏で試し直すと、
 * 画面に出ている状態と実際の動きが食い違う。
 */
async function withRetry<T>(signal: AbortSignal, run: (attempt: number) => Promise<T>): Promise<T> {
  let lastError: unknown

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    if (signal.aborted) throw new Error('準備が中止されました。')

    try {
      return await run(attempt)
    } catch (err) {
      if (signal.aborted) throw err
      lastError = err
      log.warn(`取得に失敗しました（${attempt} / ${ATTEMPTS} 回目）`, err)

      if (attempt < ATTEMPTS) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_BASE_MS * attempt))
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

/**
 * 取得すべきアーカイブをリリース情報から選ぶ。
 *
 * URL を文字列で組み立てないのは、OBS の資産名が版によって変わるため。
 * 実際に存在する資産の一覧から選べば、命名が変わっても 404 を掴むことがない。
 * 一覧そのものを引けない場合に限り、既知の版へ降りる。
 */
async function resolveDownload(signal: AbortSignal): Promise<EngineDownload> {
  try {
    return await withRetry(signal, () => fetchLatest(signal))
  } catch (err) {
    log.warn('最新版の一覧を取得できなかったため、既知の版で続行します', err)
    return FALLBACK
  }
}

async function fetchLatest(signal: AbortSignal): Promise<EngineDownload> {
  const response = await fetch(RELEASE_API, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'capture-app' },
    signal: AbortSignal.any([signal, AbortSignal.timeout(API_TIMEOUT_MS)])
  })

  if (!response.ok) {
    throw new Error(`最新版の一覧を取得できませんでした（HTTP ${response.status}）。`)
  }

  const release = (await response.json()) as { tag_name?: string; assets?: ReleaseAsset[] }
  const version = release.tag_name?.replace(/^v/, '')
  if (!version) throw new Error('キャプチャエンジンの版情報を読み取れませんでした。')

  const asset = release.assets?.find((candidate) => WINDOWS_ASSET.test(candidate.name))
  if (!asset) {
    throw new Error(
      `キャプチャエンジン ${version} に Windows 版のアーカイブが見つかりませんでした。配布形式が変更された可能性があります。`
    )
  }

  return { version, url: asset.browser_download_url, size: asset.size }
}

async function download(
  target: EngineDownload,
  destination: string,
  onProgress: (progress: SetupProgress) => void,
  signal: AbortSignal,
  attempt: number
): Promise<void> {
  const response = await fetch(target.url, { redirect: 'follow', signal })

  if (!response.ok || !response.body) {
    throw new Error(
      `キャプチャエンジンをダウンロードできませんでした（HTTP ${response.status}）。しばらく待ってからもう一度お試しください。`
    )
  }

  // リリース情報のサイズを既定値にする。転送方式によっては content-length が付かない。
  const totalBytes = Number(response.headers.get('content-length') ?? 0) || target.size
  let receivedBytes = 0

  // 進捗は 200ms 間隔に間引く。1 チャンクごとに送ると IPC が飽和して UI が固まる。
  let lastSent = 0
  const source = Readable.fromWeb(response.body as Parameters<typeof Readable.fromWeb>[0])
  source.on('data', (chunk: Buffer) => {
    receivedBytes += chunk.length
    const now = Date.now()
    if (now - lastSent < 200 && receivedBytes !== totalBytes) return
    lastSent = now

    onProgress({
      phase: 'downloading',
      receivedBytes,
      totalBytes,
      ratio: totalBytes > 0 ? receivedBytes / totalBytes : 0,
      // 試し直していることを黙っていると、進捗が戻る理由が読めない。
      message: attempt > 1 ? `接続し直しています（${attempt} 回目）` : null
    })
  })

  await pipeline(source, createWriteStream(destination), { signal })
}

async function extract(
  archivePath: string,
  staging: string,
  onProgress: (progress: SetupProgress) => void,
  signal: AbortSignal
): Promise<void> {
  let lastSent = 0

  await extractZip(
    archivePath,
    staging,
    ({ done, total }) => {
      const now = Date.now()
      if (now - lastSent < 200 && done !== total) return
      lastSent = now

      onProgress({
        phase: 'extracting',
        receivedBytes: done,
        totalBytes: total,
        ratio: total > 0 ? done / total : 0,
        message: null
      })
    },
    signal
  )
}
