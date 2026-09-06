import { useCallback, useEffect, useRef, useState } from 'react'
import type { AppSettings, CaptureProfile } from '@shared/types'

export interface FinderSettings {
  /** 読み込めるまでは null。その間は設定に触る操作を出さない。 */
  profile: CaptureProfile | null
  patchProfile: (patch: (profile: CaptureProfile) => CaptureProfile) => void
}

/**
 * ファインダーから設定を読み書きする。
 *
 * ファインダーはメインウィンドウとは別の窓で、store を共有しない。設定の実体は Main が持ち、
 * 保存すると書き換えた窓以外へ通知が配られる。ここではその通知で手元の写しを更新するだけにし、
 * 受け取った値を保存し直さない。往復させると、片方で入力中の値をもう片方の古い値で上書きする。
 *
 * 手元の写しは ref を正とし、state は表示のために持つ。保存を state の更新関数の中で行うと、
 * React が更新関数を二重に呼ぶ場面で保存も二度走り、そのたびにソースが組み直される。
 */
export function useFinderSettings(): FinderSettings {
  const [settings, setSettingsState] = useState<AppSettings | null>(null)
  const settingsRef = useRef<AppSettings | null>(null)

  const adopt = useCallback((next: AppSettings) => {
    settingsRef.current = next
    setSettingsState(next)
  }, [])

  useEffect(() => {
    window.capture.settings
      .load()
      .then(adopt)
      .catch(() => {
        // 読めなければ設定に触る操作を出さないだけ。バーの他の機能は使える。
      })

    return window.capture.events.onSettingsChanged(adopt)
  }, [adopt])

  const patchProfile = useCallback(
    (patch: (profile: CaptureProfile) => CaptureProfile) => {
      const current = settingsRef.current
      if (!current) return

      const next: AppSettings = { ...current, profile: patch(current.profile) }
      adopt(next)
      void window.capture.settings.save(next).catch(() => {
        // 保存に失敗しても Main 側の設定は変わらない。次の通知で正しい値へ戻る。
      })
    },
    [adopt]
  )

  return { profile: settings?.profile ?? null, patchProfile }
}
