import { useEffect, useRef, useState } from 'react'
import { useGit } from './store'
import { useIde } from '../ide/store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import { DiffText } from './DiffText'
import type { GitFileStatus } from '../../../../shared/types'

const STATE_LABEL: Record<GitFileStatus['state'], string> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflicted: 'C',
}

function FileRow({ file }: { file: GitFileStatus }) {
  const selected = useGit((state) => state.selected)
  const select = useGit((state) => state.select)
  const stage = useGit((state) => state.stage)
  const unstage = useGit((state) => state.unstage)
  const active = selected?.path === file.path && selected?.staged === file.staged
  return (
    <div className={`git-file-row hoverable${active ? ' active-nav' : ''}`}>
      <button className="git-file-main" onClick={() => void select(file.path, file.staged)}>
        <span className={`git-state git-state-${file.state}`}>{STATE_LABEL[file.state]}</span>
        <span className="git-file-path">{file.path}</span>
      </button>
      <button
        className="btn btn-ghost git-stage-btn"
        title={file.staged ? 'unstage' : 'stage'}
        onClick={() => void (file.staged ? unstage([file.path]) : stage([file.path]))}
      >
        {file.staged ? '−' : '＋'}
      </button>
    </div>
  )
}

/** Git 面板：分支/变更/提交 三栏一体 + 右侧 diff。 */
export function GitPanel() {
  const t = useT()
  const { status, loaded, branches, commits, diffText, error } = useGit()
  const refresh = useGit((state) => state.refresh)
  const commit = useGit((state) => state.commit)
  const checkout = useGit((state) => state.checkout)
  const createBranch = useGit((state) => state.createBranch)
  const stage = useGit((state) => state.stage)
  const unstage = useGit((state) => state.unstage)
  const root = useIde((state) => state.root)
  const [message, setMessage] = useState('')
  const [branchDraft, setBranchDraft] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { void refresh() }, [refresh, root])

  // 文件系统变更 → 300ms 去抖刷新
  useEffect(() => {
    return bridge.onWorkspaceChange(() => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void refresh(), 300)
    })
  }, [refresh])

  if (!root) {
    return <div className="flex-1 surface flex items-center justify-center text-dim text-sm">{t('gitNeedRoot')}</div>
  }
  if (loaded && !status) {
    return <div className="flex-1 surface flex items-center justify-center text-dim text-sm">{t('gitNotRepo')}</div>
  }

  const staged = status?.files.filter((f) => f.staged) ?? []
  const unstaged = status?.files.filter((f) => !f.staged) ?? []

  return (
    <div className="flex-1 flex min-h-0">
      <aside className="git-side">
        <div className="git-branch-row">
          <select
            className="input git-branch-select"
            value={branches?.current ?? ''}
            onChange={(event) => void checkout(event.target.value)}
          >
            {branches?.branches.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <button className="btn btn-ghost" title={t('gitNewBranch')} onClick={() => setBranchDraft('')}>＋</button>
        </div>
        {branchDraft !== null && (
          <div className="git-branch-draft">
            <input
              className="input" autoFocus placeholder={t('gitBranchName')} value={branchDraft}
              onChange={(event) => setBranchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && branchDraft.trim()) {
                  void createBranch(branchDraft.trim())
                  setBranchDraft(null)
                }
                if (event.key === 'Escape') setBranchDraft(null)
              }}
            />
          </div>
        )}
        {status && (status.ahead > 0 || status.behind > 0) && (
          <div className="text-dim text-xs px-3 py-1">↑{status.ahead} ↓{status.behind}</div>
        )}

        <div className="git-section">
          <div className="git-section-head">
            <span>{t('gitStaged')}（{staged.length}）</span>
            {staged.length > 0 && <button className="btn btn-ghost git-stage-all" onClick={() => void unstage(staged.map((f) => f.path))}>−</button>}
          </div>
          {staged.map((file) => <FileRow key={`s:${file.path}`} file={file} />)}
        </div>
        <div className="git-section">
          <div className="git-section-head">
            <span>{t('gitChanges')}（{unstaged.length}）</span>
            {unstaged.length > 0 && <button className="btn btn-ghost git-stage-all" onClick={() => void stage(unstaged.map((f) => f.path))}>＋</button>}
          </div>
          {unstaged.map((file) => <FileRow key={`u:${file.path}`} file={file} />)}
        </div>

        <div className="git-commit-box">
          <textarea
            className="composer-input git-commit-input" rows={2} placeholder={t('gitCommitPlaceholder')}
            value={message} onChange={(event) => setMessage(event.target.value)}
          />
          <button
            className="btn btn-primary git-commit-btn"
            disabled={staged.length === 0 || message.trim().length === 0}
            onClick={() => void commit(message).then((ok) => { if (ok) setMessage('') })}
          >
            {t('gitCommit')}（{staged.length}）
          </button>
        </div>

        {commits.length > 0 && (
          <div className="git-section git-log">
            <div className="git-section-head"><span>{t('gitLog')}</span></div>
            {commits.map((entry) => (
              <div key={entry.hash} className="git-log-row">
                <code className="git-log-hash">{entry.hash}</code>
                <span className="git-log-msg">{entry.message}</span>
              </div>
            ))}
          </div>
        )}
      </aside>
      <div className="flex-1 flex flex-col min-w-0">
        {error && <div className="conn-banner conn-banner-error">{error}</div>}
        <DiffText diff={diffText} />
      </div>
    </div>
  )
}
