import fs from 'node:fs'
import path from 'node:path'
import type { Logger } from './logger'
import type { SettingsService } from './settings'
import type { DshServerManager } from './server'

/**
 * 会话管理（内核 API 之外的桌面端操作）：删除会话。
 * 内核 v1 无 session.delete RPC——实现路径：停内核 → 删除
 * $DSH_HOME/sessions/**&#47;<sessionId>/ 目录 + 擦洗 workspace.json 注册表
 * （archivedSessionIds 与各 workspace 的 sessionIds）→ 重启内核重扫。
 * 不依赖 electron，可 node 直测。
 */
export class SessionAdminService {
  constructor(
    private readonly settings: SettingsService,
    private readonly server: DshServerManager,
    private readonly logger: Logger,
  ) {}

  private sessionsRoot(): string {
    return path.join(this.settings.effectiveDshHome(), 'sessions')
  }

  private workspaceStore(): string {
    return path.join(this.settings.effectiveDshHome(), 'storages', 'workspace.json')
  }

  /** 在 sessions/** 下定位会话目录（cwd 分组层）。 */
  private findSessionDirs(sessionId: string): string[] {
    const root = this.sessionsRoot()
    const hits: string[] = []
    let groups: fs.Dirent[] = []
    try {
      groups = fs.readdirSync(root, { withFileTypes: true })
    } catch {
      return hits
    }
    for (const group of groups) {
      if (!group.isDirectory()) continue
      const candidate = path.join(root, group.name, sessionId)
      if (fs.existsSync(candidate)) hits.push(candidate)
    }
    return hits
  }

  /** 擦洗注册表中该会话的所有引用。返回是否改动。 */
  private scrubRegistry(sessionId: string): boolean {
    const store = this.workspaceStore()
    let doc: {
      global?: { archivedSessionIds?: string[] }
      tables?: Record<string, Record<string, { sessionIds?: string[] }>>
    }
    try {
      doc = JSON.parse(fs.readFileSync(store, 'utf8')) as typeof doc
    } catch {
      return false
    }
    let changed = false
    const archived = doc.global?.archivedSessionIds
    if (Array.isArray(archived) && archived.includes(sessionId)) {
      doc.global!.archivedSessionIds = archived.filter((id) => id !== sessionId)
      changed = true
    }
    for (const table of Object.values(doc.tables ?? {})) {
      for (const row of Object.values(table)) {
        if (Array.isArray(row.sessionIds) && row.sessionIds.includes(sessionId)) {
          row.sessionIds = row.sessionIds.filter((id) => id !== sessionId)
          changed = true
        }
      }
    }
    if (changed) {
      const tmp = `${store}.tmp-${process.pid}`
      fs.writeFileSync(tmp, JSON.stringify(doc), 'utf8')
      fs.renameSync(tmp, store)
    }
    return changed
  }

  /** 删除会话：停内核 → 删目录 + 擦洗注册表 → 重启（原运行状态恢复）。 */
  async deleteSession(sessionId: string): Promise<{ removedDirs: number; scrubbed: boolean }> {
    if (!/^[\w.-]+$/.test(sessionId)) throw new Error(`invalid session id: ${sessionId}`)
    const resume = this.server.getStatus().state === 'running'
    this.logger.info('session-admin', `delete ${sessionId} (resume=${resume})`)
    await this.server.stop()
    try {
      const dirs = this.findSessionDirs(sessionId)
      for (const dir of dirs) fs.rmSync(dir, { recursive: true, force: true })
      const scrubbed = this.scrubRegistry(sessionId)
      if (dirs.length === 0 && !scrubbed) throw new Error(`session not found on disk: ${sessionId}`)
      this.logger.info('session-admin', `deleted ${sessionId}: dirs=${dirs.length} scrubbed=${scrubbed}`)
      return { removedDirs: dirs.length, scrubbed }
    } finally {
      if (resume) await this.server.start()
    }
  }
}
