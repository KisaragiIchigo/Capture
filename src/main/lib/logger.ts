import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { logDirectory } from './paths'

type Level = 'info' | 'warn' | 'error'

let logFile: string | null = null

/**
 * ファイルへ書くかどうか。null は設定を読む前。
 *
 * 起動して最初の数行は、設定が確定するより先に出る。そこで書いてしまうと、
 * 保存しない設定なのにファイルだけができる。かといって捨てると、
 * 設定の読み込みそのものが失敗した記録まで消える。確定するまでは溜めておく。
 */
let fileLogging: boolean | null = null

/** 設定が確定するまでの控え。確定した時点で書き出すか捨てるかが決まる。 */
const pending: string[] = []

/** 溜めておく上限。確定が来ないまま増え続けても、メモリを圧迫しない量で頭打ちにする。 */
const PENDING_LIMIT = 200

function target(): string {
  if (logFile) return logFile
  const dir = logDirectory()
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  logFile = join(dir, `capture-${stamp}.log`)
  return logFile
}

function append(line: string): void {
  try {
    appendFileSync(target(), line, 'utf8')
  } catch {
    // ログの書き込み失敗でアプリを落とさない。標準出力には既に出ている。
  }
}

/**
 * ファイルへの保存を切り替える。設定を読み終えた時点で一度呼ぶ。
 * 保存する場合は、それまでに溜めた行もまとめて書き出す。
 */
export function configureFileLogging(enabled: boolean): void {
  fileLogging = enabled

  if (enabled) for (const line of pending) append(line)
  pending.length = 0
}

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] (${scope}) ${message}${
    detail === undefined ? '' : ` :: ${formatDetail(detail)}`
  }\n`
  process.stdout.write(line)

  if (fileLogging === null) {
    if (pending.length < PENDING_LIMIT) pending.push(line)
    return
  }

  if (!fileLogging) return
  append(line)
}

function formatDetail(detail: unknown): string {
  if (detail instanceof Error) return `${detail.name}: ${detail.message}`
  if (typeof detail === 'string') return detail
  try {
    return JSON.stringify(detail)
  } catch {
    return String(detail)
  }
}

export function createLogger(scope: string) {
  return {
    info: (message: string, detail?: unknown) => write('info', scope, message, detail),
    warn: (message: string, detail?: unknown) => write('warn', scope, message, detail),
    error: (message: string, detail?: unknown) => write('error', scope, message, detail)
  }
}
