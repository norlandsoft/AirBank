import { create } from 'zustand'
import { bridge } from '../../bridge'
import { useApp } from '../../store'
import { replaceEditorDoc } from './editor-registry'
import type { FsEntry, WorkspaceChangeEvent } from '../../../../shared/types'

/** 打开的文件（content 与编辑器双向同步；dirty=未保存）。 */
export interface OpenFile {
  rel: string
  content: string
  savedContent: string
  readonly: boolean
  binary: boolean
  tooLarge: boolean
}

interface IdeState {
  root: string | null
  /** 目录缓存：rel → 子项（懒加载，展开时填充）。 */
  dirs: Record<string, FsEntry[]>
  expanded: Record<string, boolean>
  openFiles: OpenFile[]
  activePath: string | null
  /** 外部变更与未保存内容冲突的文件。 */
  conflicts: Record<string, boolean>
  /** Diff 审阅模式（活动文件：磁盘版 vs 当前编辑）。 */
  diffOpen: boolean
  error: string | null

  init(): Promise<void>
  pickRoot(): Promise<void>
  toggleDir(rel: string): Promise<void>
  refreshDir(rel: string): Promise<void>
  openFile(rel: string): Promise<void>
  closeFile(rel: string): void
  setActive(rel: string): void
  setDiffOpen(open: boolean): void
  markDirty(rel: string, content: string): void
  saveActive(): Promise<void>
}

export const useIde = create<IdeState>((set, get) => {
  let watchWired = false

  /** 外部文件变更处理：刷新目录缓存；干净文件自动重载，脏文件标冲突。 */
  const handleChange = async (event: WorkspaceChangeEvent): Promise<void> => {
    const state = get()
    const parent = event.rel.includes('/') ? event.rel.slice(0, event.rel.lastIndexOf('/')) : ''
    if (state.dirs[parent]) await state.refreshDir(parent)
    if (parent !== '' && state.dirs['']) await state.refreshDir('')
    const file = get().openFiles.find((f) => f.rel === event.rel)
    if (!file) return
    if (event.type === 'unlink') {
      if (file.content !== file.savedContent) set((s) => ({ conflicts: { ...s.conflicts, [file.rel]: true } }))
      return
    }
    if (event.type !== 'change') return
    if (file.content === file.savedContent) {
      const read = await bridge.workspace.read(file.rel).catch(() => null)
      if (read && !read.binary && !read.tooLarge && read.content !== file.content) {
        set((s) => ({
          openFiles: s.openFiles.map((f) => (f.rel === file.rel ? { ...f, content: read.content, savedContent: read.content } : f)),
          conflicts: { ...s.conflicts, [file.rel]: false },
        }))
        replaceEditorDoc(file.rel, read.content)
      }
    } else {
      const read = await bridge.workspace.read(file.rel).catch(() => null)
      if (read && read.content !== file.savedContent) set((s) => ({ conflicts: { ...s.conflicts, [file.rel]: true } }))
    }
  }

  const wireWatcher = (): void => {
    if (watchWired) return
    watchWired = true
    bridge.onWorkspaceChange((event) => { void handleChange(event) })
  }

  return {
  root: null,
  dirs: {},
  expanded: {},
  openFiles: [],
  activePath: null,
  conflicts: {},
  diffOpen: false,
  error: null,

  async init() {
    wireWatcher()
    try {
      const root = await bridge.workspace.root()
      set({ root })
      if (root) await get().refreshDir('')
    } catch { /* 桥不可用（纯 vite dev） */ }
  },

  async pickRoot() {
    try {
      const dir = await bridge.workspace.pickRoot()
      if (dir) {
        set({ root: dir, dirs: {}, expanded: {}, openFiles: [], activePath: null, conflicts: {}, diffOpen: false, error: null })
        await get().refreshDir('')
      }
    } catch (error) { set({ error: String(error) }) }
  },

  async toggleDir(rel) {
    const expanded = { ...get().expanded, [rel]: !get().expanded[rel] }
    set({ expanded })
    if (expanded[rel] && !get().dirs[rel]) await get().refreshDir(rel)
  },

  async refreshDir(rel) {
    try {
      const entries = await bridge.workspace.list(rel)
      set((state) => ({ dirs: { ...state.dirs, [rel]: entries }, error: null }))
    } catch (error) { set({ error: String(error) }) }
  },

  async openFile(rel) {
    const existing = get().openFiles.find((f) => f.rel === rel)
    if (existing) {
      set({ activePath: rel })
      return
    }
    try {
      const read = await bridge.workspace.read(rel)
      const file: OpenFile = {
        rel,
        content: read.content,
        savedContent: read.content,
        readonly: read.readonly,
        binary: read.binary,
        tooLarge: read.tooLarge,
      }
      set((state) => ({ openFiles: [...state.openFiles, file], activePath: rel, error: null }))
    } catch (error) { set({ error: String(error) }) }
  },

  closeFile(rel) {
    set((state) => {
      const openFiles = state.openFiles.filter((f) => f.rel !== rel)
      const conflicts = { ...state.conflicts }
      delete conflicts[rel]
      const activePath = state.activePath === rel ? (openFiles[openFiles.length - 1]?.rel ?? null) : state.activePath
      return { openFiles, activePath, conflicts }
    })
  },

  setActive(rel) { set({ activePath: rel }) },

  setDiffOpen(open) { set({ diffOpen: open }) },

  markDirty(rel, content) {
    set((state) => ({
      openFiles: state.openFiles.map((f) => (f.rel === rel ? { ...f, content } : f)),
    }))
  },

  async saveActive() {
    const { activePath, openFiles } = get()
    const file = openFiles.find((f) => f.rel === activePath)
    if (!file || file.readonly || file.content === file.savedContent) return
    try {
      // 保存时格式化：项目 prettier 优先、内置兜底；不支持的语言原样通过
      const formatOnSave = useApp.getState().settings?.formatOnSave ?? false
      const result = formatOnSave
        ? await bridge.workspace.format(file.rel, file.content)
        : { content: file.content, formatted: false }
      await bridge.workspace.write(file.rel, result.content)
      if (result.content !== file.content) replaceEditorDoc(file.rel, result.content)
      set((state) => ({
        openFiles: state.openFiles.map((f) => (f.rel === file.rel ? { ...f, content: result.content, savedContent: result.content } : f)),
        conflicts: { ...state.conflicts, [file.rel]: false },
        error: null,
      }))
    } catch (error) { set({ error: String(error) }) }
  },
  }
})
