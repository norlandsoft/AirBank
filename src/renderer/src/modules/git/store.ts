import { create } from 'zustand'
import { bridge } from '../../bridge'
import type { GitBranchesView, GitCommitInfo, GitStatusView } from '../../../../shared/types'

interface GitState {
  status: GitStatusView | null
  /** null=未加载；加载后 null 表示非仓库（用 loaded 区分）。 */
  loaded: boolean
  branches: GitBranchesView | null
  commits: GitCommitInfo[]
  /** 当前查看的 diff（文件路径 + 侧）。 */
  selected: { path: string; staged: boolean } | null
  diffText: string
  error: string | null

  refresh(): Promise<void>
  select(path: string, staged: boolean): Promise<void>
  stage(paths: string[]): Promise<void>
  unstage(paths: string[]): Promise<void>
  commit(message: string): Promise<boolean>
  checkout(name: string): Promise<void>
  createBranch(name: string): Promise<void>
}

export const useGit = create<GitState>((set, get) => ({
  status: null,
  loaded: false,
  branches: null,
  commits: [],
  selected: null,
  diffText: '',
  error: null,

  /** 全量刷新（高频触发方自行去抖）。 */
  async refresh() {
    try {
      const status = await bridge.git.status()
      const [branches, commits] = await Promise.all([bridge.git.branches(), bridge.git.log(10)])
      set({ status, branches, commits, loaded: true, error: null })
      const selected = get().selected
      if (selected) {
        const stillThere = status?.files.some((f) => f.path === selected.path && f.staged === selected.staged)
        if (stillThere) {
          set({ diffText: await bridge.git.diff(selected.path, selected.staged) })
        } else {
          set({ selected: null, diffText: '' })
        }
      }
    } catch (error) { set({ error: String(error), loaded: true }) }
  },

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
}))
