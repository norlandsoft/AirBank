import { create } from 'zustand'
import { bridge } from '../../bridge'
import type {
  GitBranchesView, GitCommitFile, GitCommitInfo, GitReposView, GitStatusView,
} from '../../../../shared/types'

export type GitTab = 'changes' | 'history'
export type GitBusy = 'fetch' | 'pull' | 'push' | 'clone' | null

interface GitState {
  status: GitStatusView | null
  /** null=未加载；加载后 null 表示无生效仓库（用 loaded 区分）。 */
  loaded: boolean
  /** 仓库列表 + 生效仓库（多仓库管理）。 */
  repos: GitReposView | null
  branches: GitBranchesView | null
  commits: GitCommitInfo[]
  tab: GitTab
  /** 变更页当前查看的 diff（文件路径 + 侧）。 */
  selected: { path: string; staged: boolean } | null
  diffText: string
  /** 历史页：选中提交与其文件/单文件 diff。 */
  selectedCommit: string | null
  commitFiles: GitCommitFile[]
  selectedCommitFile: string | null
  commitDiff: string
  /** 远端操作进行中（顶栏按钮 spinner）。 */
  busy: GitBusy
  error: string | null

  refresh(): Promise<void>
  setTab(tab: GitTab): void
  select(path: string, staged: boolean): Promise<void>
  stage(paths: string[]): Promise<void>
  unstage(paths: string[]): Promise<void>
  commit(message: string): Promise<boolean>
  checkout(name: string): Promise<void>
  createBranch(name: string): Promise<void>
  addRepo(path: string): Promise<boolean>
  cloneRepo(url: string, parentDir: string): Promise<boolean>
  removeRepo(path: string): Promise<void>
  activateRepo(path: string | null): Promise<void>
  fetch(): Promise<void>
  pull(): Promise<void>
  push(): Promise<void>
  discard(paths: string[]): Promise<void>
  selectCommit(hash: string | null): Promise<void>
  selectCommitFile(path: string): Promise<void>
}

export const useGit = create<GitState>((set, get) => ({
  status: null,
  loaded: false,
  repos: null,
  branches: null,
  commits: [],
  tab: 'changes',
  selected: null,
  diffText: '',
  selectedCommit: null,
  commitFiles: [],
  selectedCommitFile: null,
  commitDiff: '',
  busy: null,
  error: null,

  /** 全量刷新（高频触发方自行去抖）。 */
  async refresh() {
    try {
      const status = await bridge.git.status()
      const [repos, branches, commits] = await Promise.all([
        bridge.git.repos(), bridge.git.branches(), bridge.git.log(50),
      ])
      set({ status, repos, branches, commits, loaded: true, error: null })
      const selected = get().selected
      if (selected) {
        const stillThere = status?.files.some((f) => f.path === selected.path && f.staged === selected.staged)
        if (stillThere) {
          set({ diffText: await bridge.git.diff(selected.path, selected.staged) })
        } else {
          set({ selected: null, diffText: '' })
        }
      }
      const commitHash = get().selectedCommit
      if (commitHash && !commits.some((entry) => entry.hash === commitHash)) {
        set({ selectedCommit: null, commitFiles: [], selectedCommitFile: null, commitDiff: '' })
      }
    } catch (error) { set({ error: String(error), loaded: true }) }
  },

  setTab(tab) { set({ tab }) },

  async select(path, staged) {
    set({ selected: { path, staged } })
    try {
      set({ diffText: await bridge.git.diff(path, staged), error: null })
    } catch (error) { set({ error: String(error) }) }
  },

  async stage(paths) {
    try {
      await bridge.git.stage(paths)
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async unstage(paths) {
    try {
      await bridge.git.unstage(paths)
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async commit(message) {
    if (message.trim().length === 0) return false
    try {
      await bridge.git.commit(message.trim())
      await get().refresh()
      return true
    } catch (error) {
      set({ error: String(error) })
      return false
    }
  },

  async checkout(name) {
    try {
      await bridge.git.checkout(name)
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async createBranch(name) {
    try {
      await bridge.git.createBranch(name)
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async addRepo(path) {
    try {
      set({ repos: await bridge.git.addRepo(path), selected: null, diffText: '', selectedCommit: null, error: null })
      await get().refresh()
      return true
    } catch (error) {
      set({ error: String(error) })
      return false
    }
  },

  async cloneRepo(url, parentDir) {
    set({ busy: 'clone' })
    try {
      set({ repos: await bridge.git.cloneRepo(url, parentDir), selected: null, diffText: '', selectedCommit: null, error: null })
      await get().refresh()
      return true
    } catch (error) {
      set({ error: String(error) })
      return false
    } finally {
      set({ busy: null })
    }
  },

  async removeRepo(path) {
    try {
      set({ repos: await bridge.git.removeRepo(path), selected: null, diffText: '', selectedCommit: null, error: null })
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async activateRepo(path) {
    try {
      set({ repos: await bridge.git.activateRepo(path), selected: null, diffText: '', selectedCommit: null, error: null })
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async fetch() { await runRemote(set, get, 'fetch') },
  async pull() { await runRemote(set, get, 'pull') },
  async push() { await runRemote(set, get, 'push') },

  async discard(paths) {
    try {
      await bridge.git.discard(paths)
      await get().refresh()
    } catch (error) { set({ error: String(error) }) }
  },

  async selectCommit(hash) {
    if (hash === null) {
      set({ selectedCommit: null, commitFiles: [], selectedCommitFile: null, commitDiff: '' })
      return
    }
    set({ selectedCommit: hash })
    try {
      const files = await bridge.git.commitFiles(hash)
      const first = files[0]?.path ?? null
      set({ commitFiles: files, selectedCommitFile: first, error: null })
      set({ commitDiff: first === null ? '' : await bridge.git.commitDiff(hash, first) })
    } catch (error) { set({ error: String(error) }) }
  },

  async selectCommitFile(path) {
    const hash = get().selectedCommit
    if (hash === null) return
    set({ selectedCommitFile: path })
    try {
      set({ commitDiff: await bridge.git.commitDiff(hash, path), error: null })
    } catch (error) { set({ error: String(error) }) }
  },
}))

/** fetch/pull/push 公共骨架：busy 标记 + 完成后全量刷新。 */
async function runRemote(
  set: (partial: Partial<GitState>) => void,
  get: () => GitState,
  op: 'fetch' | 'pull' | 'push',
): Promise<void> {
  if (get().busy !== null) return
  set({ busy: op })
  try {
    await bridge.git[op]()
    await get().refresh()
  } catch (error) {
    set({ error: String(error) })
  } finally {
    set({ busy: null })
  }
}
