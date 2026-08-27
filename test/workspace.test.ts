import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'

let rootDir: string
let service: WorkspaceService

beforeEach(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-ws-'))
  fs.mkdirSync(path.join(rootDir, 'src', 'deep'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'src', 'a.ts'), 'const a = 1\n')
  fs.writeFileSync(path.join(rootDir, 'src', 'deep', 'b.md'), '# b\n')
  fs.writeFileSync(path.join(rootDir, 'README.md'), '# readme\n')
  fs.mkdirSync(path.join(rootDir, 'node_modules', 'pkg'), { recursive: true })
  fs.writeFileSync(path.join(rootDir, 'node_modules', 'pkg', 'x.js'), 'x\n')
  service = new WorkspaceService(new Logger(null))
  await service.setRoot(rootDir)
})

afterEach(async () => {
  await service.dispose()
  fs.rmSync(rootDir, { recursive: true, force: true })
})

describe('WorkspaceService', () => {
  it('list：根目录目录在前且忽略 node_modules', async () => {
    const entries = await service.list('')
    expect(entries.map((e) => e.name)).toEqual(['src', 'README.md'])
    expect(entries[0]).toMatchObject({ kind: 'dir', rel: 'src' })
    expect(entries[1]).toMatchObject({ kind: 'file', rel: 'README.md' })
  })

  it('list：子目录相对路径 POSIX 化', async () => {
    const entries = await service.list('src')
    expect(entries.map((e) => e.rel)).toEqual(['src/deep', 'src/a.ts'])
  })

  it('readFile：读出内容与可写位', async () => {
    const read = await service.readFile('src/a.ts')
    expect(read).toMatchObject({ content: 'const a = 1\n', binary: false, tooLarge: false })
  })

  it('writeFile：原子写入并可回读', async () => {
    await service.writeFile('src/a.ts', 'const a = 2\n')
    expect(fs.readFileSync(path.join(rootDir, 'src', 'a.ts'), 'utf8')).toBe('const a = 2\n')
    expect(fs.readdirSync(path.join(rootDir, 'src')).filter((f) => f.includes('aircode-tmp'))).toEqual([])
  })

  it('路径逃逸（..）拒绝', async () => {
    await expect(service.readFile('../outside.txt')).rejects.toThrow('escapes')
    await expect(service.list('../../')).rejects.toThrow('escapes')
    await expect(service.writeFile('../evil.txt', 'x')).rejects.toThrow('escapes')
  })

  it('符号链接逃逸拒绝', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-outside-'))
    fs.writeFileSync(path.join(outside, 'secret.txt'), 'secret\n')
    fs.symlinkSync(outside, path.join(rootDir, 'link-out'), 'dir')
    await expect(service.readFile('link-out/secret.txt')).rejects.toThrow('escapes')
    fs.rmSync(outside, { recursive: true, force: true })
  })

  it('二进制与大文件识别', async () => {
    fs.writeFileSync(path.join(rootDir, 'bin.dat'), Buffer.from([0, 1, 2, 0, 3]))
    const binary = await service.readFile('bin.dat')
    expect(binary.binary).toBe(true)
    fs.writeFileSync(path.join(rootDir, 'big.txt'), Buffer.alloc(2 * 1024 * 1024 + 1, 65))
    const big = await service.readFile('big.txt')
    expect(big.tooLarge).toBe(true)
  })

  it('walk：跳过忽略目录并返回排序文件集', async () => {
    const result = await service.walk()
    expect(result.truncated).toBe(false)
    expect(result.files).toContain('src/a.ts')
    expect(result.files).toContain('src/deep/b.md')
    expect(result.files.some((f) => f.startsWith('node_modules'))).toBe(false)
  })

  it('未设 root 时操作抛错', async () => {
    const empty = new WorkspaceService(new Logger(null))
    await expect(empty.list('')).rejects.toThrow('not set')
  })

  it('watcher：外部新增/修改/删除触发事件', async () => {
    const events: string[] = []
    const disposable = service.onDidChange((event) => events.push(`${event.type}:${event.rel}`))
    // 等待 chokidar 初始扫描完成（ignoreInitial 期间的变化不报）
    await new Promise((resolve) => setTimeout(resolve, 900))
    fs.writeFileSync(path.join(rootDir, 'src', 'new.ts'), 'new\n')
    fs.writeFileSync(path.join(rootDir, 'src', 'a.ts'), 'changed\n')
    fs.rmSync(path.join(rootDir, 'src', 'deep', 'b.md'))
    const deadline = Date.now() + 4000
    while (Date.now() < deadline && events.length < 3) {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    disposable()
    expect(events).toContain('add:src/new.ts')
    expect(events).toContain('change:src/a.ts')
    expect(events).toContain('unlink:src/deep/b.md')
    expect(events.some((e) => e.includes('node_modules'))).toBe(false)
  }, 8000)

  it('setRoot 切换后旧 watcher 不再报事件', async () => {
    const events: string[] = []
    const disposable = service.onDidChange((event) => events.push(event.rel))
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-ws2-'))
    await service.setRoot(other)
    fs.writeFileSync(path.join(rootDir, 'ghost.ts'), 'x\n')
    await new Promise((resolve) => setTimeout(resolve, 600))
    disposable()
    expect(events).toEqual([])
    fs.rmSync(other, { recursive: true, force: true })
  }, 8000)
})
