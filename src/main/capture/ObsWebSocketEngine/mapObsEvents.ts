import type { OBSWebSocket } from 'obs-websocket-js'
import type { EngineStatus, RecordingStats } from '@shared/types'

/** OBS の録画状態文字列を、アプリのエンジン状態へ写す。 */
export function toEngineStatus(outputState: string): EngineStatus | null {
  switch (outputState) {
    case 'OBS_WEBSOCKET_OUTPUT_STARTED':
      return 'recording'
    case 'OBS_WEBSOCKET_OUTPUT_PAUSED':
      return 'paused'
    case 'OBS_WEBSOCKET_OUTPUT_RESUMED':
      return 'recording'
    case 'OBS_WEBSOCKET_OUTPUT_STOPPING':
      return 'stopping'
    case 'OBS_WEBSOCKET_OUTPUT_STOPPED':
      return 'ready'
    default:
      // STARTING など、UI の見た目を変える必要がない中間状態は無視する。
      return null
  }
}

/**
 * 録画中に 1 秒ごとの実測値を集める。
 *
 * GetStats と GetRecordStatus は別リクエストなので、2 本まとめて投げて 1 つの塊にする。
 * 片方だけ失敗したときに部分的な値を UI へ出さないよう、失敗したらまとめて捨てる。
 */
export async function collectStats(obs: OBSWebSocket): Promise<RecordingStats> {
  const [stats, record] = await Promise.all([obs.call('GetStats'), obs.call('GetRecordStatus')])

  return {
    durationMs: record.outputDuration,
    bytesWritten: record.outputBytes,
    fps: stats.activeFps,
    droppedFrames: stats.outputSkippedFrames,
    totalFrames: stats.outputTotalFrames,
    cpuUsage: stats.cpuUsage,
    // OBS はメガバイト単位の小数で返すためバイトへ揃える。
    freeDiskBytes: Math.round(stats.availableDiskSpace * 1024 * 1024)
  }
}
