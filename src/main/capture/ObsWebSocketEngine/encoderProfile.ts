import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { EncoderCapability, EncoderId, VideoConfig } from '@shared/types'
import { obsConfigDir } from '@main/lib/paths'

/** アプリ内 EncoderId と OBS 内部のエンコーダ識別子の対応表。 */
const OBS_ENCODER_ID: Record<EncoderId, string> = {
  nvenc_h264: 'jim_nvenc',
  nvenc_hevc: 'jim_hevc_nvenc',
  qsv_h264: 'obs_qsv11_v2',
  qsv_hevc: 'obs_qsv11_hevc',
  amf_h264: 'h264_texture_amf',
  x264: 'obs_x264'
}

const ENCODER_LABEL: Record<EncoderId, string> = {
  nvenc_h264: 'NVIDIA NVENC H.264',
  nvenc_hevc: 'NVIDIA NVENC HEVC',
  qsv_h264: 'Intel QuickSync H.264',
  qsv_hevc: 'Intel QuickSync HEVC',
  amf_h264: 'AMD AMF H.264',
  x264: 'x264（CPU ソフトウェア）'
}

/**
 * OBS が実際に読み込めたエンコーダ ID の一覧から、UI に出す選択肢を組み立てる。
 * x264 は常に存在するため、ハードウェアエンコーダが 1 つも無い環境でも選択肢が空にならない。
 */
export function buildEncoderCapabilities(availableObsEncoders: string[]): EncoderCapability[] {
  const available = new Set(availableObsEncoders)
  return (Object.keys(OBS_ENCODER_ID) as EncoderId[]).map((id) => {
    const obsId = OBS_ENCODER_ID[id]
    const ok = available.has(obsId)
    const capability: EncoderCapability = {
      id,
      label: ENCODER_LABEL[id],
      hardware: id !== 'x264',
      available: ok
    }
    if (!ok) {
      capability.unavailableReason =
        'この PC の GPU またはドライバが対応していないため、選択できません。'
    }
    return capability
  })
}

export function toObsEncoderId(id: EncoderId): string {
  return OBS_ENCODER_ID[id]
}

/** OBS のレートコントロール表記。cqp のみエンコーダによって CQP / CRF に分かれる。 */
function rateControlValue(video: VideoConfig): string {
  if (video.rateControl === 'cbr') return 'CBR'
  if (video.rateControl === 'vbr') return 'VBR'
  return video.encoder === 'x264' ? 'CRF' : 'CQP'
}

/**
 * エンコーダ固有設定を recordEncoder.json として書き出す。
 *
 * obs-websocket にはエンコーダ個別設定を触る汎用リクエストが無いため、
 * ポータブル構成の profile ディレクトリへ直接書いてから OBS を起動する。
 * このファイルは OBS 起動時にしか読まれないので、エンコーダ種別の変更には再起動が要る。
 */
export function writeRecordEncoderSettings(profileName: string, video: VideoConfig): void {
  const dir = join(obsConfigDir(), 'basic', 'profiles', profileName)
  mkdirSync(dir, { recursive: true })

  const base: Record<string, unknown> = {
    bitrate: video.bitrateKbps,
    rate_control: rateControlValue(video),
    keyint_sec: video.keyframeIntervalSec
  }

  if (video.rateControl === 'cqp') {
    if (video.encoder === 'x264') base['crf'] = video.cqp
    else base['cqp'] = video.cqp
  }

  switch (video.encoder) {
    case 'nvenc_h264':
    case 'nvenc_hevc':
      // p5 は品質と負荷の釣り合いが最も良い。multipass はゲーム録画で 1 割ほど負荷が増えるため無効。
      Object.assign(base, {
        preset2: 'p5',
        tune: 'hq',
        multipass: 'disabled',
        profile: 'high',
        lookahead: false,
        psycho_aq: true,
        bf: 2
      })
      break
    case 'qsv_h264':
    case 'qsv_hevc':
      Object.assign(base, { target_usage: 'balanced', profile: 'high' })
      break
    case 'amf_h264':
      Object.assign(base, { preset: 'quality', profile: 'high' })
      break
    case 'x264':
      // veryfast より重い preset は 1080p60 でフレーム落ちを招くため上限とする。
      Object.assign(base, { preset: 'veryfast', profile: 'high', tune: 'zerolatency' })
      break
  }

  writeFileSync(join(dir, 'recordEncoder.json'), JSON.stringify(base, null, 2), 'utf8')
}
