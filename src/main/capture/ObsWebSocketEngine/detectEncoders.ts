import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { EncoderCapability } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { buildEncoderCapabilities } from './encoderProfile'

const execFileAsync = promisify(execFile)
const log = createLogger('encoder-detect')

/**
 * 搭載 GPU からハードウェアエンコーダの利用可否を推定する。
 *
 * obs-websocket にはエンコーダ一覧を返すリクエストが無いため、GPU ベンダーで判定する。
 * ドライバが古くて実際には使えない場合まではここでは分からず、録画開始時に初めて失敗する。
 * その失敗は CaptureEngineError として UI に出す。
 */
export async function detectEncoders(): Promise<EncoderCapability[]> {
  const vendors = await detectGpuVendors()
  const obsEncoders: string[] = ['obs_x264']

  if (vendors.some((v) => v.includes('nvidia'))) {
    obsEncoders.push('jim_nvenc', 'jim_hevc_nvenc')
  }
  if (vendors.some((v) => v.includes('intel'))) {
    obsEncoders.push('obs_qsv11_v2', 'obs_qsv11_hevc')
  }
  if (vendors.some((v) => v.includes('amd') || v.includes('radeon'))) {
    obsEncoders.push('h264_texture_amf')
  }

  log.info('エンコーダを検出しました', { vendors, obsEncoders })
  return buildEncoderCapabilities(obsEncoders)
}

async function detectGpuVendors(): Promise<string[]> {
  try {
    const { stdout } = await execFileAsync(
      'powershell.exe',
      [
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        '(Get-CimInstance Win32_VideoController).Name'
      ],
      { windowsHide: true, timeout: 10_000 }
    )
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim().toLowerCase())
      .filter((line) => line.length > 0)
  } catch (err) {
    log.warn('GPU の検出に失敗しました。ソフトウェアエンコードのみを提示します', err)
    return []
  }
}
