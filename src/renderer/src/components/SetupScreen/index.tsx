import type { ReactElement } from 'react'
import { AlertTriangle, Download, FileText, HardDriveDownload, Loader2 } from 'lucide-react'
import { m } from 'framer-motion'
import type { SetupProgress } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { cn } from '@renderer/lib/cn'
import { formatBytes } from '@renderer/lib/format'

interface SetupScreenProps {
  progress: SetupProgress
  installing: boolean
  /** エンジンがこのアプリに同梱されているかどうか。導入にネットワークが要るかが変わる。 */
  bundled: boolean
  onInstall: () => void
  onCancel: () => void
  onOpenLogFolder: () => void
}

/** 段階ごとの見出し。何を待っているのかが分からない時間を作らない。 */
const PHASE_LABEL: Record<SetupProgress['phase'], string> = {
  idle: '準備ができていません',
  resolving: '最新版を確認しています…',
  downloading: 'ダウンロードしています…',
  extracting: '展開しています…',
  copying: '同梱されたエンジンを配置しています…',
  verifying: '確認しています…',
  done: '準備が完了しました',
  error: '準備に失敗しました'
}

/**
 * キャプチャエンジンの初回セットアップ。
 *
 * エンジンが無いと録画に関する設定はすべて意味を持たないため、
 * 用意できるまでは他の画面を出さずにここへ集中させる。
 */
export function SetupScreen({
  progress,
  installing,
  bundled,
  onInstall,
  onCancel,
  onOpenLogFolder
}: SetupScreenProps): ReactElement {
  const failed = progress.phase === 'error'
  const indeterminate = installing && progress.ratio === 0 && progress.phase !== 'downloading'

  return (
    <div className="flex flex-1 items-center justify-center p-6">
      <div className="panel flex w-full max-w-xl flex-col gap-5 px-6 py-7">
        <div className="flex items-start gap-3.5">
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border',
              failed
                ? 'border-rose-500/20 bg-rose-500/10 text-rose-300'
                : 'border-teal-500/20 bg-teal-500/10 text-teal-300'
            )}
          >
            {failed ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <HardDriveDownload className="h-5 w-5" />
            )}
          </span>

          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-fluid-lg font-semibold text-slate-100">
              キャプチャーエンジンの準備
            </h2>
            <p className="text-fluid-xs leading-relaxed text-slate-400">
              {bundled
                ? '録画には OBS Studio のエンジンを使用します。エンジンはこのアプリに同梱されているため、ダウンロードは発生しません。書き込みできる場所へ配置するだけで完了します。配置したファイルはこのアプリの中だけで使用し、お使いの PC に別途インストールされた OBS の設定には一切影響しません。'
                : '録画には OBS Studio のエンジンを使用します。初回のみ、約 180MB のダウンロードが発生します。取得したファイルはこのアプリの中だけで使用し、お使いの PC に別途インストールされた OBS の設定には一切影響しません。'}
            </p>
          </div>
        </div>

        {installing || failed ? (
          <div className="flex flex-col gap-2 rounded-md border border-white/[0.06] bg-black/30 px-3.5 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-fluid-xs text-slate-300">
                {installing ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-300" />
                ) : null}
                {PHASE_LABEL[progress.phase]}
              </span>

              {progress.phase === 'downloading' && progress.totalBytes > 0 ? (
                <span className="tabular text-fluid-2xs text-slate-400">
                  {formatBytes(progress.receivedBytes)} / {formatBytes(progress.totalBytes)}
                </span>
              ) : progress.phase === 'extracting' && progress.totalBytes > 0 ? (
                <span className="tabular text-fluid-2xs text-slate-400">
                  {progress.receivedBytes} / {progress.totalBytes} ファイル
                </span>
              ) : null}
            </div>

            {installing ? (
              <div className="h-1 w-full overflow-hidden rounded-full bg-black/50 shadow-inset-well">
                {indeterminate ? (
                  // 総量が分からない段階は、止まっていないことだけを伝える。
                  <m.div
                    className="h-full w-1/3 rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                    animate={{ x: ['-100%', '300%'] }}
                    transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                  />
                ) : (
                  <m.div
                    className="h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                    animate={{ width: `${Math.round(progress.ratio * 100)}%` }}
                    transition={{ duration: 0.25 }}
                  />
                )}
              </div>
            ) : null}

            {failed && progress.message ? (
              <p className="text-fluid-xs leading-relaxed text-rose-200">{progress.message}</p>
            ) : null}
          </div>
        ) : null}

        <div className="flex items-center gap-2.5">
          {installing ? (
            <Button variant="ghost" onClick={onCancel}>
              中止する
            </Button>
          ) : (
            <Button variant="primary" onClick={onInstall} icon={<Download className="h-3.5 w-3.5" />}>
              {failed ? 'もう一度試す' : 'エンジンを準備する'}
            </Button>
          )}

          {/* 画面のメッセージだけでは原因まで辿れないことがある。持ち出せる記録への道を残す。 */}
          {failed ? (
            <Button
              variant="ghost"
              onClick={onOpenLogFolder}
              icon={<FileText className="h-3.5 w-3.5" />}
            >
              ログを開く
            </Button>
          ) : null}
        </div>

        <p className="text-fluid-xs leading-relaxed text-slate-400">
          {bundled
            ? '配置にはネットワーク接続を必要としません。失敗する場合は、セキュリティ対策ソフトがこのアプリのファイルを隔離していないかをご確認ください。'
            : 'ダウンロードは GitHub の OBS Studio 公式リリースから行います。社内ネットワークなどで接続がうまくいかない場合は、ネットワーク設定をご確認ください。'}
        </p>
      </div>
    </div>
  )
}
