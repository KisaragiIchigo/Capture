import { useEffect, useRef } from 'react'

/**
 * 透過部分をクリックスルーさせる。
 *
 * ウィンドウ全体をマウス無視にしたうえで、操作できる要素の上にカーソルが来た瞬間だけ解除する。
 * setIgnoreMouseEvents に forward を立てているので、無視している間も mousemove は届き、
 * カーソルが操作領域へ戻ってきたことを検知できる。これを忘れると一度透過部分へ入った時点で
 * 二度と枠を掴めなくなる。
 *
 * 操作したい要素には data-interactive を付ける。
 *
 * リサイズ中は判定を止める。掴んだまま透過部分へカーソルが出た瞬間にマウス無視へ戻ると、
 * mouseup を取り逃してドラッグが終わらなくなる。
 */
export function useClickThrough(suspended: boolean): void {
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

    apply(true)
    window.addEventListener('mousemove', handleMove)
    document.addEventListener('mouseleave', handleLeave)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      document.removeEventListener('mouseleave', handleLeave)
      void window.capture.finder.setIgnoreMouse(false)
      ignoring.current = null
    }
  }, [suspended])
}
