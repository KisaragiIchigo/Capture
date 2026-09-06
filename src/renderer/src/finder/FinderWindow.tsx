import { useCallback, type ReactElement } from 'react'
import { FINDER_BORDER, FINDER_OUTSET } from '@shared/types'
import { useShutterFlash } from '@renderer/hooks/useShutterFlash'
import { useFinderSettings } from './parts/useFinderSettings'
import { FinderBar } from './parts/FinderBar'
import { ResizeEdges } from './parts/ResizeEdges'
import { useClickThrough } from './parts/useClickThrough'
import { useFinderDrag } from './parts/useFinderDrag'
import { useFinderState } from './parts/useFinderState'

/**
 * ファインダーの組み立て。
 *
 * 取り込み方によって姿が 2 つある。
 *   範囲指定 … 操作バー + 枠。中央のくり抜きが録画範囲そのもので、そこはクリックスルーさせる。
 *              枠線と掴み代は範囲の外側にあるので、枠自体が映像へ写り込むことはない。
 *   それ以外 … 操作バーだけ。録画範囲は画面や別ウィンドウが決めるため、枠を描く意味がない。
 *              それでも録画の開始と停止、描き込みへの入口は手元に要るのでバーは残す。
 */
export function FinderWindow(): ReactElement {
  const { dragging, start: startDrag } = useFinderDrag()
  // 掴んでいる間はクリックスルーの切り替えを止め、mouseup を確実に受け取る。
  useClickThrough(dragging)
  const { engine, stats, size, drawingVisible, sourceKind } = useFinderState()
  // 撮影はホットキーやメインウィンドウからも起きる。自分が押したときだけでなく、
  // どこから撮られても同じ合図を出せるよう Main からの通知を見る。
  const shutter = useShutterFlash()
  // 入力と重ね合わせの切り替えをバーからも触れるようにする。実体は Main が持つ。
  const { profile, patchProfile } = useFinderSettings()

  const framed = sourceKind === 'region'
  const isRecording = engine.status === 'recording'
  const isPaused = engine.status === 'paused'
  const isActive = isRecording || isPaused

  const toggleRecording = useCallback(async () => {
    if (isActive) {
      await window.capture.capture.stop()
      return
    }

    // 枠を動かすたびに Main 側が設定を書き換えているので、開始直前に読み直すのが最新。
    const settings = await window.capture.settings.load()
    await window.capture.capture.start(settings.profile)
  }, [isActive])

  const togglePause = useCallback(async () => {
    if (isPaused) await window.capture.capture.resume()
    else if (isRecording) await window.capture.capture.pause()
  }, [isPaused, isRecording])

  // 保存先は設定から都度読む。枠側で控えを持つと、変更したあと古い場所を開く。
  const openOutputFolder = useCallback(async () => {
    const settings = await window.capture.settings.load()
    await window.capture.system.openPath(settings.profile.outputDirectory)
  }, [])

  const bar = (
    <FinderBar
      engine={engine}
      stats={stats}
      size={size}
      sourceKind={sourceKind}
      onMoveStart={(event) => startDrag('move', event)}
      onToggleRecording={() => void toggleRecording()}
      onTogglePause={() => void togglePause()}
      onScreenshot={() => void window.capture.capture.screenshot()}
      shutter={shutter}
      profile={profile}
      onPatchProfile={patchProfile}
      drawingVisible={drawingVisible}
      onToggleDrawing={() => void window.capture.drawing.toggle()}
      onOpenFolder={() => void openOutputFolder()}
      onShowWindow={() => void window.capture.window.toggle()}
      onClose={() => void window.capture.window.quit()}
    />
  )

  if (!framed) return <div className="flex h-full flex-col">{bar}</div>

  return (
    <div className="flex h-full flex-col">
      {bar}

      <div className="relative flex-1" style={{ padding: FINDER_OUTSET }}>
        {/*
          録画範囲そのもの。box-shadow を外側へ広げて枠線にすることで、
          border と違って範囲の内側を 1px も削らない。
        */}
        <div
          className="h-full w-full"
          style={{
            boxShadow: `0 0 0 ${FINDER_BORDER}px ${
              isRecording
                ? 'rgba(244,63,94,0.85)'
                : isPaused
                  ? 'rgba(245,158,11,0.8)'
                  : 'rgba(45,212,191,0.75)'
            }`
          }}
        />

        {/*
          録画中は大きさを変えられない。出力の解像度は録画の開始時に決まるためで、
          掴めるのに何も起きない縁を残すより、掴み代ごと引っ込めるほうが伝わる。
          移動はできるので、バーを掴めば録る場所は動かせる。
        */}
        {isActive ? null : <ResizeEdges onStart={startDrag} />}
      </div>
    </div>
  )
}
