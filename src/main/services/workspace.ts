import fs from 'node:fs/promises'
import path from 'node:path'
import { watch, type FSWatcher } from 'chokidar'
import type { Logger } from './logger'
import type { FileRead, FsEntry, WalkResult } from '../../shared/types'

export type { FileRead, FsEntry, WalkResult }

/** 工作区文件变更事件（rel 为 POSIX 相对路径）。 */
export interface WorkspaceChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  rel: string
}

const MAX_READ_BYTES = 2 * 1024 * 1024
const WALK_CAP = 8000
/** 树/遍历双向忽略的目录名（噪音与巨型目录）。 */
const IGNORE = new Set(['node_modules', '.git', 'dist', 'release', 'out', 'build', '.next', '.cache', 'coverage', '.dsh', '.idea', '.vscode'])

const toRel = (root: string, abs: string): string => path.relative(root, abs).split(path.sep).join('/')

/**
 * 工作区文件服务（IDE 模块的磁盘面）：懒加载目录树、读/写、遍历。
 * 全部路径限制在 root 内（字典序 + realpath 双重校验，防 .. 与符号链接逃逸）。
 * 不依赖 electron，可 node 直测；root 的持久化由调用方经 settings.ideRoot 负责。
 */
export class WorkspaceService {
  private root: string | null = null
  private watcher: FSWatcher | null = null
  private readonly changeListeners = new Set<(event: WorkspaceChangeEvent) => void>()

  constructor(private readonly logger: Logger) {}

  getRoot(): string | null {
    return this.root
  }

  async setRoot(dir: string | null): Promise<void> {
    await this.stopWatch()
    if (dir === null || dir.trim() === '') {
      this.root = null
      return
    }
    const stat = await fs.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) throw new Error(`not a directory: ${dir}`)
    this.root = await fs.realpath(dir)
    this.logger.info('workspace', `root = ${this.root}`)
    this.startWatch()
  }

  /** 订阅文件变更（chokidar，忽略 IGNORE 目录，写完成防抖 200ms）。 */
  onDidChange(listener: (event: WorkspaceChangeEvent) => void): () => void {
    this.changeListeners.add(listener)
    return () => this.changeListeners.delete(listener)
  }

  private startWatch(): void {
    const root = this.requireRoot()
    this.watcher = watch(root, {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
      ignored: (target) => target.split(/[/\\]/).some((segment) => IGNORE.has(segment)),
    })
    this.watcher.on('all', (type, target) => {
      const event: WorkspaceChangeEvent = { type: type as WorkspaceChangeEvent['type'], rel: toRel(root, target) }
      for (const listener of this.changeListeners) {
        try { listener(event) } catch (error) { this.logger.warn('workspace', `change listener error: ${String(error)}`) }
      }
    })
    this.watcher.on('error', (error) => this.logger.warn('workspace', `watch error: ${String(error)}`))
  }

  private async stopWatch(): Promise<void> {
    const watcher = this.watcher
    this.watcher = null
    if (watcher) await watcher.close()
  }

  async dispose(): Promise<void> {
    await this.stopWatch()
  }

  private requireRoot(): string {
    if (!this.root) throw new Error('workspace root is not set')
    return this.root
  }

  /** rel → 绝对路径，强制 containment。 */
  private resolve(rel: string): string {
    const root = this.requireRoot()
    const abs = path.resolve(root, rel)
    if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error(`path escapes workspace root: ${rel}`)
    return abs
  }

  /** 已存在路径的符号链接逃逸校验（写入新文件时校验其父链）。 */
  private async assertRealContained(abs: string): Promise<void> {
    const root = this.requireRoot()
    const probe = await fs.realpath(abs).catch(() => null)
    if (probe !== null && probe !== root && !probe.startsWith(root + path.sep)) {
      throw new Error(`path escapes workspace root (symlink): ${abs}`)
    }
  }

  /** 单层目录列表（rel 为空串表示 root 自身）；目录在前、名称字典序。 */
  async list(rel = ''): Promise<FsEntry[]> {
    const abs = this.resolve(rel)
    await this.assertRealContained(abs)
    const dirents = await fs.readdir(abs, { withFileTypes: true })
    const entries: FsEntry[] = []
    for (const dirent of dirents) {
      if (IGNORE.has(dirent.name)) continue
      const childAbs = path.join(abs, dirent.name)
      const kind = dirent.isDirectory() ? 'dir' : dirent.isFile() ? 'file' : null
      if (!kind) continue
      const stat = await fs.stat(childAbs).catch(() => null)
      entries.push({ name: dirent.name, rel: toRel(this.requireRoot(), childAbs), kind, size: stat?.size ?? 0 })
    }
    entries.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
    return entries
  }

  async readFile(rel: string): Promise<FileRead> {
    const abs = this.resolve(rel)
    await this.assertRealContained(abs)
    const stat = await fs.stat(abs)
    if (stat.size > MAX_READ_BYTES) {
      return { content: '', size: stat.size, readonly: true, binary: false, tooLarge: true }
    }
    const buffer = await fs.readFile(abs)
    const probe = buffer.subarray(0, Math.min(buffer.length, 8000))
    if (probe.includes(0)) {
      return { content: '', size: stat.size, readonly: true, binary: true, tooLarge: false }
    }
    const writable = await fs.access(abs, fs.constants.W_OK).then(() => true, () => false)
    return { content: buffer.toString('utf8'), size: stat.size, readonly: !writable, binary: false, tooLarge: false }
  }

  /** 原子写（临时文件 + 改名）；目标或父链逃逸 root 时拒绝。 */
  async writeFile(rel: string, content: string): Promise<void> {
    const abs = this.resolve(rel)
    const parent = path.dirname(abs)
    await this.assertRealContained(parent)
    const tmp = `${abs}.aircode-tmp-${process.pid}`
    await fs.writeFile(tmp, content, 'utf8')
    await fs.rename(tmp, abs)
  }

  /** 全量文件遍历（⌘P 快速打开用）：跳过 IGNORE 目录，封顶 WALK_CAP。 */
  async walk(): Promise<WalkResult> {
    const root = this.requireRoot()
    const files: string[] = []
    let truncated = false
    const visit = async (dir: string): Promise<void> => {
      if (truncated) return
      const dirents = await fs.readdir(dir, { withFileTypes: true }).catch(() => [])
      for (const dirent of dirents) {
        if (truncated) return
        if (dirent.isDirectory()) {
          if (!IGNORE.has(dirent.name)) await visit(path.join(dir, dirent.name))
        } else if (dirent.isFile()) {
          files.push(toRel(root, path.join(dir, dirent.name)))
          if (files.length >= WALK_CAP) truncated = true
        }
      }
    }
    await visit(root)
    files.sort()
    return { files, truncated }
  }
}
