/** ミリ秒を HH:MM:SS へ。24 時間を超えても時間側を伸ばして表示する。 */
export function formatTimecode(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

/** バイト数を人が読める単位へ。小数 1 桁で丸める。 */
export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 MB'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** exponent
  return `${value.toFixed(exponent >= 2 ? 1 : 0)} ${units[exponent]}`
}

/** ビットレートの表示。1000 kbps 以上は Mbps へ繰り上げる。 */
export function formatBitrate(kbps: number): string {
  return kbps >= 1000 ? `${(kbps / 1000).toFixed(1)} Mbps` : `${kbps} kbps`
}

/** 音量倍率 (0-1) を dB 表記へ。0 は無音として扱う。 */
export function formatVolumeDb(volume: number): string {
  if (volume <= 0.0001) return '-∞ dB'
  const db = 20 * Math.log10(volume)
  return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`
}

/** ドロップ率。分母が 0 のときは 0% を返す。 */
export function droppedRatio(dropped: number, total: number): number {
  if (total <= 0) return 0
  return dropped / total
}
