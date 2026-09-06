import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { CaptureProfile } from '@shared/types'
import { obsConfigDir, obsWebSocketConfigFile } from '@main/lib/paths'
import { toObsEncoderId } from './encoderProfile'

export const PROFILE_NAME = 'Capture'
export const SCENE_NAME = 'Capture'

/** 録画対象ソースにアプリ側で固定名を付ける。OBS 内の名前を境界の外へ出さないため。 */
export const SOURCE_NAME = {
  video: 'capture-video',
  systemAudio: 'capture-system-audio',
  microphone: 'capture-microphone'
} as const

/** アプリの書式と OBS の書式の対応。 */
const FILENAME_TOKENS: Record<string, string> = {
  Y: '%CCYY',
  m: '%MM',
  d: '%DD',
  H: '%hh',
  M: '%mm',
  S: '%ss'
}

/**
 * アプリのファイル名テンプレート（%Y など）を OBS の書式へ変換する。
 *
 * 逐次置換にしてはいけない。%m を %MM にした直後に %M を %mm へ置換すると、
 * 生成したばかりの %MM の先頭が食われて %mmM になり、月が分に化ける。
 * 1 回のスキャンで置き換え、置換結果を再走査しない。
 */
export function toObsFilenameFormat(template: string): string {
  return template.replace(/%([YmdHMS])/g, (whole, token: string) => FILENAME_TOKENS[token] ?? whole)
}

function iniSection(name: string, entries: Record<string, string | number | boolean>): string {
  const body = Object.entries(entries)
    .map(([key, value]) => `${key}=${typeof value === 'boolean' ? String(value) : value}`)
    .join('\n')
  return `[${name}]\n${body}\n`
}

/**
 * OBS を初回セットアップウィザード無しで、こちらの意図した構成のまま起動させるための global.ini。
 * FirstRun を立てないとウィザードが前面に出てきて、ユーザーから見て正体不明の窓が開く。
 */
export function writeGlobalConfig(): void {
  const dir = obsConfigDir()
  mkdirSync(dir, { recursive: true })

  const content = [
    iniSection('General', {
      FirstRun: true,
      EnableAutoUpdates: false,
      ConfirmOnExit: false,
      HotkeyFocusType: 'NeverDisableHotkeys'
    }),
    iniSection('Basic', {
      Profile: PROFILE_NAME,
      ProfileDir: PROFILE_NAME
    }),
    iniSection('BasicWindow', {
      SysTrayEnabled: true,
      SysTrayWhenStarted: true,
      SysTrayMinimizeToTray: true,
      WarnBeforeStartingStream: false,
      WarnBeforeStoppingStream: false,
      WarnBeforeStoppingRecord: false,
      ShowTransitions: false
    })
  ].join('\n')

  writeFileSync(join(dir, 'global.ini'), content, 'utf8')
}

/**
 * obs-websocket のサーバーを有効にする。
 *
 * OBS 28 以降、WebSocket サーバーは既定で無効になっている。
 * コマンドラインの --websocket_port はポート番号を上書きするだけで、
 * サーバー自体は起動しない。有効化はこの設定ファイルでしか行えない。
 */
export function writeWebSocketConfig(port: number, password: string): void {
  const file = obsWebSocketConfigFile()
  mkdirSync(dirname(file), { recursive: true })

  writeFileSync(
    file,
    JSON.stringify(
      {
        server_enabled: true,
        server_port: port,
        auth_required: true,
        server_password: password,
        // 初回起動時の案内ダイアログを出させない。前面に出ると操作を奪われる。
        first_load: false,
        alerts_enabled: false
      },
      null,
      2
    ),
    'utf8'
  )
}

/**
 * 録画設定を basic.ini として書き出す。
 *
 * Advanced 出力モードを使うのは、Simple モードだと画質が RecQuality の 4 段階に丸められ、
 * ビットレートを直接指定できないため。RecTracks はビットマスクで、1=トラック1、2=トラック2。
 */
export function writeBasicProfile(profile: CaptureProfile, canvas: { width: number; height: number }): void {
  const dir = join(obsConfigDir(), 'basic', 'profiles', PROFILE_NAME)
  mkdirSync(dir, { recursive: true })

  const outputWidth = profile.video.outputWidth ?? canvas.width
  const outputHeight = profile.video.outputHeight ?? canvas.height
  const recTracks = profile.audio.separateTracks ? 3 : 1

  const content = [
    iniSection('General', { Name: PROFILE_NAME }),
    iniSection('Video', {
      BaseCX: canvas.width,
      BaseCY: canvas.height,
      OutputCX: outputWidth,
      OutputCY: outputHeight,
      FPSType: 1,
      FPSInt: profile.video.fps,
      ScaleType: 'bicubic',
      ColorFormat: 'NV12',
      ColorSpace: '709',
      ColorRange: 'Partial'
    }),
    iniSection('Audio', {
      SampleRate: 48000,
      ChannelSetup: 'Stereo',
      // OBS 既定のグローバル音声を全て無効にする。有効なままだと、
      // applyAudioProfile が作る専用ソースと同じ音が二重に乗る。
      Desktop1Device: 'disabled',
      Desktop2Device: 'disabled',
      AuxDevice1: 'disabled',
      AuxDevice2: 'disabled',
      AuxDevice3: 'disabled',
      AuxDevice4: 'disabled'
    }),
    iniSection('Output', {
      Mode: 'Advanced',
      FilenameFormatting: toObsFilenameFormat(profile.filenameTemplate)
    }),
    iniSection('AdvOut', {
      RecType: 'Standard',
      RecFilePath: profile.outputDirectory,
      RecFormat2: profile.video.container,
      RecEncoder: toObsEncoderId(profile.video.encoder),
      RecRescale: false,
      RecTracks: recTracks,
      RecSplitFile: false,
      FFOutputToFile: true
    })
  ].join('\n')

  writeFileSync(join(dir, 'basic.ini'), content, 'utf8')
}
