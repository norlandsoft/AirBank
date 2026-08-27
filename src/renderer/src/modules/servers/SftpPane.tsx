import { useIde } from '../ide/store'
import { useServers } from './store'
import { useT } from '../../hooks'
import { IconFile, IconFolder } from '../../icons'
import type { SftpEntry } from '../../../../shared/types'

function formatSize(size: number): string {
  if (size < 1024) return `${size}B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)}K`
  if (size < 1024 * 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)}M`
  return `${(size / 1024 / 1024 / 1024).toFixed(2)}G`
}

function RemoteRow({ entry }: { entry: SftpEntry }) {
  const cdRemote = useServers((state) => state.cdRemote)
  const download = useServers((state) => state.download)
  return (
    <div className="sftp-row hoverable">
      <button
        className="sftp-main"
        onClick={() => {
          if (entry.kind === 'dir') void cdRemote(entry.path)
          else void download(entry)
        }}
      >
        {entry.kind === 'dir' ? <IconFolder size={13} /> : <IconFile size={13} />}
        <span className="sftp-name">{entry.name}</span>
      </button>
      <span className="sftp-size">{entry.kind === 'dir' ? '' : formatSize(entry.size)}</span>
      {entry.kind !== 'dir' && (
        <button className="btn btn-ghost sftp-action" title="下载到工作区" onClick={() => void download(entry)}>⇩</button>
      )}
    </div>
  )
}

/** SFTP 双栏（v1：本地 = IDE 工作区树入口提示；远端 = 可导航列表）。 */
export function SftpPane() {
  const t = useT()
  const remoteCwd = useServers((state) => state.remoteCwd)
  const remoteEntries = useServers((state) => state.remoteEntries)
  const cdRemote = useServers((state) => state.cdRemote)
  const transfers = useServers((state) => state.transfers)
  const cancelTransfer = useServers((state) => state.cancelTransfer)
  const wsRoot = useIde((state) => state.root)
  const parent = remoteCwd === '/' ? null : remoteCwd.slice(0, remoteCwd.lastIndexOf('/')) || '/'

  return (
    <div className="sftp-wrap">
      <div className="sftp-cols">
        <div className="sftp-col">
          <div className="sftp-head">本地（IDE 工作区）</div>
          <div className="sftp-local-hint">
            <p className="text-dim text-xs">{wsRoot ?? t('gitNeedRoot')}</p>
            <p className="text-dim text-xs">{t('sftpLocalHint')}</p>
            <UploadFromTree />
          </div>
        </div>
        <div className="sftp-col">
          <div className="sftp-head">
            <span className="sftp-cwd" title={remoteCwd}>{remoteCwd}</span>
          </div>
          <div className="sftp-list">
            {parent && (
              <div className="sftp-row hoverable">
                <button className="sftp-main" onClick={() => void cdRemote(parent)}>
                  <IconFolder size={13} /><span className="sftp-name">..</span>
                </button>
              </div>
            )}
            {remoteEntries.map((entry) => <RemoteRow key={entry.path} entry={entry} />)}
          </div>
        </div>
      </div>
      {transfers.length > 0 && (
        <div className="sftp-transfers">
          {transfers.map((transfer) => (
            <div key={transfer.id} className="sftp-transfer">
              <span className="sftp-transfer-label">
                {transfer.direction === 'up' ? '⇧' : '⇩'} {transfer.remotePath.split('/').pop()}
              </span>
              <div className="sftp-progress">
                <div
                  className={`sftp-progress-bar${transfer.state === 'error' ? ' sftp-progress-error' : ''}`}
                  style={{ width: `${transfer.total > 0 ? Math.round((transfer.done / transfer.total) * 100) : 0}%` }}
                />
              </div>
              <span className="sftp-transfer-state">
                {transfer.state === 'running'
                  ? `${formatSize(transfer.done)}/${formatSize(transfer.total)}`
                  : transfer.state === 'done' ? '✓' : transfer.state === 'cancelled' ? '✗' : transfer.error}
              </span>
              {transfer.state === 'running' && (
                <button className="btn btn-ghost sftp-action" onClick={() => void cancelTransfer(transfer.id)}>✕</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/** 从 IDE 工作区已打开/选择的文件快速上传（v1 简化：列出工作区树根文件供选择）。 */
function UploadFromTree() {
  const dirs = useIde((state) => state.dirs[''])
  const upload = useServers((state) => state.upload)
  const root = useIde((state) => state.root)
  if (!root || !dirs) return null
  return (
    <div className="sftp-upload-list">
      {dirs.filter((entry) => entry.kind === 'file').slice(0, 30).map((entry) => (
        <div key={entry.rel} className="sftp-row hoverable">
          <span className="sftp-main"><IconFile size={13} /><span className="sftp-name">{entry.name}</span></span>
          <button className="btn btn-ghost sftp-action" title="上传到远端当前目录" onClick={() => void upload(`${root}/${entry.rel}`)}>⇧</button>
        </div>
      ))}
    </div>
  )
}
