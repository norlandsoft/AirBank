import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitService } from '../src/main/services/git'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'

let rootDir: string
let service: GitService

const git = (args: string[]): void => {
  execFileSync('git', args, { cwd: rootDir, stdio: 'ignore' })
}

beforeEach(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-'))
  git(['init', '-b', 'main'])
  git(['config', 'user.email', 'test@aircode.local'])
  git(['config', 'user.name', 'AirCode Test'])
  fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\n')
  git(['add', '.'])
  git(['commit', '-m', 'init'])
  const workspace = new WorkspaceService(new Logger(null))
  await workspace.setRoot(rootDir)
  service = new GitService(workspace, new Logger(null))
})

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true })
})

describe('GitService', () => {
  it('repoRoot 发现仓库', async () => {
    expect(await service.repoRoot()).toBe(fs.realpathSync(rootDir))
  })

  it('status：未跟踪文件', async () => {
    fs.writeFileSync(path.join(rootDir, 'new.txt'), 'n\n')
    const status = await service.status()
    expect(status?.branch).toBe('main')
    expect(status?.files).toEqual([{ path: 'new.txt', state: 'untracked', staged: false }])
  })

  it('stage → 已暂存 added；unstage → 回到未暂存', async () => {
    fs.writeFileSync(path.join(rootDir, 'new.txt'), 'n\n')
    await service.stage(['new.txt'])
    let status = await service.status()
    expect(status?.files).toEqual([{ path: 'new.txt', state: 'added', staged: true }])
    await service.unstage(['new.txt'])
    status = await service.status()
    expect(status?.files).toEqual([{ path: 'new.txt', state: 'untracked', staged: false }])
  })

  it('修改已跟踪文件：工作区 modified + diff 含增行', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\ntwo\n')
    const status = await service.status()
    expect(status?.files).toEqual([{ path: 'a.txt', state: 'modified', staged: false }])
    const diff = await service.diff('a.txt', false)
    expect(diff).toContain('+two')
  })

  it('commit → log 出现新提交', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\ntwo\n')
    await service.stage(['a.txt'])
    const { hash } = await service.commit('second')
    expect(hash.length).toBeGreaterThan(0)
    const log = await service.log(5)
    expect(log[0]).toMatchObject({ message: 'second', author: 'AirCode Test' })
    expect(log).toHaveLength(2)
  })

  it('staged diff 与 unstaged diff 分离', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\ntwo\n')
    await service.stage(['a.txt'])
    const stagedDiff = await service.diff('a.txt', true)
    const unstagedDiff = await service.diff('a.txt', false)
    expect(stagedDiff).toContain('+two')
    expect(unstagedDiff).toBe('')
  })

  it('branches / checkout / createBranch', async () => {
    const branches = await service.branches()
    expect(branches).toEqual({ current: 'main', branches: ['main'] })
    await service.createBranch('feature/x')
    expect((await service.branches())?.current).toBe('feature/x')
    await service.checkout('main')
    expect((await service.branches())?.current).toBe('main')
  })

  it('非法分支名拒绝', async () => {
    await expect(service.createBranch('bad name;rm -rf')).rejects.toThrow('invalid branch name')
  })

  it('非仓库返回 null', async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-nogit-'))
    const workspace = new WorkspaceService(new Logger(null))
    await workspace.setRoot(plain)
    const noGit = new GitService(workspace, new Logger(null))
    expect(await noGit.repoRoot()).toBeNull()
    expect(await noGit.status()).toBeNull()
    expect(await noGit.branches()).toBeNull()
    fs.rmSync(plain, { recursive: true, force: true })
  })

  it('工作区是仓库子目录时 toRepoRel 换算', async () => {
    fs.mkdirSync(path.join(rootDir, 'sub'), { recursive: true })
    const workspace = new WorkspaceService(new Logger(null))
    await workspace.setRoot(path.join(rootDir, 'sub'))
    const sub = new GitService(workspace, new Logger(null))
    expect(await sub.repoRoot()).toBe(fs.realpathSync(rootDir))
    expect(await sub.toRepoRel('inner.txt')).toBe('sub/inner.txt')
  })
})
