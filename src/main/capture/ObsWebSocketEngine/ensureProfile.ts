import type { OBSWebSocket } from 'obs-websocket-js'
import { createLogger } from '@main/lib/logger'
import { PROFILE_NAME } from './obsProfile'

const log = createLogger('obs-profile')

/**
 * 録画設定を書き込んだプロファイルへ切り替える。
 *
 * global.ini に Profile を書くだけでは足りない。OBS は終了時に自分の状態で
 * global.ini を上書きするため、こちらが起動前に書いた指定が次の起動で消える。
 * その結果、既定の「無題」プロファイルのまま動き、basic.ini に書いた
 * 出力モード・エンコーダ・保存先が丸ごと無視される。
 *
 * 接続後に明示して切り替えれば、どの経路で起動しても同じ設定に揃う。
 */
export async function ensureProfile(obs: OBSWebSocket): Promise<void> {
  const { currentProfileName, profiles } = await obs.call('GetProfileList')

  if (currentProfileName === PROFILE_NAME) return

  if (!profiles.includes(PROFILE_NAME)) {
    // ディレクトリを置いただけでは認識されない構成に備える。
    await obs.call('CreateProfile', { profileName: PROFILE_NAME })
    log.info('プロファイルを作成しました', { profile: PROFILE_NAME })
  }

  await obs.call('SetCurrentProfile', { profileName: PROFILE_NAME })
  log.info('プロファイルを切り替えました', { from: currentProfileName, to: PROFILE_NAME })
}
