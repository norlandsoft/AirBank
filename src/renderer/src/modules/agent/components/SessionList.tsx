import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import { bridge } from '../../../bridge'

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

/** 行内重命名输入。 */
function RenameInput({ initial, onDone }: { initial: string; onDone(title: string | null): void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  return (
    <input
      ref={ref}
      className="input session-rename-input"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onDone(value)
        if (event.key === 'Escape') onDone(null)
      }}
      onBlur={() => onDone(null)}
    />
  )
}

/** 行下拉菜单：重命名 / 存档 / 删除（删除两步确认）。 */
function SessionMenu({ sessionId, onRename }: { sessionId: string; onRename(): void }) {
  const t = useT()
  const archiveSession = useAgent((state) => state.archiveSession)
  const deleteSession = useAgent((state) => state.deleteSession)
  const [open, setOpen] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    try { await fn() } finally { setBusy(false); setOpen(false); setConfirmingDelete(false) }
  }

  return (
    <span className="session-menu">
      <button
        className="session-menu-trigger"
        title={t('sessionMenu')}
        onClick={(event) => { event.stopPropagation(); setOpen((v) => !v); setConfirmingDelete(false) }}
      >
        ⋯
      </button>
      {open && (
        <>
          <span className="popover-mask" onClick={(event) => { event.stopPropagation(); setOpen(false) }} />
          <span className="session-menu-pop" onClick={(event) => event.stopPropagation()}>
            <button className="picker-row" disabled={busy} onClick={() => { setOpen(false); onRename() }}>
              {t('sessionRename')}
            </button>
            <button className="picker-row" disabled={busy} onClick={() => void run(() => archiveSession(sessionId))}>
              {t('sessionArchive')}
            </button>
            {confirmingDelete ? (
              <button className="picker-row session-menu-danger" disabled={busy} onClick={() => void run(() => deleteSession(sessionId))}>
                {busy ? t('checking') : t('sessionDeleteConfirm')}
              </button>
            ) : (
              <button className="picker-row session-menu-danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
                {t('sessionDelete')}
              </button>
            )}
          </span>
        </>
      )}
    </span>
  )
}

function SessionRow({ sessionId, updatedAt, running, projections }: {
  sessionId: string
  updatedAt: number
  running: boolean
  projections?: Record<string, unknown>
}) {
  const active = useAgent((state) => state.activeSessionId === sessionId)
  const openSession = useAgent((state) => state.openSession)
  const renameSession = useAgent((state) => state.renameSession)
  const title = useSessionTitle(sessionId, projections?.title)
  const [renaming, setRenaming] = useState(false)

  if (renaming) {
    return (
      <div className="session-row">
        <RenameInput
          initial={title}
          onDone={(next) => {
            setRenaming(false)
            if (next !== null && next.trim() && next.trim() !== title) void renameSession(sessionId, next)
          }}
        />
      </div>
    )
  }

  return (
    <div className={`session-row hoverable${active ? ' active-nav' : ''}`}>
      <button className="session-row-main" onClick={() => void openSession(sessionId)}>
        <span className={`session-dot${running ? ' session-dot-running' : ''}`} />
        <span className="session-title">{title}</span>
        <span className="session-time">{formatTime(updatedAt)}</span>
      </button>
      <SessionMenu sessionId={sessionId} onRename={() => setRenaming(true)} />
    </div>
  )
}

/** 新建会话：可选工作目录（与 dsh 模式一致；支持浏览/最近目录/手动输入）。 */
function NewSessionButton() {
  const t = useT()
  const hostInfo = useAgent((state) => state.hostInfo)
  const sessions = useAgent((state) => state.sessions)
  const createSession = useAgent((state) => state.createSession)
  const [open, setOpen] = useState(false)
  const [cwd, setCwd] = useState('')
  const [busy, setBusy] = useState(false)

  const defaultCwd = hostInfo?.cwd ?? ''
  const recents = [...new Set(sessions.map((s) => s.cwd).filter((c): c is string => Boolean(c)))].slice(0, 6)

  const submit = async (): Promise<void> => {
    setBusy(true)
    try {
      await createSession(cwd.trim() || undefined)
      setOpen(false)
      setCwd('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <span className="session-menu">
      <button className="btn btn-ghost text-xs" onClick={() => setOpen((v) => !v)}>＋ {t('agentNewSession')}</button>
      {open && (
        <>
          <span className="popover-mask" onClick={() => setOpen(false)} />
          <span className="newsession-pop" onClick={(event) => event.stopPropagation()}>
            <div className="newsession-title">{t('sessionCwdTitle')}</div>
            <div className="newsession-inputrow">
              <input
                className="input" autoFocus placeholder={defaultCwd}
                value={cwd} onChange={(event) => setCwd(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') void submit() }}
              />
              <button
                className="btn"
                onClick={() => void bridge.dialogPickDirectory().then((dir) => { if (dir) setCwd(dir) })}
              >
                {t('sessionCwdBrowse')}
              </button>
            </div>
            {recents.length > 0 && (
              <div className="newsession-recents">
                {recents.map((dir) => (
                  <button key={dir} className="picker-row" onClick={() => setCwd(dir)}>
                    <span className="picker-label newsession-path">{dir}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="newsession-actions">
              <button className="btn btn-primary" disabled={busy} onClick={() => void submit()}>
                {busy ? t('checking') : t('create')}
              </button>
            </div>
          </span>
        </>
      )}
    </span>
  )
}

const homeShorten = (cwd: string): string => cwd.replace(/^\/(?:Users|home)\/[^/]+/, '~')

/** 会话列表侧栏：按工作目录分组（子代理会话仍嵌套于父会话下）。 */
export function SessionList() {
  const t = useT()
  const sessions = useAgent((state) => state.sessions)
  const hostInfo = useAgent((state) => state.hostInfo)
  const parents = sessions.filter((s) => !s.parentSessionId)
  const childrenOf = new Map<string, typeof sessions>()
  for (const session of sessions) {
    if (!session.parentSessionId) continue
    const list = childrenOf.get(session.parentSessionId) ?? []
    list.push(session)
    childrenOf.set(session.parentSessionId, list)
  }

  // 按 cwd 分组：默认 cwd 组在前，其余按组内最新会话时间降序
  const groups = new Map<string, typeof parents>()
  for (const parent of parents) {
    const key = parent.cwd ?? hostInfo?.cwd ?? ''
    const list = groups.get(key) ?? []
    list.push(parent)
    groups.set(key, list)
  }
  const orderedGroups = [...groups.entries()].sort((a, b) => {
    const aDefault = a[0] === (hostInfo?.cwd ?? '') ? 0 : 1
    const bDefault = b[0] === (hostInfo?.cwd ?? '') ? 0 : 1
    if (aDefault !== bDefault) return aDefault - bDefault
    return Math.max(...b[1].map((s) => s.updatedAt)) - Math.max(...a[1].map((s) => s.updatedAt))
  })

  return (
    <aside className="session-list" style={{ width: '100%' }}>
      <div className="session-list-head">
        <span className="text-xs text-dim">{t('agentSessions')}</span>
        <NewSessionButton />
      </div>
      <div className="session-list-body">
        {orderedGroups.map(([cwd, groupSessions]) => (
          <div key={cwd || '__default__'} className="session-group">
            <div className="session-group-head" title={cwd}>
              {homeShorten(cwd || t('agentUntitled'))}（{groupSessions.length}）
            </div>
            {groupSessions.map((s) => (
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
        ))}
      </div>
    </aside>
  )
}
