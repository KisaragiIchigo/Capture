import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createLogger } from './logger'

const log = createLogger('window-bounds')

const run = promisify(execFile)

/** 画面に出ているウィンドウ 1 つぶん。 */
export interface DesktopWindow {
  title: string
  className: string
  /** 実行ファイル名（chrome.exe など）。タイトルが変わる窓を追うための手掛かり。 */
  executable: string
  x: number
  y: number
  width: number
  height: number
  /**
   * 手前にあるものほど小さい。0 が最前面。
   *
   * EnumWindows は前面から順に列挙するため、その順序をそのまま持つ。
   * 画面に置かれているとおりに並べるとき、どちらが上に重なるかはこれで決まる。
   */
  depth: number
}

/**
 * 可視ウィンドウの位置・大きさ・重なりの順を集める。
 *
 * OBS が返すウィンドウの識別子は「タイトル:クラス名:実行ファイル名」で、
 * 画面のどこに置かれているかも、どれが手前にあるかも含まれない。
 * 位置関係を保ったまま並べるには OS へ直接尋ねるほかない。
 *
 * 外枠ではなくクライアント領域を尋ねるのは、取り込む側がそこだけを写すため。
 * 外枠は影とタイトルバーを含み、Windows 11 では影だけで左右に 8px 前後の差が出る。
 * 位置と大きさで基準が違うと、その差のぶん配置がずれる。
 *
 * 取得できなくても録画そのものは成立するため、失敗は空の結果として扱う。
 *
 * 出力の文字コードを UTF-8 へ固定するのは、既定のままだと日本語が化けるため。
 * PowerShell はコンソールのコードページ（日本語環境では CP932）で書き出すが、
 * 受け取る側は UTF-8 として読む。化けたバイトの中に 0x5C（\）が現れると
 * JSON のエスケープとして解釈され、一覧そのものが読めなくなる。
 * 「表」「ソ」「構」など CP932 の 2 バイト目が 0x5C になる文字を含む
 * タイトルは珍しくないため、日本語環境ではほぼ確実に破綻する。
 *
 * DPI を認識させるのは、OBS が取り込む映像と同じ座標系で測るため。
 * 認識しないまま尋ねると、拡大率 150% の画面では実際の 1500px が 1000px として返る。
 * 大きさは OBS の実測、位置はここ、と基準が食い違うと、その比のぶん配置がずれる。
 */
const SCRIPT = [
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  'Add-Type @"',
  'using System;',
  'using System.Text;',
  'using System.Runtime.InteropServices;',
  'public struct RECT { public int Left, Top, Right, Bottom; }',
  'public struct POINT { public int X, Y; }',
  'public class WinEnum {',
  '  public delegate bool Proc(IntPtr h, IntPtr l);',
  '  [DllImport("user32.dll")] public static extern bool EnumWindows(Proc f, IntPtr l);',
  '  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);',
  '  [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);',
  '  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr h);',
  '  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);',
  '  [DllImport("user32.dll")] public static extern bool GetClientRect(IntPtr h, out RECT r);',
  '  [DllImport("user32.dll")] public static extern bool ClientToScreen(IntPtr h, ref POINT p);',
  '  [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr h, out int pid);',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr c);',
  '  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();',
  '}',
  '"@',
  // -4 は PER_MONITOR_AWARE_V2。使えない版では旧 API へ落とす。
  'if (-not [WinEnum]::SetProcessDpiAwarenessContext([IntPtr](-4))) { [void][WinEnum]::SetProcessDPIAware() }',
  // 実行ファイル名はプロセス ID から引く。窓ごとに問い合わせると遅いので、先に一覧を作る。
  '$names = @{}',
  "foreach ($p in Get-Process) { if (-not $names.ContainsKey($p.Id)) { $names[$p.Id] = $p.ProcessName + '.exe' } }",
  '$list = New-Object System.Collections.ArrayList',
  '$cb = [WinEnum+Proc]{',
  '  param($h, $l)',
  '  if ([WinEnum]::IsWindowVisible($h) -and -not [WinEnum]::IsIconic($h)) {',
  '    $len = [WinEnum]::GetWindowTextLength($h)',
  '    if ($len -gt 0) {',
  '      $sb = New-Object System.Text.StringBuilder ($len + 1)',
  '      [void][WinEnum]::GetWindowText($h, $sb, $sb.Capacity)',
  '      $cn = New-Object System.Text.StringBuilder 256',
  '      [void][WinEnum]::GetClassName($h, $cn, $cn.Capacity)',
  '      $r = New-Object RECT',
  '      if ([WinEnum]::GetClientRect($h, [ref]$r)) {',
  '        $pt = New-Object POINT',
  '        $pt.X = 0; $pt.Y = 0',
  '        [void][WinEnum]::ClientToScreen($h, [ref]$pt)',
  // $pid は PowerShell の自動変数なので使えない。別名で受ける。
  '        $owner = 0',
  '        [void][WinEnum]::GetWindowThreadProcessId($h, [ref]$owner)',
  '        [void]$list.Add([PSCustomObject]@{',
  '          title = $sb.ToString(); cls = $cn.ToString(); exe = [string]$names[$owner]',
  '          x = $pt.X; y = $pt.Y',
  '          width = ($r.Right - $r.Left); height = ($r.Bottom - $r.Top)',
  '        })',
  '      }',
  '    }',
  '  }',
  '  return $true',
  '}',
  '[void][WinEnum]::EnumWindows($cb, [IntPtr]::Zero)',
  // @() で必ず配列にする。1 件のときに単体オブジェクトが返ると形が変わる。
  'ConvertTo-Json -InputObject @($list) -Compress'
].join('\n')

/** PowerShell の起動と C# の組み立てには 1 秒強かかる。待ち続けて組み立てを止めない。 */
const TIMEOUT_MS = 8000

/**
 * 画面の外に置かれたものとみなす座標。
 *
 * Windows は最小化した窓を -32000 付近へ退避させる。これを位置として扱うと、
 * 全体を囲む矩形が数万ピクセルに広がり、並べた結果が破綻する。
 */
const OFFSCREEN_LIMIT = -30000

/** これ未満は窓として扱わない。生成直後や隠し窓は 0 に近い寸法を返す。 */
const MIN_SIZE = 16

interface RawWindow {
  title?: unknown
  cls?: unknown
  exe?: unknown
  x?: unknown
  y?: unknown
  width?: unknown
  height?: unknown
}

/**
 * 画面に出ているウィンドウを、前面から順に返す。
 *
 * 失敗しても録画そのものは成立するため、空の一覧として扱う。
 * その場合は並べ方が「画面のまま」から横並びへ落ちる。
 */
export async function readDesktopWindows(): Promise<DesktopWindow[]> {
  const windows: DesktopWindow[] = []

  try {
    const { stdout } = await run(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', SCRIPT],
      { timeout: TIMEOUT_MS, windowsHide: true, maxBuffer: 4 * 1024 * 1024 }
    )

    const parsed: unknown = JSON.parse(stdout.trim() || '[]')
    const rows: RawWindow[] = Array.isArray(parsed) ? parsed : []

    for (const row of rows) {
      const title = typeof row.title === 'string' ? row.title : ''
      const className = typeof row.cls === 'string' ? row.cls : ''
      const executable = typeof row.exe === 'string' ? row.exe : ''
      const x = Number(row.x)
      const y = Number(row.y)
      const width = Number(row.width)
      const height = Number(row.height)

      if (!title) continue
      if (!(width >= MIN_SIZE) || !(height >= MIN_SIZE)) continue
      if (x <= OFFSCREEN_LIMIT || y <= OFFSCREEN_LIMIT) continue

      // 列挙は前面から。並び順がそのまま重なりの深さになる。
      windows.push({ title, className, executable, x, y, width, height, depth: windows.length })
    }

    log.info('ウィンドウの位置を取得しました', { count: windows.length })
  } catch (err) {
    // 位置が分からなくても、並べ方を変えれば録画は成立する。ここで止めない。
    log.warn('ウィンドウの位置を取得できませんでした', err)
  }

  return windows
}
