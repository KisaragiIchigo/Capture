import { useEffect, useRef } from 'react'

/**
 * 透過部分をクリックスルーさせる。
 *
 * ウィンドウ全体をマウス無視にしたうえで、操作できる要素の上にカーソルが来た瞬間だけ解除する。
 * setIgnoreMouseEvents に forward を立てているので、無視している間も mousemove は届き、
 * カーソルが操作領域へ戻ってきたことを検知できる。これを忘れると一度透過部分へ入った時点で
 * 二度と操作領域へ戻れなくなる。
 *
 * 操作したい要素には data-interactive を付ける。
 *
 * ファインダーと描き込み窓の双方が使う。IPC のチャンネル名は finder 由来だが、
 * Main は送り主の窓を見て切り替えるため、どの窓から呼んでも自分の窓に効く。
 *
 * @param suspended 掴んでいる間の判定停止。掴んだまま透過部分へカーソルが出た瞬間に
 *   マウス無視へ戻ると、mouseup を取り逃してドラッグが終わらなくなる。
 * @param initialIgnore カーソルが一度も動く前の既定。枠を掴ませたいファインダーは無視で始め、
 *   開いた瞬間から描かせたい描き込み窓は受け取る側で始める。ここを違えると、
 *   開いてすぐの 1 クリックが下のアプリへ抜ける。
 */
export function useClickThrough(suspended: boolean, initialIgnore = true): void {
  // 状態が変わったときだけ IPC を投げる。mousemove ごとに呼ぶと通信が飽和する。
  const ignoring = useRef<boolean | null>(null)

  useEffect(() => {
    if (suspended) return

    const apply = (next: boolean): void => {
      if (ignoring.current === next) return
      ignoring.current = next
      void window.capture.finder.setIgnoreMouse(next)
    }

    const handleMove = (event: MouseEvent): void => {
      const element = document.elementFromPoint(event.clientX, event.clientY)
      const interactive = element?.closest('[data-interactive]') != null
      apply(!interactive)
    }

    // ウィンドウの外へ出たら無視に戻す。境界をまたいだまま固定されるのを防ぐ。
    const handleLeave = (): void => apply(true)

    apply(initialIgnore)
    window.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseleave', handleLeave)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseleave', handleLeave)
      void window.capture.finder.setIgnoreMouse(false)
      ignoring.current = null
    }
  }, [suspended, initialIgnore])
}
