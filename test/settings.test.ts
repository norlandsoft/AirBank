import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { makePaths } from '../src/main/core/paths'
import { SettingsService, defaultSettings, sanitizeSettings } from '../src/main/services/settings'

let dir: string
let paths: ReturnType<typeof makePaths>

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-settings-'))
  paths = makePaths(dir)
})
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

describe('sanitizeSettings', () => {
  it('非对象输入回落默认', () => {
    expect(sanitizeSettings(null, paths)).toEqual(defaultSettings(paths))
    expect(sanitizeSettings('x', paths)).toEqual(defaultSettings(paths))
  })
  it('非法字段被清洗、未知字段被丢弃', () => {
    const out = sanitizeSettings({ locale: 'fr', theme: 'neon', port: 80, evil: true, autoStart: true }, paths)
    expect(out.locale).toBe('zh-CN')
    expect(out.theme).toBe('system')
    expect(out.port).toBe(3080)
    expect(out.autoStart).toBe(true)
    expect('evil' in out).toBe(false)
  })
  it('端口边界', () => {
    expect(sanitizeSettings({ port: 1023 }, paths).port).toBe(3080)
    expect(sanitizeSettings({ port: 65536 }, paths).port).toBe(3080)
    expect(sanitizeSettings({ port: 4000 }, paths).port).toBe(4000)
  })
})

describe('SettingsService', () => {
  it('patch 持久化并可重载', () => {
    const service = new SettingsService(paths)
    service.load()
    service.patch({ port: 3999, locale: 'en-US', activeProfile: 'work' })
    const reloaded = new SettingsService(paths)
    reloaded.load()
    expect(reloaded.get().port).toBe(3999)
    expect(reloaded.get().locale).toBe('en-US')
    expect(reloaded.get().activeProfile).toBe('work')
  })
  it('损坏文件回落默认', () => {
    fs.writeFileSync(paths.settingsFile, '{oops')
    const service = new SettingsService(paths)
    expect(service.load().port).toBe(3080)
  })
  it('effectiveDshHome 空串回落默认目录', () => {
    const service = new SettingsService(paths)
    service.load()
    expect(service.effectiveDshHome()).toBe(paths.dshHomeDefault)
    service.patch({ dshHome: '/custom/home' })
    expect(service.effectiveDshHome()).toBe('/custom/home')
  })
  it('onChange 触发', () => {
    const service = new SettingsService(paths)
    service.load()
    let called = 0
    service.onChange(() => called++)
    service.patch({ useMirror: true })
    expect(called).toBe(1)
  })
})
