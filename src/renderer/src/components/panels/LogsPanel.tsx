import { useEffect, useRef } from 'react'
import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import { PanelHeader } from './PanelHeader'

const LEVEL_COLOR: Record<string, string> = {
  info: 'var(--text-dim)', warn: 'var(--warn)', error: 'var(--err)',
}

/** 日志面板：滚动回放 + 实时追加。 */
export function LogsPanel() {
  const t = useT()
  const logs = useApp((state) => state.logs)
  const info = useApp((state) => state.info)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [logs.length])

  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader
        title={t('logsTitle')} desc={t('logsDesc')}
        actions={(
          <>
            <button className="btn" onClick={() => { void bridge.logs.clear(); useApp.setState({ logs: [] }) }}>{t('clear')}</button>
            {info && <button className="btn" onClick={() => void bridge.shell.showItem(info.logsDir)}>{t('openLogsDir')}</button>}
          </>
        )}
      />
      <div className="flex-1 overflow-y-auto p-4 log-console leading-relaxed">
        {logs.map((entry, index) => (
          <div key={index}>
            <span className="text-dim">{new Date(entry.ts).toLocaleTimeString()} </span>
            <span style={{ color: 'var(--accent)' }}>[{entry.source}]</span>{' '}
            <span style={{ color: LEVEL_COLOR[entry.level] }}>{entry.line}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}
