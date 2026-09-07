import { useEffect, useState, type ReactElement } from 'react'
import type { AppInfo, EngineState } from '@shared/types'
import { Panel } from '@renderer/components/ui/Panel'

interface AboutPageProps {
  engine: EngineState
}

export function AboutPage({ engine }: AboutPageProps): ReactElement {
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    let alive = true
    window.capture.system
      .getAppInfo()
      .then((next) => {
        if (alive) setInfo(next)
      })
      .catch(() => {
        // 取得できなくても画面は成立する。空欄のままにする。
      })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="grid grid-cols-1 items-start gap-2 lg:grid-cols-2">
      <Panel title="Capture">
        <p className="text-fluid-xs leading-relaxed text-slate-400">
          Windows 向けの画面 / ゲーム録画ソフトです。キャプチャーには OBS のエンジンを利用しています。
        </p>

        <dl className="mt-3 flex flex-col gap-1.5">
          <InfoRow label="バージョン" value={info?.version ?? '—'} />
          <InfoRow label="Electron" value={info?.electronVersion ?? '—'} />
          <InfoRow label="プラットフォーム" value={info?.platform ?? '—'} />
          <InfoRow label="キャプチャーエンジン" value={engine.backendVersion ?? '未接続'} />
        </dl>
      </Panel>

      <Panel title="ライセンス">
        <p className="text-fluid-xs leading-relaxed text-slate-400">
          キャプチャーエンジンとして OBS Studio（GPL v2）を別プロセスとして同梱し、WebSocket
          経由で制御しています。同梱している OBS はポータブル構成のため、お使いの PC に個別に
          インストールされた OBS の設定には影響しません。
        </p>
      </Panel>
    </div>
  )
}

interface InfoRowProps {
  label: string
  value: string
}

function InfoRow({ label, value }: InfoRowProps): ReactElement {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="rail-label">{label}</dt>
      <dd className="tabular text-fluid-xs text-slate-300">{value}</dd>
    </div>
  )
}
