import type { ReactElement } from 'react'
import { Camera } from 'lucide-react'
import { m } from 'framer-motion'
import { SHOT_NOTICE_MS } from '@shared/types'
import { useShutterFlash } from '@renderer/hooks/useShutterFlash'

/**
 * 静止画が撮れたことを知らせる札。
 *
 * 窓の出し入れは Main が持つ。録画対象と重なる場所にしか出せないときは
 * そもそも窓が出ないため、ここでは届いた通知をそのまま描くことに専念する。
 *
 * 出す内容はファイル名にする。光るだけでは「撮れた気がする」で終わるが、
 * 実際に書けたファイルの名前が出れば、撮れたことと保存先を一度に確かめられる。
 */
export function ShotToast(): ReactElement | null {
  const { flashKey, fileName } = useShutterFlash()

  if (!fileName) return null

  return (
    <m.div
      key={flashKey}
      initial={{ opacity: 0, y: 6 }}
      // 消え際は窓が隠れるより先に薄れ切らせる。窓の消滅で断ち切ると途切れて見える。
      animate={{ opacity: [0, 1, 1, 0], y: [6, 0, 0, 0] }}
      transition={{ duration: SHOT_NOTICE_MS / 1000, times: [0, 0.08, 0.78, 1], ease: 'easeOut' }}
      className={[
        'flex h-full w-full items-center gap-2 rounded-md border border-teal-400/25',
        'bg-base-alt/95 px-3 shadow-accent-glow backdrop-blur-md'
      ].join(' ')}
    >
      <Camera className="h-3.5 w-3.5 shrink-0 text-teal-300" />
      <span className="tabular truncate text-fluid-2xs text-slate-200">{fileName}</span>
    </m.div>
  )
}
