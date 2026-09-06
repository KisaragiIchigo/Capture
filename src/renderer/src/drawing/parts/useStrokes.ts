import { useCallback, useRef, useState } from 'react'
import { strokeTouches, ERASER_RADIUS, type DrawTool, type Point, type Stroke } from '@shared/types'

export interface StrokeStore {
  strokes: Stroke[]
  /** 描いている最中のストローク。確定前なので strokes には入れない。 */
  draft: Stroke | null
  begin: (tool: DrawTool, color: string, width: number, point: Point) => void
  extend: (point: Point) => void
  commit: () => void
  cancel: () => void
  eraseAt: (point: Point) => void
  addText: (color: string, width: number, point: Point, text: string) => void
  clear: () => void
  undo: () => void
}

/**
 * 描いた内容の保持。
 *
 * 確定前のストロークを draft として分けて持つ。確定済みの配列へ直接足しながら
 * 描くと、1 点増えるたびに配列全体が作り直されて重くなるうえ、
 * 描き途中の取り消しが難しくなる。
 *
 * 描き途中は ref を正とし、state は表示のために写す。state だけで持つと、確定は
 * 「更新関数の中で別の state を更新する」形になり、同じ線が 2 本入る。React は
 * 更新関数を純粋なものとして扱い、開発時には二重に呼んで確かめるためで、
 * pointerup と pointerleave が続けて届く場面でも、state がまだ古いまま二重に確定する。
 * ref なら確定した瞬間に次の呼び出しから消えるので、どちらの経路でも 1 本で収まる。
 *
 * 描いたものは消しゴムか全消しでしか消えない。蛍光マーカーもペンと同じ扱いで、
 * 時間で勝手に消えることはない。一瞬だけ指し示す用途はレーザーポインターが持つ。
 */
export function useStrokes(): StrokeStore {
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [draft, setDraftState] = useState<Stroke | null>(null)
  const draftRef = useRef<Stroke | null>(null)
  const nextId = useRef(0)

  /** 描き途中の差し替え。ref と state を必ず同時に動かす。 */
  const setDraft = useCallback((next: Stroke | null) => {
    draftRef.current = next
    setDraftState(next)
  }, [])

  const createId = useCallback(() => {
    nextId.current += 1
    return `stroke-${nextId.current}`
  }, [])

  const begin = useCallback(
    (tool: DrawTool, color: string, width: number, point: Point) => {
      setDraft({ id: createId(), tool, color, width, points: [point] })
    },
    [createId, setDraft]
  )

  const extend = useCallback(
    (point: Point) => {
      const current = draftRef.current
      if (!current) return

      // 直線・矢印・矩形は始点と終点だけを持つ。途中の点を溜めない。
      if (current.tool === 'line' || current.tool === 'arrow' || current.tool === 'rect') {
        const head = current.points[0]
        if (!head) return
        setDraft({ ...current, points: [head, point] })
        return
      }

      setDraft({ ...current, points: [...current.points, point] })
    },
    [setDraft]
  )

  const commit = useCallback(() => {
    const current = draftRef.current
    if (!current) return

    setDraft(null)
    setStrokes((list) => [...list, current])
  }, [setDraft])

  const cancel = useCallback(() => setDraft(null), [setDraft])

  const eraseAt = useCallback((point: Point) => {
    setStrokes((current) => {
      const next = current.filter((stroke) => !strokeTouches(stroke, point, ERASER_RADIUS))
      return next.length === current.length ? current : next
    })
  }, [])

  const addText = useCallback(
    (color: string, width: number, point: Point, text: string) => {
      if (!text.trim()) return
      setStrokes((current) => [
        ...current,
        { id: createId(), tool: 'text', color, width, points: [point], text }
      ])
    },
    [createId]
  )

  const clear = useCallback(() => {
    setStrokes([])
    setDraft(null)
  }, [setDraft])

  const undo = useCallback(() => {
    setStrokes((current) => current.slice(0, -1))
  }, [])

  return { strokes, draft, begin, extend, commit, cancel, eraseAt, addText, clear, undo }
}
