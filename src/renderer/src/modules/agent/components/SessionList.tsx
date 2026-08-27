import { useAgent } from '../store'
import { useT } from '../../../hooks'

function formatTime(updatedAt: number): string {
  const date = new Date(updatedAt)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** 会话标题：已装载切片读 live 投影，否则读摘要投影快照。 */
function useSessionTitle(sessionId: string, fallback: unknown): string {
  const t = useT()
  const live = useAgent((state) => state.slices[sessionId]?.projections.get('title')?.value)
  const value = typeof live === 'string' && live.length > 0 ? live
    : typeof fallback === 'string' && fallback.length > 0 ? fallback : null
  return value ?? t('agentUntitled')
}

function SessionRow({ sessionId, updatedAt, running, projections }: {
  sessionId: string
  updatedAt: number
  running: boolean
  projections?: Record<string, unknown>
}) {
  const active = useAgent((state) => state.activeSessionId === sessionId)
  const openSession = useAgent((state) => state.openSession)
  const title = useSessionTitle(sessionId, projections?.title)
  return (
    <button
      className={`session-row hoverable${active ? ' active-nav' : ''}`}
      onClick={() => void openSession(sessionId)}
    >
      <span className={`session-dot${running ? ' session-dot-running' : ''}`} />
      <span className="session-title">{title}</span>
      <span className="session-time">{formatTime(updatedAt)}</span>
    </button>
  )
}

/** 会话列表侧栏（内核按 updatedAt 降序返回；子代理会话嵌套于父会话下）。 */
export function SessionList() {
  const t = useT()
  const sessions = useAgent((state) => state.sessions)
  const createSession = useAgent((state) => state.createSession)
  const parents = sessions.filter((s) => !s.parentSessionId)
  const childrenOf = new Map<string, typeof sessions>()
  for (const session of sessions) {
    if (!session.parentSessionId) continue
    const list = childrenOf.get(session.parentSessionId) ?? []
    list.push(session)
    childrenOf.set(session.parentSessionId, list)
  }
  return (
    <aside className="session-list">
      <div className="session-list-head">
        <span className="text-xs text-dim">{t('agentSessions')}</span>
        <button className="btn btn-ghost text-xs" onClick={() => void createSession()}>＋ {t('agentNewSession')}</button>
      </div>
      <div className="session-list-body">
        {parents.map((s) => (
          <div key={s.sessionId}>
            <SessionRow
              sessionId={s.sessionId}
              updatedAt={s.updatedAt}
              running={s.running}
              projections={s.projections}
            />
            {(childrenOf.get(s.sessionId) ?? []).map((child) => (
              <div key={child.sessionId} className="session-child">
                <SessionRow
                  sessionId={child.sessionId}
                  updatedAt={child.updatedAt}
                  running={child.running}
                  projections={child.projections}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  )
}
