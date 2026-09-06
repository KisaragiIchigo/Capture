import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { dirname, join, resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import yauzl, { type Entry, type ZipFile } from 'yauzl'

/**
 * zip の展開。
 *
 * 既製のライブラリを使わず自前で書いているのは、書き出し先の検証を明示的に持つため。
 * zip の中身は「展開先の外へ書けるパス」を持ち得る（../ を含む名前、絶対パス、
 * 展開先の外を指すシンボリックリンク）。信頼できる配布元から取るとしても、
 * 書き込み先がディレクトリの外へ出ないことは自分で保証する。
 */
export interface ExtractProgress {
  /** 展開済みのエントリ数。 */
  done: number
  /** zip 内の総エントリ数。 */
  total: number
}

export async function extractZip(
  zipPath: string,
  destination: string,
  onProgress: (progress: ExtractProgress) => void,
  signal?: AbortSignal
): Promise<void> {
  const zipfile = await openZip(zipPath)
  const root = resolve(destination)
  let done = 0

  return new Promise<void>((resolvePromise, rejectPromise) => {
    const fail = (error: unknown): void => {
      zipfile.close()
      rejectPromise(error instanceof Error ? error : new Error(String(error)))
    }

    const onAbort = (): void => fail(new Error('展開が中止されました。'))
    signal?.addEventListener('abort', onAbort, { once: true })

    zipfile.on('error', fail)
    zipfile.on('end', () => {
      signal?.removeEventListener('abort', onAbort)
      resolvePromise()
    })

    zipfile.on('entry', (entry: Entry) => {
      if (signal?.aborted) return

      void handleEntry(zipfile, entry, root)
        .then(() => {
          done += 1
          onProgress({ done, total: zipfile.entryCount })
          zipfile.readEntry()
        })
        .catch(fail)
    })

    zipfile.readEntry()
  })
}

function openZip(zipPath: string): Promise<ZipFile> {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        rejectPromise(err ?? new Error('アーカイブを開けませんでした。'))
        return
      }
      resolvePromise(zipfile)
    })
  })
}

async function handleEntry(zipfile: ZipFile, entry: Entry, root: string): Promise<void> {
  // シンボリックリンクは展開先の外を指し得るため、そもそも書き出さない。
  if (isSymlink(entry)) return

  const target = safeJoin(root, entry.fileName)

  if (entry.fileName.endsWith('/')) {
    await mkdir(target, { recursive: true })
    return
  }

  await mkdir(dirname(target), { recursive: true })
  const readStream = await openReadStream(zipfile, entry)
  await pipeline(readStream, createWriteStream(target))
}

function openReadStream(zipfile: ZipFile, entry: Entry): Promise<NodeJS.ReadableStream> {
  return new Promise((resolvePromise, rejectPromise) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err || !stream) {
        rejectPromise(err ?? new Error('アーカイブ内のファイルを読み取れませんでした。'))
        return
      }
      resolvePromise(stream)
    })
  })
}

/** Unix のファイルモードのうち、上位 4 ビットが 0xA000 ならシンボリックリンク。 */
function isSymlink(entry: Entry): boolean {
  const mode = (entry.externalFileAttributes >>> 16) & 0xf000
  return mode === 0xa000
}

/**
 * 展開先の内側に収まるパスだけを返す。
 * 外へ出る名前を持つエントリは、信頼できる配布元であっても展開しない。
 */
function safeJoin(root: string, fileName: string): string {
  const normalized = fileName.replace(/\\/g, '/')

  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
    throw new Error(`アーカイブに絶対パスのエントリが含まれています: ${fileName}`)
  }

  const target = resolve(join(root, normalized))
  if (target !== root && !target.startsWith(root + sep)) {
    throw new Error(`アーカイブに展開先の外を指すエントリが含まれています: ${fileName}`)
  }

  return target
}
