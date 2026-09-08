import { BrowserWindow, ipcMain, screen } from 'electron'
import { buildPaletteBounds, IPC, PALETTE_PROVISIONAL_HEIGHT } from '@shared/types'
import type { CaptureProfile, WindowBounds } from '@shared/types'
import { createLogger } from '@main/lib/logger'
import { createDrawingWindow, resolveDrawingArea } from '@main/window/createDrawingWindow'
import { createPaletteWindow } from '@main/window/createPaletteWindow'
import { drawingCommandSchema, paletteHeightSchema } from '../schemas'
import { raiseFinder } from './finderHandlers'
import type { IpcContext } from '../context'

const log = createLogger('ipc-drawing')

let drawingWindow: BrowserWindow | null = null
/**
 * 道具のパレット。描画面と別の窓に分けてある。
 *
 * 窓ごと録画から外すためで、除外の単位がウィンドウだから同じ窓には置けない。
 * 一緒にすると、パレットを消すつもりで描いた線まで映らなくなる。
 */
let paletteWindow: BrowserWindow | null = null
/** 実測したパレットの高さ。置き直しのたびに測り直さずに済むよう控える。 */
let paletteHeight: number | null = null
/** 今の録画範囲。パレットの逃がし先を求めるのに使う。 */
let drawingArea: WindowBounds | null = null
/** ホットキーからも同じ経路を通すために保持する。 */
let toggleHandler: (() => void) | null = null

/**
 * 画面へ描き込む窓の開閉。
 *
 * 開いている間は録画される範囲を覆うため、その内側では下のアプリを操作できなくなる。
 * 閉じる手段（パレットの×と Esc）を必ず残すこと。
 */
export function registerDrawingHandlers(context: IpcContext): () => void {
  // ファインダーのバーも開閉状態を点灯に使うため、メインだけでなく全ウィンドウへ配る。
  const notify = (visible: boolean): void => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) window.webContents.send(IPC.events.drawingVisibility, visible)
    }
  }

  const close = (): void => {
    const targets = [drawingWindow, paletteWindow]
    drawingWindow = null
    paletteWindow = null
    paletteHeight = null
    drawingArea = null

    for (const target of targets) {
      if (target && !target.isDestroyed()) target.destroy()
    }
    notify(false)
  }

  const open = (): void => {
    if (drawingWindow && !drawingWindow.isDestroyed()) {
      drawingWindow.show()
      // 高さを測る前のパレットは出さない。仮の大きさのまま画面に出ることになる。
      if (paletteWindow && !paletteWindow.isDestroyed() && paletteHeight !== null) {
        paletteWindow.showInactive()
      }
      raiseFinder()
      notify(true)
      return
    }

    const { profile } = context.getSettings()
    // 覆うのは録画される範囲だけ。外まで覆うと操作バーへ手が届かなくなる。
    drawingArea = resolveDrawingArea(profile)
    drawingWindow = createDrawingWindow(drawingArea)

    /*
     * パレットは中身の高さを測ってから表に出す。高さを決め打つと DOM の実寸と食い違い、
     * 欠けるのは下端の「描画を終える」になる。閉じる手段が消える壊れ方をするため、
     * 仮の高さで作って隠したまま置き、報せが届いた時点で正しい大きさへ直す。
     */
    paletteWindow = createPaletteWindow(placementFor(drawingArea, PALETTE_PROVISIONAL_HEIGHT))

    // 片方だけ閉じられた場合も、道具と描画面が別々に残らないよう揃えて畳む。
    // close() は先に控えを外してから壊すため、その中から届く closed では何も起きない。
    drawingWindow.on('closed', () => {
      if (drawingWindow) close()
    })
    paletteWindow.on('closed', () => {
      if (paletteWindow) close()
    })

    // 描画面より操作バーを手前に置く。ここを忘れると、ペンを閉じる手段が画面から消える。
    drawingWindow.once('ready-to-show', () => raiseFinder())
    notify(true)
  }

  /*
   * 開閉の判断はここでしか行わない。
   * Renderer に持たせた状態で切り替えると、通知の行き違いで
   * 「閉じたいのに開き直す」という噛み合わない挙動になる。
   */
  toggleHandler = () => {
    if (drawingWindow && !drawingWindow.isDestroyed()) close()
    else open()
  }

  ipcMain.handle(IPC.drawing.open, () => open())
  ipcMain.handle(IPC.drawing.close, () => close())
  ipcMain.handle(IPC.drawing.toggle, () => toggleHandler?.())

  ipcMain.handle(IPC.drawing.command, (_event, payload: unknown) => {
    if (!drawingWindow || drawingWindow.isDestroyed()) return

    const parsed = drawingCommandSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正な描き込みの指示を受け取りました', parsed.error.issues)
      return
    }

    drawingWindow.webContents.send(IPC.events.drawingCommand, parsed.data)
  })

  ipcMain.handle(IPC.drawing.paletteReady, (_event, payload: unknown) => {
    if (!paletteWindow || paletteWindow.isDestroyed()) return

    const parsed = paletteHeightSchema.safeParse(payload)
    if (!parsed.success) {
      log.error('不正なパレットの高さを受け取りました', parsed.error.issues)
      return
    }

    paletteHeight = parsed.data
    placePalette()
    paletteWindow.showInactive()
  })

  return () => {
    toggleHandler = null
    close()
  }
}

/** ホットキーなど、IPC を介さずに開閉する経路。 */
export function toggleDrawingWindow(): void {
  toggleHandler?.()
}

/**
 * 開いている描き込み面を、今の録画範囲へ合わせ直す。
 *
 * 描き込み面は録画範囲にぴったり重ねている。開いたあとに範囲を動かされると、
 * 描ける場所と実際に映る場所がずれ、範囲の外に描いて何も残らない状態になる。
 * 設定が変わる経路はひとつに絞ってあるので、そこから必ずここを通す。
 *
 * パレットも同じ範囲を基準に逃がしているため、必ず対で置き直す。
 */
export function updateDrawingArea(profile: CaptureProfile): void {
  const window = drawingWindow
  if (!window || window.isDestroyed()) return

  drawingArea = resolveDrawingArea(profile)
  window.setBounds(drawingArea)
  placePalette()
}

/** パレットを録画範囲の外へ置き直す。高さが未実測のうちは動かさない。 */
function placePalette(): void {
  if (!paletteWindow || paletteWindow.isDestroyed()) return
  if (!drawingArea || paletteHeight === null) return

  paletteWindow.setBounds(placementFor(drawingArea, paletteHeight))
}

/** 録画範囲の載っているモニタを基準に、パレットの置き場所を求める。 */
function placementFor(area: WindowBounds, height: number): WindowBounds {
  return buildPaletteBounds(area, screen.getDisplayMatching(area).workArea, height)
}
