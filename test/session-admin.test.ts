import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SessionAdminService } from '../src/main/services/session-admin'
import { SettingsService } from '../src/main/services/settings'
import type { DshServerManager } from '../src/main/services/server'
import type { ServerStatus } from '../src/shared/types'
import { makePaths } from '../src/main/core/paths'
import { Logger } from '../src/main/services/logger'

let userData: string
let dshHome: string
let service: SessionAdminService
let stopCalls: number
let startCalls: number

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
  stopCalls = 0
  startCalls = 0
  const fakeServer = {
    getStatus: (): ServerStatus => ({ state: 'running', url: 'http://127.0.0.1:1/', port: 1, pid: 1, profile: 'web', detail: null }),
    stop: () => { stopCalls += 1; return Promise.resolve({} as ServerStatus) },
    start: () => { startCalls += 1; return Promise.resolve({} as ServerStatus) },
  } as unknown as DshServerManager
  service = new SessionAdminService(settings, fakeServer, new Logger(null))
  seed()
})

afterEach(() => {
  fs.rmSync(userData, { recursive: true, force: true })
})

describe('SessionAdminService.deleteSession', () => {
  it('删除会话目录并擦洗注册表，停启内核各一次', async () => {
    const result = await service.deleteSession(SID)
    expect(result).toEqual({ removedDirs: 1, scrubbed: true })
    expect(fs.existsSync(path.join(dshHome, 'sessions', '--opt-x--', SID))).toBe(false)
    const registry = JSON.parse(fs.readFileSync(path.join(dshHome, 'storages', 'workspace.json'), 'utf8')) as {
      global: { archivedSessionIds: string[] }
      tables: { workspaces: Record<string, { sessionIds: string[] }> }
    }
    expect(registry.global.archivedSessionIds).toEqual(['session-other'])
    expect(registry.tables.workspaces.w1.sessionIds).toEqual(['session-other'])
    expect(stopCalls).toBe(1)
    expect(startCalls).toBe(1)
  })

  it('会话不存在时抛错但仍恢复内核', async () => {
    await expect(service.deleteSession('session-nonexistent')).rejects.toThrow('not found')
    expect(stopCalls).toBe(1)
    expect(startCalls).toBe(1)
  })

  it('非法 id 直接拒绝且不动内核', async () => {
    await expect(service.deleteSession('../evil')).rejects.toThrow('invalid session id')
    expect(stopCalls).toBe(0)
    expect(startCalls).toBe(0)
  })
})
