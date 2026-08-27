import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { bridge } from '../../bridge'
import { useServers } from './store'

/** 远端终端：xterm ↔ IPC ↔ ssh2 shell 通道（输出订阅 + 输入回写 + resize 同步）。 */
export function TerminalView({ connId }: { connId: string }) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const ensureShell = useServers((state) => state.ensureShell)

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

    let channelId: string | null = null
    let disposed = false
    void ensureShell(connId, term.cols, term.rows).then((id) => {
      if (disposed) {
        void bridge.ssh.shell.close(id)
        return
      }
      channelId = id
    }).catch(() => undefined)

    const inputSub = term.onData((data) => {
      if (channelId) void bridge.ssh.shell.data(channelId, data)
    })
    const eventOff = bridge.onSshEvent((event) => {
      if (event.type === 'shell-data' && event.channelId === channelId) term.write(event.data)
      if (event.type === 'shell-close' && event.channelId === channelId) term.write('\r\n[连接已关闭]\r\n')
    })
    const observer = new ResizeObserver(() => {
      fit.fit()
      if (channelId) void bridge.ssh.shell.resize(channelId, term.cols, term.rows)
    })
    observer.observe(hostRef.current)

    return () => {
      disposed = true
      observer.disconnect()
      eventOff()
      inputSub.dispose()
      term.dispose()
    }
  }, [connId, ensureShell])

  return <div ref={hostRef} className="terminal-host" />
}
