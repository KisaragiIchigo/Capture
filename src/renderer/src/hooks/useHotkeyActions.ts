import { useEffect } from 'react'
import { useCaptureStore } from '@renderer/store/useCaptureStore'

/**
 * Main が受けたグローバルホットキーを実際の操作へ結び付ける。
 *
 * 録画開始と停止は同じキーに割り当てるため、現在の状態を見て分岐する。
 * 状態は store から都度読み、依存配列に載せない（キー登録を張り替えないため）。
 */
export function useHotkeyActions(): void {
  useEffect(() => {
    return window.capture.events.onHotkey((action) => {
      const store = useCaptureStore.getState()
      const status = store.engine.status

      switch (action) {
        case 'toggleRecording':
          if (status === 'recording' || status === 'paused') void store.stopRecording()
          else if (status === 'ready') void store.startRecording()
          break
        case 'pauseRecording':
          void store.togglePause()
          break
        case 'screenshot':
          void store.takeScreenshot()
          break
        case 'toggleIntervalCapture':
          store.toggleIntervalCapture()
          break
        case 'toggleDrawing':
        case 'toggleWindow':
        case 'marker':
          // ウィンドウの出し入れと描き込みの開閉は Main で完結し、
          // レーザーポインターは描画側が直接受け取る。
          break
      }
    })
  }, [])
}
