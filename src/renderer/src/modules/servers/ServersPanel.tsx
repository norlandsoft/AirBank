import { useEffect, useState } from 'react'
import { useServers } from './store'
import { useT } from '../../hooks'
import { TerminalView } from './TerminalView'
import { SftpPane } from './SftpPane'
import type { SshAuthType, SshConnection } from '../../../../shared/types'
import { useResizableWidth } from '../../lib/resizable'

function ConnForm({ onDone }: { onDone(): void }) {
  const t = useT()
  const add = useServers((state) => state.add)
  const [name, setName] = useState('')
  const [host, setHost] = useState('')
  const [port, setPort] = useState('22')
  const [username, setUsername] = useState('')
  const [authType, setAuthType] = useState<SshAuthType>('password')
  const [keyPath, setKeyPath] = useState('')
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (): Promise<void> => {
    if (!name.trim() || !host.trim() || !username.trim()) return
    setBusy(true)
    try {
      await add(
        { name: name.trim(), host: host.trim(), port: Number(port) || 22, username: username.trim(), authType, ...(authType === 'key' && keyPath ? { keyPath } : {}) },
        secret || undefined,
      )
      onDone()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ssh-form">
      <input className="input" placeholder={t('sshName')} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="ssh-form-row">
        <input className="input ssh-form-host" placeholder="host" value={host} onChange={(e) => setHost(e.target.value)} />
        <input className="input ssh-form-port" placeholder="22" value={port} onChange={(e) => setPort(e.target.value)} />
      </div>
      <input className="input" placeholder={t('sshUsername')} value={username} onChange={(e) => setUsername(e.target.value)} />
      <select className="input" value={authType} onChange={(e) => setAuthType(e.target.value as SshAuthType)}>
        <option value="password">{t('sshAuthPassword')}</option>
        <option value="key">{t('sshAuthKey')}</option>
        <option value="agent">{t('sshAuthAgent')}</option>
      </select>
      {authType === 'key' && (
        <input className="input" placeholder={t('sshKeyPath')} value={keyPath} onChange={(e) => setKeyPath(e.target.value)} />
      )}
      {authType !== 'agent' && (
        <input
          className="input" type="password" value={secret} onChange={(e) => setSecret(e.target.value)}
          placeholder={authType === 'password' ? t('sshPassword') : t('sshPassphrase')}
        />
      )}
      <div className="ssh-form-actions">
        <button className="btn" onClick={onDone}>{t('cancel')}</button>
        <button className="btn btn-primary" disabled={busy || !name.trim() || !host.trim() || !username.trim()} onClick={() => void submit()}>
          {t('create')}
        </button>
      </div>
    </div>
  )
}

function ConnRow({ conn }: { conn: SshConnection }) {
  const t = useT()
  const activeId = useServers((state) => state.activeId)
  const state = useServers((state) => state.states[conn.id] ?? 'disconnected')
  const select = useServers((state) => state.select)
  const connect = useServers((state) => state.connect)
  const disconnect = useServers((state) => state.disconnect)
  const remove = useServers((state) => state.remove)
  return (
    <div className={`ssh-conn-row${activeId === conn.id ? ' active-nav' : ''}`}>
      <button className="ssh-conn-main" onClick={() => void select(conn.id)}>
        <span className={`dot${state === 'connected' ? ' dot-ok' : state === 'connecting' ? ' dot-warn' : state === 'error' ? ' dot-err' : ' dot-off'}`} />
        <span className="ssh-conn-name">{conn.name}</span>
        <span className="ssh-conn-addr">{conn.username}@{conn.host}</span>
      </button>
      {state === 'connected' ? (
        <button className="btn btn-ghost ssh-conn-btn" onClick={() => void disconnect(conn.id)}>{t('sshDisconnect')}</button>
      ) : (
        <button className="btn btn-ghost ssh-conn-btn" disabled={state === 'connecting'} onClick={() => void connect(conn.id)}>
          {state === 'connecting' ? '…' : t('sshConnect')}
        </button>
      )}
      <button className="btn btn-ghost ssh-conn-btn" title={t('delete')} onClick={() => void remove(conn.id)}>✕</button>
    </div>
  )
}

/** 服务器面板：连接列表 + 终端/SFTP 标签。 */
export function ServersPanel() {
  const t = useT()
  const connections = useServers((state) => state.connections)
  const activeId = useServers((state) => state.activeId)
  const states = useServers((state) => state.states)
  const error = useServers((state) => state.error)
  const refresh = useServers((state) => state.refresh)
  const [adding, setAdding] = useState(false)
  const [tab, setTab] = useState<'terminal' | 'sftp'>('terminal')
  const sideSplit = useResizableWidth('ssh-side', 252)

  useEffect(() => { void refresh() }, [refresh])

  const activeState = activeId ? states[activeId] : undefined

  return (
    <div className="flex-1 flex min-h-0">
      <aside className="ssh-side" style={{ width: sideSplit.width }}>
        <div className="ssh-side-head">
          <span className="text-xs text-dim">{t('navServers')}</span>
          <button className="btn btn-ghost text-xs" onClick={() => setAdding((v) => !v)}>＋ {t('sshAdd')}</button>
        </div>
        {adding && <ConnForm onDone={() => setAdding(false)} />}
        <div className="ssh-conn-list">
          {connections.map((conn) => <ConnRow key={conn.id} conn={conn} />)}
          {connections.length === 0 && !adding && (
            <div className="text-dim text-xs px-3 py-3">{t('sshEmpty')}</div>
          )}
        </div>
      </aside>
      {sideSplit.handle}
      <div className="flex-1 flex flex-col min-w-0">
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        {!activeId && <div className="editor-empty text-dim">{t('sshSelectHint')}</div>}
        {activeId && activeState !== 'connected' && (
          <div className="editor-empty text-dim">{t('sshNotConnected')}</div>
        )}
        {activeId && activeState === 'connected' && (
          <>
            <div className="ssh-tabs">
              <button className={`ssh-tab${tab === 'terminal' ? ' ssh-tab-active' : ''}`} onClick={() => setTab('terminal')}>{t('sshTerminal')}</button>
              <button className={`ssh-tab${tab === 'sftp' ? ' ssh-tab-active' : ''}`} onClick={() => setTab('sftp')}>{t('sshFiles')}</button>
            </div>
            {tab === 'terminal' ? <TerminalView connId={activeId} /> : <SftpPane />}
          </>
        )}
      </div>
    </div>
  )
}
