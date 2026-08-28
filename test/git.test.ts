import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { GitService, repoNameFromUrl } from '../src/main/services/git'
import { WorkspaceService } from '../src/main/services/workspace'
import { SettingsService } from '../src/main/services/settings'
import { Logger } from '../src/main/services/logger'
import { makePaths } from '../src/main/core/paths'

let rootDir: string
let settingsDir: string
let service: GitService
let settings: SettingsService
let workspace: WorkspaceService

const git = (args: string[]): void => {
  execFileSync('git', args, { cwd: rootDir, stdio: 'ignore' })
}

/** 在指定目录执行 git（远端/克隆等辅助仓库用）。 */
const gitIn = (cwd: string, args: string[]): string =>
  execFileSync('git', args, { cwd }).toString().trim()

const initRepo = (dir: string): void => {
  gitIn(dir, ['init', '-b', 'main'])
  gitIn(dir, ['config', 'user.email', 'test@aircode.local'])
  gitIn(dir, ['config', 'user.name', 'AirCode Test'])
}

beforeEach(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-'))
  settingsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-settings-'))
  initRepo(rootDir)
  fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\n')
  git(['add', '.'])
  git(['commit', '-m', 'init'])
  workspace = new WorkspaceService(new Logger(null))
  await workspace.setRoot(rootDir)
  settings = new SettingsService(makePaths(settingsDir))
  service = new GitService(workspace, settings, new Logger(null))
})

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true })
  fs.rmSync(settingsDir, { recursive: true, force: true })
})

describe('repoNameFromUrl', () => {
  it('常见 URL 形态', () => {
    expect(repoNameFromUrl('https://github.com/user/AirOne.git')).toBe('AirOne')
    expect(repoNameFromUrl('https://github.com/user/AirOne')).toBe('AirOne')
    expect(repoNameFromUrl('git@github.com:user/AirOne.git')).toBe('AirOne')
    expect(repoNameFromUrl('https://github.com/user/AirOne/')).toBe('AirOne')
    expect(repoNameFromUrl('/opt/local/repo.git')).toBe('repo')
    expect(repoNameFromUrl('  ')).toBe('repository')
  })
})

describe('GitService', () => {
  it('repoRoot 发现仓库', async () => {
    expect(await service.repoRoot()).toBe(fs.realpathSync(rootDir))
  })

  it('status：未跟踪文件 + 无远端', async () => {
    fs.writeFileSync(path.join(rootDir, 'new.txt'), 'n\n')
    const status = await service.status()
    expect(status?.branch).toBe('main')
    expect(status?.files).toEqual([{ path: 'new.txt', state: 'untracked', staged: false }])
    expect(status?.remote).toBeNull()
    expect(status?.lastFetch).toBeNull()
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

  it('commit → log 出现新提交（完整 hash）', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\ntwo\n')
    await service.stage(['a.txt'])
    const { hash } = await service.commit('second')
    expect(hash.length).toBeGreaterThan(0)
    const log = await service.log(5)
    expect(log[0]).toMatchObject({ message: 'second', author: 'AirCode Test' })
    expect(log[0].hash).toMatch(/^[0-9a-f]{40}$/)
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

  it('未跟踪文件合成全量新增 diff', async () => {
    fs.writeFileSync(path.join(rootDir, 'new.txt'), 'hello\nworld\n')
    const diff = await service.diff('new.txt', false)
    expect(diff).toContain('new file mode')
    expect(diff).toContain('+hello')
    expect(diff).toContain('+world')
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
    const ws = new WorkspaceService(new Logger(null))
    await ws.setRoot(plain)
    const noGit = new GitService(ws, settings, new Logger(null))
    expect(await noGit.repoRoot()).toBeNull()
    expect(await noGit.status()).toBeNull()
    expect(await noGit.branches()).toBeNull()
    fs.rmSync(plain, { recursive: true, force: true })
  })

  it('工作区是仓库子目录时 toRepoRel 换算', async () => {
    fs.mkdirSync(path.join(rootDir, 'sub'), { recursive: true })
    const ws = new WorkspaceService(new Logger(null))
    await ws.setRoot(path.join(rootDir, 'sub'))
    const sub = new GitService(ws, settings, new Logger(null))
    expect(await sub.repoRoot()).toBe(fs.realpathSync(rootDir))
    expect(await sub.toRepoRel('inner.txt')).toBe('sub/inner.txt')
  })
})

describe('GitService 多仓库列表', () => {
  const makeRepo = (): string => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-repo2-'))
    initRepo(dir)
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n')
    gitIn(dir, ['add', '.'])
    gitIn(dir, ['commit', '-m', 'repo2 init'])
    return dir
  }

  it('addRepo 加入列表并激活；status 作用于激活仓库', async () => {
    const view = await service.addRepo(rootDir)
    const real = fs.realpathSync(rootDir)
    expect(view.repos).toEqual([{ path: real, name: path.basename(real), branch: 'main', missing: false }])
    expect(view.active).toBe(real)
    expect(view.activeSource).toBe('list')
    expect(settings.get().activeGitRepo).toBe(real)
    expect((await service.status())?.repoRoot).toBe(real)
  })

  it('addRepo 子目录归一到仓库顶层且去重', async () => {
    fs.mkdirSync(path.join(rootDir, 'sub'), { recursive: true })
    await service.addRepo(path.join(rootDir, 'sub'))
    await service.addRepo(rootDir)
    expect(settings.get().gitRepos).toEqual([fs.realpathSync(rootDir)])
  })

  it('addRepo 非仓库抛错', async () => {
    const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-nogit-'))
    await expect(service.addRepo(plain)).rejects.toThrow('not a git repository')
    fs.rmSync(plain, { recursive: true, force: true })
  })

  it('activateRepo 切换生效仓库；null 回落工作区派生', async () => {
    const second = makeRepo()
    await service.addRepo(rootDir)
    await service.addRepo(second)
    expect((await service.status())?.repoRoot).toBe(fs.realpathSync(second))
    const view = await service.activateRepo(fs.realpathSync(rootDir))
    expect(view.active).toBe(fs.realpathSync(rootDir))
    const fallback = await service.activateRepo(null)
    expect(fallback.active).toBe(fs.realpathSync(rootDir))
    expect(fallback.activeSource).toBe('workspace')
    fs.rmSync(second, { recursive: true, force: true })
  })

  it('activateRepo 拒绝列表外路径', async () => {
    await expect(service.activateRepo('/nonexistent/repo')).rejects.toThrow('repo not in list')
  })

  it('removeRepo 激活项 → 回落工作区派生', async () => {
    const real = fs.realpathSync(rootDir)
    await service.addRepo(rootDir)
    const view = await service.removeRepo(real)
    expect(view.repos).toEqual([])
    expect(view.active).toBe(real) // 工作区回落仍能解析到该仓库
    expect(view.activeSource).toBe('workspace')
    expect(settings.get().activeGitRepo).toBe('')
  })

  it('目录删除后标记 missing', async () => {
    const second = makeRepo()
    await service.addRepo(second)
    fs.rmSync(second, { recursive: true, force: true })
    const view = await service.repos()
    expect(view.repos[0]?.missing).toBe(true)
    expect(view.active).toBeNull()
  })

  it('cloneRepo 克隆本地仓库并激活', async () => {
    const parent = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-clone-parent-'))
    const view = await service.cloneRepo(rootDir, parent)
    const target = path.join(fs.realpathSync(parent), path.basename(rootDir))
    expect(fs.existsSync(path.join(target, '.git'))).toBe(true)
    expect(view.active).toBe(target)
    expect(view.repos[0]?.name).toBe(path.basename(rootDir))
    fs.rmSync(parent, { recursive: true, force: true })
  })
})

describe('GitService 远端同步', () => {
  let bare: string

  beforeEach(() => {
    bare = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-bare-'))
    gitIn(bare, ['init', '--bare', '-b', 'main'])
    git(['remote', 'add', 'origin', bare])
  })

  afterEach(() => {
    fs.rmSync(bare, { recursive: true, force: true })
  })

  it('push 自动建立上游；status.remote 暴露 origin', async () => {
    const before = await service.status()
    expect(before?.remote).toBe(bare)
    await service.push()
    expect(gitIn(bare, ['rev-parse', 'main'])).toMatch(/^[0-9a-f]{40}$/)
    const after = await service.status()
    expect(after?.ahead).toBe(0)
  })

  it('fetch 更新 lastFetch；对端新提交 → behind=1 → pull 后归零', async () => {
    await service.push()
    expect((await service.status())?.lastFetch).toBeNull()
    await service.fetch()
    expect((await service.status())?.lastFetch).not.toBeNull()

    // 另一克隆推一个提交
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-git-other-'))
    gitIn(other, ['clone', bare, '.'])
    initRepo(other) // init 已存在仓库：补 user 配置（分支参数无效但无副作用）
    fs.writeFileSync(path.join(other, 'remote.txt'), 'r\n')
    gitIn(other, ['add', '.'])
    gitIn(other, ['commit', '-m', 'remote change'])
    gitIn(other, ['push', 'origin', 'main'])

    await service.fetch()
    const behind = await service.status()
    expect(behind?.behind).toBe(1)
    await service.pull()
    const synced = await service.status()
    expect(synced?.behind).toBe(0)
    expect(fs.readFileSync(path.join(rootDir, 'remote.txt'), 'utf8')).toBe('r\n')
    fs.rmSync(other, { recursive: true, force: true })
  })

  it('无远端时 fetch/pull/push 抛错', async () => {
    git(['remote', 'remove', 'origin'])
    await expect(service.fetch()).rejects.toThrow('no remote configured')
    await expect(service.pull()).rejects.toThrow('no remote configured')
    await expect(service.push()).rejects.toThrow('no remote configured')
  })
})

describe('GitService 放弃更改与历史详情', () => {
  it('discard：已修改文件还原', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'changed\n')
    await service.discard(['a.txt'])
    expect(fs.readFileSync(path.join(rootDir, 'a.txt'), 'utf8')).toBe('one\n')
    expect((await service.status())?.files).toEqual([])
  })

  it('discard：未跟踪文件删除', async () => {
    fs.writeFileSync(path.join(rootDir, 'new.txt'), 'n\n')
    await service.discard(['new.txt'])
    expect(fs.existsSync(path.join(rootDir, 'new.txt'))).toBe(false)
    expect((await service.status())?.files).toEqual([])
  })

  it('discard：已暂存新文件从索引与工作区移除', async () => {
    fs.writeFileSync(path.join(rootDir, 'staged.txt'), 's\n')
    await service.stage(['staged.txt'])
    await service.discard(['staged.txt'])
    expect(fs.existsSync(path.join(rootDir, 'staged.txt'))).toBe(false)
    expect((await service.status())?.files).toEqual([])
  })

  it('commitFiles / commitDiff', async () => {
    fs.writeFileSync(path.join(rootDir, 'a.txt'), 'one\ntwo\n')
    fs.writeFileSync(path.join(rootDir, 'c.txt'), 'c\n')
    await service.stage(['a.txt', 'c.txt'])
    await service.commit('second')
    const [head] = await service.log(1)
    const files = await service.commitFiles(head.hash)
    expect(files).toEqual([
      { path: 'a.txt', state: 'modified' },
      { path: 'c.txt', state: 'added' },
    ])
    const diff = await service.commitDiff(head.hash, 'a.txt')
    expect(diff).toContain('+two')
    expect(diff).not.toContain('c.txt')
    const whole = await service.commitDiff(head.hash)
    expect(whole).toContain('c.txt')
  })

  it('commitFiles / commitDiff 拒绝非法 hash', async () => {
    await expect(service.commitFiles('nope; rm -rf /')).rejects.toThrow('invalid commit hash')
    await expect(service.commitDiff('../../etc')).rejects.toThrow('invalid commit hash')
  })
})
