import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SessionAdminService } from '../src/main/services/session-admin'
import { SettingsService } from '../src/main/services/settings'
import { makePaths } from '../src/main/core/paths'
import { Logger } from '../src/main/services/logger'

let userData: string
let dshHome: string
let service: SessionAdminService

const SID = 'session-deadbeef-0000-4000-8000-abcdefabcdef'

function seed(): void {
  fs.mkdirSync(path.join(dshHome, 'sessions', '--opt-x--', SID), { recursive: true })
  fs.writeFileSync(path.join(dshHome, 'sessions', '--opt-x--', SID, 'session.jsonl.zstd'), 'fake')
  fs.mkdirSync(path.join(dshHome, 'storages'), { recursive: true })
  fs.writeFileSync(path.join(dshHome, 'storages', 'workspace.json'), JSON.stringify({
    unit: { name: 'workspace', version: 2 },
    global: { initialized: true, workspaceIds: ['w1'], archivedSessionIds: [SID, 'session-other'] },
    tables: { workspaces: { w1: { sessionIds: [SID, 'session-other'] } } },
  }))
}

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-sadm-'))
  const paths = makePaths(userData)
  const settings = new SettingsService(paths)
  settings.load()
  settings.patch({ dshHome: path.join(userData, 'dsh-home') })
  dshHome = settings.effectiveDshHome()
  service = new SessionAdminService(settings, new Logger(null))
  seed()
})

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true })
})

describe('SessionAdminService.deleteSession', () => {
  it('删除会话目录并擦洗注册表，不触碰内核进程', async () => {
    const result = await service.deleteSession(SID)
    expect(result).toEqual({ removedDirs: 1, scrubbed: true })
    expect(fs.existsSync(path.join(dshHome, 'sessions', '--opt-x--', SID))).toBe(false)
    const registry = JSON.parse(fs.readFileSync(path.join(dshHome, 'storages', 'workspace.json'), 'utf8')) as {
      global: { archivedSessionIds: string[] }
      tables: { workspaces: Record<string, { sessionIds: string[] }> }
    }
    expect(registry.global.archivedSessionIds).toEqual(['session-other'])
    expect(registry.tables.workspaces.w1.sessionIds).toEqual(['session-other'])
  })

  it('会话不存在（磁盘无目录且注册表无引用）时抛错', async () => {
    // 先用一个从未写盘的 id：目录不存在、注册表也无引用
    const absent = 'session-nonexistent-0000-4000-8000-000000000000'
    await expect(service.deleteSession(absent)).rejects.toThrow('not found')
  })

  it('非法 id 直接拒绝且不做任何删除', async () => {
    await expect(service.deleteSession('../evil')).rejects.toThrow('invalid session id')
    expect(fs.existsSync(path.join(dshHome, 'sessions', '--opt-x--', SID))).toBe(true)
  })
})
