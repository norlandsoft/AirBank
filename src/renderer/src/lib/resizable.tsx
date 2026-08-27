import { useCallback, useRef, useState } from 'react'

const MIN = 150
const MAX = 560

/**
 * 分栏宽度拖拽（各页面左右分栏通用）：拖拽手柄 + localStorage 持久化。
 * 用法：const { width, handle } = useResizableWidth('chat-sessions', 232)
 *       <aside style={{ width }} />{handle}<main />
 */
export function useResizableWidth(key: string, initial: number): { width: number; handle: React.ReactNode } {
  const storageKey = `aircode:split:${key}`
  const [width, setWidth] = useState(() => {
    const saved = Number(localStorage.getItem(storageKey))
    return Number.isFinite(saved) && saved >= MIN && saved <= MAX ? saved : initial
  })
  const latest = useRef(width)
  latest.current = width

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startW = latest.current
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: PointerEvent): void => {
      setWidth(Math.min(MAX, Math.max(MIN, startW + ev.clientX - startX)))
    }
    const onUp = (): void => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem(storageKey, String(latest.current))
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [storageKey])

  return {
    width,
    handle: <div className="split-handle" onPointerDown={onPointerDown} role="separator" aria-orientation="vertical" />,
  }
}
