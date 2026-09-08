import type { BrowserWindow } from 'electron'

/**
 * 窓を録画とスクリーンショットから外す。
 *
 * 操作のためだけに画面へ浮かべている窓（道具のパレット、ファインダーの操作バー）は、
 * 録りたい対象ではない。置き場所で避ける方法はフルスクリーンの取り込みでは成立しない。
 * モニタに映るものがすべて録画対象になるため、範囲の外という場所がそもそも無い。
 *
 * Windows では SetWindowDisplayAffinity（WDA_EXCLUDEFROMCAPTURE）が呼ばれ、
 * 画面には出るのに録画・静止画・スクリーンショットのいずれにも入らない窓になる。
 *
 * 除外の単位はウィンドウなので、録りたいものと同じ窓に入れてはならない。
 * 描き込みの canvas やレーザーポインターは映ることが目的なので、掛けない。
 */
export function excludeFromCapture(window: BrowserWindow): void {
  if (!supportsCaptureExclusion()) return

  window.setContentProtection(true)
}

/**
 * 窓をキャプチャから外せるか。
 *
 * WDA_EXCLUDEFROMCAPTURE が効くのは Windows 10 2004（build 19041）以降。
 * それ以前は WDA_MONITOR と同じ扱いになり、除外ではなく黒い矩形として録画へ入る。
 * 写り込むより黒く塗り潰されるほうが悪いので、古い環境では掛けない。
 */
function supportsCaptureExclusion(): boolean {
  if (process.platform !== 'win32') return false

  const build = Number(process.getSystemVersion().split('.')[2])
  return Number.isFinite(build) && build >= 19041
}
