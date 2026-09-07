/**
 * インストーラへ同梱するキャプチャエンジン（OBS Studio ポータブル）をビルド前に用意する。
 *
 * アプリの初回起動時にダウンロードさせると、利用者のネットワーク環境や
 * セキュリティ製品の都合で導入に失敗する。取得はビルドする側の 1 回だけにして、
 * 配布物には展開済みのものを載せる。
 *
 * 使い方:
 *   node scripts/fetch-engine.mjs          … 未取得なら取得する
 *   node scripts/fetch-engine.mjs --force  … 取得済みでも取り直す
 */
import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { copyFile, mkdir, rm, rename, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import yauzl from 'yauzl'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const engineRoot = join(projectRoot, 'build', 'engine', 'obs-studio')
const archivePath = join(projectRoot, 'build', 'engine', 'obs-download.zip')

const RELEASE_API = 'https://api.github.com/repos/obsproject/obs-studio/releases/latest'
const WINDOWS_ASSET = /^OBS-Studio-.+-Windows-x64\.zip$/i

/** API が使えないときに使う既知の版。ここが古びても、まず API の結果が優先される。 */
const FALLBACK = {
  version: '32.2.2',
  url: 'https://github.com/obsproject/obs-studio/releases/download/32.2.2/OBS-Studio-32.2.2-Windows-x64.zip',
  size: 187_800_000
}

const force = process.argv.includes('--force')

/**
 * OBS の実行に必要な Visual C++ ランタイム。
 *
 * OBS 本体は Visual C++ でビルドされている。公式のインストーラはランタイムを一緒に入れるが、
 * 配布されているポータブル版の zip には入っていない。開発に使う PC には他のアプリが入れた
 * 同じものが既にあるため手元では気づけず、まっさらな PC でだけ「起動しない」形で表面化する。
 *
 * 実行ファイルと同じ場所へ置くと Windows はそちらを先に読む（app-local deployment）。
 * これで、導入先の PC に何も入っていなくても OBS が動く。
 */
const RUNTIME_DLLS = [
  'vcruntime140.dll',
  'vcruntime140_1.dll',
  'msvcp140.dll',
  'msvcp140_1.dll',
  'msvcp140_2.dll',
  'concrt140.dll'
]

/**
 * 同梱物の内訳を書き残す。
 *
 * 導入先では、この内容が配置済みのものと一致するかどうかで入れ替えの要否を決める。
 * 版を上げたときやランタイムを足したときに、既に導入済みの PC へ届かないと意味がない。
 */
async function writeStamp(root, version, runtime) {
  const stamp = { version, runtime, builtAt: new Date().toISOString() }
  await writeFile(join(root, 'engine.json'), JSON.stringify(stamp, null, 2), 'utf8')
}

/** ランタイムを実行ファイルの隣へ複製する。すでにある版は上書きしない。 */
async function bundleRuntime(root) {
  const system32 = join(process.env.SystemRoot ?? 'C:\Windows', 'System32')
  const target = join(root, 'bin', '64bit')

  const copied = []
  const missing = []

  for (const dll of RUNTIME_DLLS) {
    if (existsSync(join(target, dll))) continue

    const from = join(system32, dll)
    if (!existsSync(from)) {
      missing.push(dll)
      continue
    }

    await copyFile(from, join(target, dll))
    copied.push(dll)
  }

  if (copied.length > 0) console.log(`  ランタイムを同梱しました: ${copied.join(', ')}`)
  if (missing.length > 0) {
    console.warn(`  この PC に見つからず同梱できませんでした: ${missing.join(', ')}`)
    console.warn('  導入先の PC に Visual C++ 再頒布可能パッケージが無いと、エンジンが起動しません。')
  }

  return missing.length === 0
}

/** 展開直後のファイルは、ウイルス対策ソフトのスキャンなどで一時的に掴まれていることがある。 */
const LOCK_RETRIES = 12
const LOCK_RETRY_MS = 400

const removeTree = (path) =>
  rm(path, { recursive: true, force: true, maxRetries: LOCK_RETRIES, retryDelay: LOCK_RETRY_MS })

const wait = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms))

/**
 * フォルダの差し替え。
 *
 * 展開し終えた直後はスキャンでファイルが掴まれていることがあり、rename が EBUSY / EPERM で
 * 弾かれる。掴んでいる側が離すまで待てば通るので、諦めずに間隔を置いて試し直す。
 */
async function renameWithRetry(from, to) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      await rename(from, to)
      return
    } catch (err) {
      const retryable = err.code === 'EBUSY' || err.code === 'EPERM' || err.code === 'ENOTEMPTY'
      if (!retryable || attempt >= LOCK_RETRIES) throw err
      await wait(LOCK_RETRY_MS)
    }
  }
}

async function resolveDownload() {
  try {
    const response = await fetch(RELEASE_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'capture-build' },
      signal: AbortSignal.timeout(30_000)
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    const release = await response.json()
    const version = release.tag_name?.replace(/^v/, '')
    const asset = release.assets?.find((candidate) => WINDOWS_ASSET.test(candidate.name))
    if (!version || !asset) throw new Error('Windows 版のアーカイブが見つかりません')

    return { version, url: asset.browser_download_url, size: asset.size }
  } catch (err) {
    console.warn(`  最新版の確認に失敗したため、既知の ${FALLBACK.version} を使います（${err.message}）`)
    return FALLBACK
  }
}

async function download(target) {
  const response = await fetch(target.url, { redirect: 'follow' })
  if (!response.ok || !response.body) throw new Error(`ダウンロードに失敗しました（HTTP ${response.status}）`)

  const total = Number(response.headers.get('content-length') ?? 0) || target.size
  let received = 0
  let lastPrinted = 0

  const source = Readable.fromWeb(response.body)
  source.on('data', (chunk) => {
    received += chunk.length
    const percent = total > 0 ? Math.floor((received / total) * 100) : 0
    if (percent === lastPrinted) return
    lastPrinted = percent
    process.stdout.write(`\r  ダウンロード中 ${percent}%  (${(received / 1024 / 1024).toFixed(1)} MB)`)
  })

  await pipeline(source, createWriteStream(archivePath))
  process.stdout.write('\n')
}

function openZip(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    yauzl.open(path, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) rejectPromise(err ?? new Error('アーカイブを開けませんでした'))
      else resolvePromise(zipfile)
    })
  })
}

async function extract(destination) {
  const zipfile = await openZip(archivePath)
  const root = resolve(destination)
  let done = 0

  await new Promise((resolvePromise, rejectPromise) => {
    const fail = (error) => {
      zipfile.close()
      rejectPromise(error instanceof Error ? error : new Error(String(error)))
    }

    zipfile.on('error', fail)
    zipfile.on('end', resolvePromise)
    zipfile.on('entry', (entry) => {
      const normalized = entry.fileName.replace(/\\/g, '/')
      if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) {
        fail(new Error(`アーカイブに絶対パスのエントリが含まれています: ${entry.fileName}`))
        return
      }

      const target = resolve(join(root, normalized))
      if (target !== root && !target.startsWith(root + '\\') && !target.startsWith(root + '/')) {
        fail(new Error(`アーカイブに展開先の外を指すエントリが含まれています: ${entry.fileName}`))
        return
      }

      const write = async () => {
        if (normalized.endsWith('/')) {
          await mkdir(target, { recursive: true })
          return
        }
        await mkdir(dirname(target), { recursive: true })
        const stream = await new Promise((res, rej) => {
          zipfile.openReadStream(entry, (err, value) => (err || !value ? rej(err) : res(value)))
        })
        await pipeline(stream, createWriteStream(target))
      }

      write()
        .then(() => {
          done += 1
          if (done % 50 === 0) process.stdout.write(`\r  展開中 ${done} / ${zipfile.entryCount} ファイル`)
          zipfile.readEntry()
        })
        .catch(fail)
    })

    zipfile.readEntry()
  })

  process.stdout.write(`\r  展開中 ${done} / ${done} ファイル\n`)
}

/** 取得済みの版。控えが無ければ不明として扱い、次のビルドで書き直させる。 */
function readVersion(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'engine.json'), 'utf8')).version ?? 'unknown'
  } catch {
    return 'unknown'
  }
}

async function main() {
  const executable = join(engineRoot, 'bin', '64bit', 'obs64.exe')

  if (!force && existsSync(executable)) {
    console.log('キャプチャエンジンは取得済みです。取り直す場合は --force を付けてください。')
    // 取得済みでも、ランタイムが揃っていなければここで補う。
    const runtime = await bundleRuntime(engineRoot)
    await writeStamp(engineRoot, readVersion(engineRoot), runtime)
    return
  }

  console.log('キャプチャエンジン（OBS Studio ポータブル）を取得します。')
  const target = await resolveDownload()
  console.log(`  版: ${target.version}`)

  const staging = `${engineRoot}.incoming`
  await mkdir(dirname(archivePath), { recursive: true })
  await removeTree(staging)

  try {
    await download(target)
    await extract(staging)

    // ポータブル指定が無いと、OBS は利用者の既存設定を読み書きしてしまう。
    await writeFile(join(staging, 'portable_mode.txt'), '', 'utf8')

    const runtime = await bundleRuntime(staging)
    await writeStamp(staging, target.version, runtime)

    if (!existsSync(join(staging, 'bin', '64bit', 'obs64.exe'))) {
      throw new Error('展開後に実行ファイルが見つかりませんでした。アーカイブの構成が想定と異なります。')
    }

    // 出来上がってから差し替える。途中で失敗しても、前回取得したものを壊さない。
    await removeTree(engineRoot)
    await renameWithRetry(staging, engineRoot)

    console.log(`完了しました: ${engineRoot}`)
  } finally {
    await rm(archivePath, { force: true, maxRetries: LOCK_RETRIES, retryDelay: LOCK_RETRY_MS })
    await removeTree(staging).catch(() => undefined)
  }
}

main().catch((err) => {
  console.error(`キャプチャエンジンの取得に失敗しました: ${err.message}`)
  process.exit(1)
})
