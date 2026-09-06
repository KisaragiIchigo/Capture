import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { logDirectory } from './paths'

type Level = 'info' | 'warn' | 'error'

let logFile: string | null = null

function target(): string {
  if (logFile) return logFile
  const dir = logDirectory()
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().slice(0, 10)
  logFile = join(dir, `capture-${stamp}.log`)
  return logFile
}

function write(level: Level, scope: string, message: string, detail?: unknown): void {
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] (${scope}) ${message}${
    detail === undefined ? '' : ` :: ${formatDetail(detail)}`
  }\n`
  process.stdout.write(line)
  try {
    appendFileSync(target(), line, 'utf8')
  } catch {
    // ログの書き込み失敗でアプリを落とさない。標準出力には既に出ている。
  }
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
