import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { obsBinDir } from '@main/lib/paths'

/**
 * OBS が動くための Visual C++ ランタイムがあるかを確かめる。
 *
 * OBS 本体は Visual C++ でビルドされており、実行にはそのランタイムが要る。公式の
 * インストーラはこれを一緒に入れるが、配布されているポータブル版の zip には入っていない。
 * 開発に使っている PC には Visual Studio や他のアプリが入れた同じものが既にあるため、
 * 手元では何の問題も起きず、まっさらな PC でだけ「起動しない」という形で表面化する。
 *
 * DLL が無いと obs64.exe は自分のエラーを出す間もなく終了する。アプリからは
 * 「接続できない」としか見えないため、接続を待つ前にここで見分ける。
 */

/** OBS 本体とプラグインが必要とするランタイム。 */
const REQUIRED_DLLS = [
  'vcruntime140.dll',
  'vcruntime140_1.dll',
  'msvcp140.dll',
  'msvcp140_1.dll',
  'msvcp140_2.dll'
]

/**
 * 見つからないランタイムを返す。すべて揃っていれば空になる。
 *
 * 実行ファイルと同じ場所を先に見るのは、Windows の DLL 検索がそこを優先するため。
 * アプリに同梱したものがあれば、PC 側に入っていなくても動く。
 */
export function missingRuntimeDlls(): string[] {
  const local = obsBinDir()
  const system = join(process.env['SystemRoot'] ?? 'C:\\Windows', 'System32')

  return REQUIRED_DLLS.filter(
    (dll) => !existsSync(join(local, dll)) && !existsSync(join(system, dll))
  )
}

/** 案内に載せる入手先。Microsoft が配布している x64 版の固定 URL。 */
export const VC_REDIST_URL = 'https://aka.ms/vs/17/release/vc_redist.x64.exe'
