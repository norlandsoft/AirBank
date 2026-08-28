import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useGit } from './store'
import { useIde } from '../ide/store'
import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import { DiffText } from './DiffText'
import { timeAgo, shortDateTime } from '../../lib/time'
import { useResizableWidth } from '../../lib/resizable'
import type { GitFileState, GitFileStatus } from '../../../../shared/types'
import {
  IconCheck, IconChevronDown, IconDownload, IconGitBranch, IconPlus, IconRepo,
  IconSpinner, IconTrash, IconX,
} from '../../icons'

const STATE_LABEL: Record<GitFileState, string> = {
  modified: 'M', added: 'A', deleted: 'D', renamed: 'R', untracked: 'U', conflicted: 'C',
}

/** 跨平台 basename（仓库路径可能来自 Windows）。 */
const baseName = (p: string): string => p.split(/[\\/]/).filter(Boolean).pop() ?? p

/** 变更列表行：按路径合并暂存/工作区两侧条目；checked = 已暂存（等同 GitHub Desktop 勾选语义）。 */
interface ChangeRow {
  path: string
  state: GitFileState
  staged: boolean
  /** 工作区侧仍有改动（diff 默认看工作区侧）。 */
  dirty: boolean
}

function mergeRows(files: GitFileStatus[]): ChangeRow[] {
  const byPath = new Map<string, ChangeRow>()
  for (const file of files) {
    const row = byPath.get(file.path)
    if (!row) {
      byPath.set(file.path, { path: file.path, state: file.state, staged: file.staged, dirty: !file.staged })
    } else {
      row.staged = row.staged || file.staged
      if (!file.staged) {
        row.dirty = true
        row.state = file.state
      }
    }
  }
  return [...byPath.values()]
}

/** 顶部下拉（仓库/分支共用）：双行头（标签+当前值），点击外部/Esc 关闭。 */
function Dropdown(props: {
  open: boolean
  onOpenChange(open: boolean): void
  icon: ReactNode
  label: string
  value: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { open, onOpenChange } = props
  useEffect(() => {
    if (!open) return
    const onDoc = (event: MouseEvent): void => {
      if (ref.current && !ref.current.contains(event.target as Node)) onOpenChange(false)
    }
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onOpenChange(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onOpenChange])
  return (
    <div className="git-dd" ref={ref}>
      <button className="git-dd-head" onClick={() => onOpenChange(!open)}>
        {props.icon}
        <span className="git-dd-texts">
          <span className="git-dd-label">{props.label}</span>
          <span className="git-dd-value">{props.value}</span>
        </span>
        <IconChevronDown size={13} className="git-dd-caret" />
      </button>
      {open && <div className="git-dd-pop card">{props.children}</div>}
    </div>
  )
}

/** 全选框（支持部分勾选的 indeterminate 态）。 */
function TriCheckbox({ all, some, onToggle }: { all: boolean; some: boolean; onToggle(): void }) {
  const ref = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !all && some
  }, [all, some])
  return <input ref={ref} type="checkbox" checked={all} onChange={onToggle} />
}

/** 仓库下拉菜单：列表 + 添加本地 / 克隆。 */
function RepoMenu({ close, onClone }: { close(): void; onClone(): void }) {
  const t = useT()
  const repos = useGit((state) => state.repos)
  const activateRepo = useGit((state) => state.activateRepo)
  const removeRepo = useGit((state) => state.removeRepo)
  const addRepo = useGit((state) => state.addRepo)

  const pickLocal = async (): Promise<void> => {
    const dir = await bridge.dialogPickDirectory()
    if (dir !== null) {
      if (await addRepo(dir)) close()
    }
  }

  return (
    <div className="git-menu">
      <div className="git-menu-list">
        {repos?.activeSource === 'workspace' && repos.active !== null && (
          <div className="git-repo-row">
            <div className="git-menu-item git-repo-item static">
              <IconRepo size={14} />
              <span className="git-repo-texts">
                <span className="git-repo-name">{baseName(repos.active)}</span>
                <span className="git-repo-path">{repos.active} · {t('gitWorkspaceRepo')}</span>
              </span>
            </div>
          </div>
        )}
        {repos?.repos.map((repo) => (
          <div className="git-repo-row" key={repo.path}>
            <button
              className={`git-menu-item git-repo-item${repo.path === repos.active ? ' active' : ''}`}
              onClick={() => { void activateRepo(repo.path); close() }}
            >
              <IconRepo size={14} />
              <span className="git-repo-texts">
                <span className="git-repo-name">
                  {repo.name}
                  {repo.missing && <span className="pill git-repo-missing">{t('gitRepoMissing')}</span>}
                </span>
                <span className="git-repo-path">{repo.path}</span>
              </span>
              {repo.path === repos.active && <IconCheck size={13} className="git-menu-check" />}
            </button>
            <button
              className="btn btn-ghost git-repo-remove" title={t('gitRemoveRepo')}
              onClick={() => void removeRepo(repo.path)}
            >
              <IconX size={11} />
            </button>
          </div>
        ))}
      </div>
      <div className="git-menu-foot">
        <button className="git-menu-item" onClick={() => void pickLocal()}>
          <IconPlus size={13} /> {t('gitAddLocal')}
        </button>
        <button className="git-menu-item" onClick={() => { close(); onClone() }}>
          <IconDownload size={13} /> {t('gitCloneRepo')}
        </button>
      </div>
    </div>
  )
}

/** 分支下拉菜单：筛选 + 切换 + 新建。 */
function BranchMenu({ close }: { close(): void }) {
  const t = useT()
  const branches = useGit((state) => state.branches)
  const checkout = useGit((state) => state.checkout)
  const createBranch = useGit((state) => state.createBranch)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const filtered = (branches?.branches ?? []).filter((name) =>
    query.trim() === '' || name.toLowerCase().includes(query.trim().toLowerCase()))
  return (
    <div className="git-menu">
      <div className="git-menu-search">
        <input
          className="input" autoFocus placeholder={t('gitFilterBranches')}
          value={query} onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="git-menu-list">
        {filtered.map((name) => (
          <button
            key={name}
            className={`git-menu-item${name === branches?.current ? ' active' : ''}`}
            onClick={() => { void checkout(name); close() }}
          >
            <IconGitBranch size={13} />
            <span className="git-file-path">{name}</span>
            {name === branches?.current && <IconCheck size={13} className="git-menu-check" />}
          </button>
        ))}
      </div>
      <div className="git-menu-foot">
        {creating ? (
          <input
            className="input" autoFocus placeholder={t('gitBranchName')}
            value={draft} onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && draft.trim() !== '') {
                void createBranch(draft.trim())
                close()
              }
              if (event.key === 'Escape') setCreating(false)
            }}
          />
        ) : (
          <button className="git-menu-item" onClick={() => setCreating(true)}>
            <IconPlus size={13} /> {t('gitNewBranch')}
          </button>
        )}
      </div>
    </div>
  )
}

/** Fetch/Pull/Push 三态同步按钮（ahead → Push，behind → Pull，否则 Fetch + 相对时间）。 */
function SyncButton() {
  const t = useT()
  const locale = useApp((state) => state.settings?.locale ?? 'zh-CN')
  const status = useGit((state) => state.status)
  const busy = useGit((state) => state.busy)
  const fetchAction = useGit((state) => state.fetch)
  const pull = useGit((state) => state.pull)
  const push = useGit((state) => state.push)

  const remote = status?.remote ?? null
  const ahead = status?.ahead ?? 0
  const behind = status?.behind ?? 0
  let title = t('gitFetchOrigin')
  let sub = t('gitNeverFetched')
  let action: () => Promise<void> = fetchAction
  if (busy !== null && busy !== 'clone') {
    title = busy === 'push' ? t('gitPushOrigin') : busy === 'pull' ? t('gitPullOrigin') : t('gitFetchOrigin')
    sub = ''
  } else if (behind > 0) {
    title = t('gitPullOrigin')
    sub = t('gitPullHint', { n: String(behind) })
    action = pull
  } else if (ahead > 0) {
    title = t('gitPushOrigin')
    sub = t('gitPushHint', { n: String(ahead) })
    action = push
  } else if (status?.lastFetch != null) {
    sub = t('gitLastFetched', { time: timeAgo(status.lastFetch, locale) })
  }
  if (remote === null) sub = t('gitNoRemote')
  const badge = ahead + behind
  return (
    <div className="git-dd git-sync">
      <button
        className="git-dd-head" disabled={remote === null || busy !== null}
        onClick={() => void action()}
      >
        {busy !== null && busy !== 'clone' ? <IconSpinner size={14} /> : (
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
            strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        )}
        <span className="git-dd-texts">
          <span className="git-dd-value">{title}</span>
          <span className="git-dd-label">{sub}</span>
        </span>
        {badge > 0 && <span className="git-sync-badge">{badge}</span>}
      </button>
    </div>
  )
}

/** 变更列表行：勾选 = 暂存；行点击看 diff；悬停出"放弃更改"。 */
function FileRow({ row }: { row: ChangeRow }) {
  const t = useT()
  const selected = useGit((state) => state.selected)
  const select = useGit((state) => state.select)
  const stage = useGit((state) => state.stage)
  const unstage = useGit((state) => state.unstage)
  const discard = useGit((state) => state.discard)
  const staged = !row.dirty && row.staged
  const active = selected?.path === row.path && selected.staged === staged
  return (
    <div className={`git-file-row hoverable${active ? ' active-nav' : ''}`}>
      <input
        type="checkbox" checked={row.staged}
        onClick={(event) => event.stopPropagation()}
        onChange={() => void (row.staged ? unstage([row.path]) : stage([row.path]))}
      />
      <button className="git-file-main" onClick={() => void select(row.path, staged)}>
        <span className={`git-state git-state-${row.state}`}>{STATE_LABEL[row.state]}</span>
        <span className="git-file-path">{row.path}</span>
      </button>
      <button
        className="btn btn-ghost git-discard-btn" title={t('gitDiscardTitle')}
        onClick={() => { if (window.confirm(t('gitDiscardConfirm'))) void discard([row.path]) }}
      >
        <IconTrash size={11} />
      </button>
    </div>
  )
}

/** 克隆对话框（URL + 目标目录选择）。 */
function CloneDialog({ close }: { close(): void }) {
  const t = useT()
  const busy = useGit((state) => state.busy)
  const cloneRepo = useGit((state) => state.cloneRepo)
  const [url, setUrl] = useState('')
  const [dir, setDir] = useState('')
  const cloning = busy === 'clone'
  const doClone = async (): Promise<void> => {
    if (await cloneRepo(url, dir)) close()
  }
  return (
    <div className="git-modal-mask" onMouseDown={close}>
      <div className="git-modal card" onMouseDown={(event) => event.stopPropagation()}>
        <h3>{t('gitCloneTitle')}</h3>
        <label className="git-modal-field">
          {t('gitCloneUrl')}
          <input
            className="input" autoFocus placeholder="https://github.com/user/repo.git"
            value={url} onChange={(event) => setUrl(event.target.value)}
          />
        </label>
        <label className="git-modal-field">
          {t('gitCloneTo')}
          <div className="git-clone-dir">
            <input className="input" value={dir} readOnly placeholder="…" />
            <button
              className="btn"
              onClick={() => void bridge.dialogPickDirectory().then((picked) => { if (picked !== null) setDir(picked) })}
            >
              {t('gitBrowse')}
            </button>
          </div>
        </label>
        <div className="git-modal-actions">
          <button className="btn" onClick={close}>{t('cancel')}</button>
          <button
            className="btn btn-primary"
            disabled={url.trim() === '' || dir === '' || cloning}
            onClick={() => void doClone()}
          >
            {cloning ? <IconSpinner size={13} /> : null} {t('gitClone')}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Git 面板（GitHub Desktop 风）：顶栏 仓库/分支/同步 三控件 + 变更/历史双页 + 右侧 diff。 */
export function GitPanel() {
  const t = useT()
  const locale = useApp((state) => state.settings?.locale ?? 'zh-CN')
  const { status, loaded, repos, branches, commits, diffText, error, tab } = useGit()
  const refresh = useGit((state) => state.refresh)
  const setTab = useGit((state) => state.setTab)
  const stage = useGit((state) => state.stage)
  const unstage = useGit((state) => state.unstage)
  const commit = useGit((state) => state.commit)
  const select = useGit((state) => state.select)
  const selected = useGit((state) => state.selected)
  const selectedCommit = useGit((state) => state.selectedCommit)
  const selectCommit = useGit((state) => state.selectCommit)
  const commitFiles = useGit((state) => state.commitFiles)
  const selectedCommitFile = useGit((state) => state.selectedCommitFile)
  const selectCommitFile = useGit((state) => state.selectCommitFile)
  const commitDiff = useGit((state) => state.commitDiff)
  const root = useIde((state) => state.root)
  const [summary, setSummary] = useState('')
  const [desc, setDesc] = useState('')
  const [filter, setFilter] = useState('')
  const [menu, setMenu] = useState<'repo' | 'branch' | null>(null)
  const [cloneOpen, setCloneOpen] = useState(false)
  const sideSplit = useResizableWidth('git-side', 300)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { void refresh() }, [refresh, root])

  // 文件系统变更 → 300ms 去抖刷新
  useEffect(() => {
    return bridge.onWorkspaceChange(() => {
      if (debounceRef.current !== null) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => void refresh(), 300)
    })
  }, [refresh])

  const allRows = useMemo(() => mergeRows(status?.files ?? []), [status?.files])
  const rows = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q === '' ? allRows : allRows.filter((row) => row.path.toLowerCase().includes(q))
  }, [allRows, filter])

  const filteredCommits = useMemo(() => {
    const q = filter.trim().toLowerCase()
    return q === '' ? commits : commits.filter((entry) =>
      entry.message.toLowerCase().includes(q) || entry.author.toLowerCase().includes(q) || entry.hash.startsWith(q))
  }, [commits, filter])

  // 变更页无选中时自动选中第一个文件（GitHub Desktop 行为）
  useEffect(() => {
    if (tab === 'changes' && selected === null && rows.length > 0) {
      void select(rows[0].path, !rows[0].dirty && rows[0].staged)
    }
  }, [tab, rows, selected, select])

  const activeName = repos?.active ? baseName(repos.active) : '—'
  const branchName = branches?.current ?? status?.branch ?? '—'
  const stagedRows = rows.filter((row) => row.staged)
  const stagedTotal = allRows.filter((row) => row.staged).length
  const allStaged = rows.length > 0 && stagedRows.length === rows.length

  const doCommit = async (): Promise<void> => {
    const message = desc.trim() === '' ? summary : `${summary}\n\n${desc}`
    if (await commit(message)) {
      setSummary('')
      setDesc('')
    }
  }

  const commitEntry = commits.find((entry) => entry.hash === selectedCommit) ?? null

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="git-topbar">
        <Dropdown
          open={menu === 'repo'} onOpenChange={(open) => setMenu(open ? 'repo' : null)}
          icon={<IconRepo size={15} />} label={t('gitCurrentRepo')} value={activeName}
        >
          <RepoMenu close={() => setMenu(null)} onClone={() => setCloneOpen(true)} />
        </Dropdown>
        <Dropdown
          open={menu === 'branch'} onOpenChange={(open) => setMenu(open ? 'branch' : null)}
          icon={<IconGitBranch size={15} />} label={t('gitCurrentBranch')} value={branchName}
        >
          <BranchMenu close={() => setMenu(null)} />
        </Dropdown>
        <SyncButton />
      </header>

      {error && <div className="conn-banner conn-banner-error">{error}</div>}

      {!loaded || repos === null ? (
        <div className="flex-1 surface flex items-center justify-center"><IconSpinner size={22} /></div>
      ) : repos.active === null ? (
        <div className="git-empty flex-1 surface">
          <IconRepo size={34} />
          <h2>{t('gitEmptyTitle')}</h2>
          <p className="text-dim">{t('gitEmptyDesc')}</p>
          <div className="git-empty-actions">
            <button
              className="btn"
              onClick={() => void bridge.dialogPickDirectory().then(async (dir) => {
                if (dir !== null) await useGit.getState().addRepo(dir)
              })}
            >
              <IconPlus size={13} /> {t('gitAddLocal')}
            </button>
            <button className="btn" onClick={() => setCloneOpen(true)}>
              <IconDownload size={13} /> {t('gitCloneRepo')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <aside className="git-side" style={{ width: sideSplit.width }}>
            <div className="git-tabs">
              <button
                className={`git-tab${tab === 'changes' ? ' git-tab-active' : ''}`}
                onClick={() => { setFilter(''); setTab('changes') }}
              >
                {t('gitChanges')}
                {allRows.length > 0 && <span className="git-tab-badge">{allRows.length}</span>}
              </button>
              <button
                className={`git-tab${tab === 'history' ? ' git-tab-active' : ''}`}
                onClick={() => { setFilter(''); setTab('history') }}
              >
                {t('gitHistory')}
              </button>
            </div>

            <div className="git-filter">
              <input
                className="input" value={filter}
                placeholder={t(tab === 'changes' ? 'gitFilterFiles' : 'gitFilterCommits')}
                onChange={(event) => setFilter(event.target.value)}
              />
            </div>

            {tab === 'changes' ? (
              <>
                <div className="git-changes-head">
                  <TriCheckbox
                    all={allStaged} some={stagedRows.length > 0}
                    onToggle={() => void (allStaged
                      ? unstage(stagedRows.map((row) => row.path))
                      : stage(rows.filter((row) => !row.staged).map((row) => row.path)))}
                  />
                  <span>{t('gitChangedFiles', { n: String(rows.length) })}</span>
                </div>
                <div className="git-file-list">
                  {rows.map((row) => <FileRow key={row.path} row={row} />)}
                </div>
                <div className="git-commit-box">
                  <input
                    className="input git-summary" placeholder={t('gitSummary')}
                    value={summary} onChange={(event) => setSummary(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && summary.trim() !== '' && stagedTotal > 0) void doCommit()
                    }}
                  />
                  <textarea
                    className="composer-input git-desc" rows={2} placeholder={t('gitDescription')}
                    value={desc} onChange={(event) => setDesc(event.target.value)}
                  />
                  <button
                    className="btn btn-primary git-commit-btn"
                    disabled={stagedTotal === 0 || summary.trim() === ''}
                    onClick={() => void doCommit()}
                  >
                    {t('gitCommitTo', { branch: branchName })}
                  </button>
                </div>
              </>
            ) : (
              <div className="git-commit-list">
                {filteredCommits.map((entry) => (
                  <button
                    key={entry.hash}
                    className={`git-commit-row hoverable${entry.hash === selectedCommit ? ' active-nav' : ''}`}
                    onClick={() => void selectCommit(entry.hash)}
                  >
                    <span className="git-commit-msg">{entry.message}</span>
                    <span className="git-commit-meta">
                      {entry.author} · {timeAgo(entry.date, locale)} · <code>{entry.hash.slice(0, 7)}</code>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </aside>
          {sideSplit.handle}

          {tab === 'changes' ? (
            allRows.length === 0 ? (
              <div className="git-hero flex-1 surface">
                <h1>{t('gitNoChanges')}</h1>
                <p className="text-dim">{t('gitNoChangesDesc')}</p>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-w-0">
                {selected !== null && (
                  <div className="git-diff-label">
                    <span className="git-file-path">{selected.path}</span>
                    <span className="pill">{selected.staged ? t('gitStagedChanges') : t('gitWorkingTree')}</span>
                  </div>
                )}
                <DiffText diff={diffText} />
              </div>
            )
          ) : (
            <div className="flex-1 flex flex-col min-w-0">
              {commitEntry === null ? (
                <div className="git-hero flex-1 surface">
                  <p className="text-dim">{t('gitSelectCommitHint')}</p>
                </div>
              ) : (
                <>
                  <div className="git-detail-head">
                    <div className="git-detail-msg">{commitEntry.message}</div>
                    <div className="git-detail-meta">
                      <span>{commitEntry.author}</span>
                      <span>{shortDateTime(commitEntry.date, locale)}</span>
                      <code>{commitEntry.hash.slice(0, 7)}</code>
                      <span>{t('gitCommitFiles', { n: String(commitFiles.length) })}</span>
                      {status?.repoRoot && (
                        <button
                          className="btn btn-ghost git-show-item"
                          onClick={() => void bridge.shell.showItem(status.repoRoot)}
                        >
                          {t('gitShowInFolder')}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="git-detail-body">
                    <div className="git-detail-files">
                      {commitFiles.map((file) => (
                        <button
                          key={file.path}
                          className={`git-detail-file hoverable${file.path === selectedCommitFile ? ' active-nav' : ''}`}
                          onClick={() => void selectCommitFile(file.path)}
                        >
                          <span className={`git-state git-state-${file.state}`}>{STATE_LABEL[file.state]}</span>
                          <span className="git-file-path">{file.path}</span>
                        </button>
                      ))}
                    </div>
                    <DiffText diff={commitDiff} />
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {cloneOpen && <CloneDialog close={() => setCloneOpen(false)} />}
    </div>
  )
}
