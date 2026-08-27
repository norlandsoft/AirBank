import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { bridge } from '../bridge'
import { useTerminal } from '../stores/terminal'

/** 本地终端视图：xterm ↔ IPC ↔ 主进程 script(1) 伪终端。 */
export function LocalTermView({ termId }: { termId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hostRef.current) return
    const term = new Terminal({
      fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
      fontSize: 12.5,
      cursorBlink: true,
      theme: {
        background: '#101012', foreground: '#ececee', cursor: '#4d6bfe',
        selectionBackground: 'rgba(77, 107, 254, 0.35)',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(hostRef.current)
    fit.fit()
    void bridge.term.resize(termId, term.cols, term.rows)

    const inputSub = term.onData((data) => void bridge.term.data(termId, data))
    const eventOff = bridge.onTermEvent((event) => {
      if (event.type === 'term-data' && event.termId === termId) term.write(event.data)
      if (event.type === 'term-exit' && event.termId === termId) term.write('\r\n[进程已退出]\r\n')
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      void bridge.term.resize(termId, term.cols, term.rows)
    })
    observer.observe(hostRef.current)
    return () => {
      observer.disconnect()
      eventOff()
      inputSub.dispose()
      term.dispose()
    }
  }, [termId])

  return <div ref={hostRef} className="terminal-host" />
}

/** 底部面板：本地终端标签组（⌘J 开合）。 */
export function BottomPanel() {
  const terms = useTerminal((state) => state.terms)
  const activeTermId = useTerminal((state) => state.activeTermId)
  const setActive = useTerminal((state) => state.setActive)
  const closeTerm = useTerminal((state) => state.closeTerm)
  const openTerm = useTerminal((state) => state.openTerm)
  const toggleBottom = useTerminal((state) => state.toggleBottom)

  return (
    <div className="bottom-panel">
      <div className="bottom-tabs">
        {terms.map((term) => (
          <div key={term.id} className={`bottom-tab${term.id === activeTermId ? ' bottom-tab-active' : ''}`}>
            <button className="bottom-tab-name" onClick={() => setActive(term.id)}>{term.title}</button>
            <button className="bottom-tab-close" onClick={() => closeTerm(term.id)}>✕</button>
          </div>
        ))}
        <button className="btn btn-ghost bottom-new" onClick={() => void openTerm(80, 24)}>＋ 终端</button>
        <div className="flex-1" />
        <button className="btn btn-ghost bottom-new" title="⌘J" onClick={toggleBottom}>✕</button>
      </div>
      {activeTermId
        ? <LocalTermView key={activeTermId} termId={activeTermId} />
        : <div className="editor-empty text-dim">＋ 打开一个本地终端</div>}
    </div>
  )
}
