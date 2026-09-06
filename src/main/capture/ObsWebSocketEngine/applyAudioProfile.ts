import type { OBSWebSocket } from 'obs-websocket-js'
import type { AudioConfig, AudioInputConfig } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { SCENE_NAME, SOURCE_NAME } from './obsProfile'
import { removeInputAndWait } from './removeInput'
import { ensureInput } from './ensureInput'

const log = createLogger('obs-audio')

/** システム音をトラック 1、マイクをトラック 2 に割り当てる。編集時に分離できる形。 */
const TRACK = { system: 1, microphone: 2 } as const

async function buildAudioInput(
  obs: OBSWebSocket,
  inputName: string,
  inputKind: string,
  config: AudioInputConfig,
  track: number,
  separateTracks: boolean
): Promise<void> {
  // 無効にした音声は残しておくと録音され続けるので、そのときだけ確実に消す。
  if (!config.enabled) {
    await removeInputAndWait(obs, inputName)
    return
  }

  await ensureInput(obs, SCENE_NAME, inputName, inputKind, { device_id: config.deviceId })

  // 分離しない場合は両方をトラック 1 へまとめる。
  const assignedTrack = separateTracks ? track : 1
  await obs.call('SetInputAudioTracks', {
    inputName,
    inputAudioTracks: { [assignedTrack]: true } as Record<string, boolean>
  })

  await obs.call('SetInputVolume', { inputName, inputVolumeMul: config.volume })
  await obs.call('SetInputMute', { inputName, inputMuted: config.muted })
}

/**
 * 音声入力を作り直す。
 *
 * OBS 既定の「デスクトップ音声」「マイク」ソースは使わず、アプリ管理下の 2 本だけを置く。
 * 既定ソースを併用すると同じ音が二重に乗り、音量が 2 倍になったように聞こえる事故が起きる。
 */
export async function applyAudioProfile(obs: OBSWebSocket, audio: AudioConfig): Promise<void> {
  await buildAudioInput(
    obs,
    SOURCE_NAME.systemAudio,
    'wasapi_output_capture',
    audio.system,
    TRACK.system,
    audio.separateTracks
  )
  await buildAudioInput(
    obs,
    SOURCE_NAME.microphone,
    'wasapi_input_capture',
    audio.microphone,
    TRACK.microphone,
    audio.separateTracks
  )

  log.info('音声入力を構築しました', {
    system: audio.system.enabled,
    microphone: audio.microphone.enabled,
    separateTracks: audio.separateTracks
  })
}
