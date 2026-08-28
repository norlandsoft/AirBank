import path from 'node:path'
import fsp from 'node:fs/promises'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { Logger } from './logger'
import type { SettingsService } from './settings'
import type { WorkspaceService } from './workspace'
import type {
  GitBranchesView, GitCommitFile, GitCommitInfo, GitFileState, GitFileStatus, GitRepoInfo,
  GitReposView, GitStatusView,
} from '../../shared/types'

const LETTER_STATE: Record<string, GitFileState> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'added',
  T: 'modified', U: 'conflicted', '?': 'untracked',
}

const HASH_RE = /^[0-9a-f]{4,40}$/i
/** commitDiff 输出上限（超大 diff 截断，防渲染卡顿）。 */
const DIFF_CAP = 512 * 1024

/** 仓库 URL → 目录名（去 .git 后缀取末段；scp 风格 git@host:user/repo 亦适用）。 */
export function repoNameFromUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '').replace(/\.git$/i, '')
  const base = path.posix.basename(trimmed.split(':').pop() ?? '')
  return base === '' || base === '.' || base === '/' ? 'repository' : base
}

/**
 * Git 仓库服务：simple-git 封装（spawn 系统 git）。支持多仓库列表（settings 持久化）：
 * activeGitRepo 非空时作用于该仓库，否则回落 IDE 工作区派生仓库（旧行为）。
 * 非仓库时读取类方法返回 null 而非抛错。不依赖 electron，可 node 直测。
 */
export class GitService {
  private repoRootCache: { key: string; repo: string | null } | null = null

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
  ) {}

  /** 生效仓库根：激活列表仓库优先，否则工作区派生（rev-parse 发现，按来源记忆化）。 */
  async repoRoot(): Promise<string | null> {
    const active = this.settings.get().activeGitRepo
    const key = active !== '' ? `repo:${active}` : `ws:${this.workspace.getRoot() ?? ''}`
    if (key === 'ws:') return null
    if (this.repoRootCache?.key === key) {
      const cached = this.repoRootCache.repo
      // 缓存命中仍做一次目录存在性校验（目录被删/卸载时及时失效；stat 无 spawn 开销）
      if (cached === null || (await fsp.stat(cached).catch(() => null))?.isDirectory()) return cached
    }
    if (active !== '') {
      const repo = (await this.isRepo(active)) ? active : null
      this.repoRootCache = { key, repo }
      return repo
    }
    const root = this.workspace.getRoot() as string
    const repo = await simpleGit(root).revparse(['--show-toplevel']).then((top) => top.trim(), () => null)
    this.repoRootCache = { key, repo }
    if (repo) this.logger.info('git', `repo root = ${repo}`)
    return repo
  }

  private async isRepo(dir: string): Promise<boolean> {
    const stat = await fsp.stat(dir).catch(() => null)
    if (!stat?.isDirectory()) return false
    return simpleGit(dir).revparse(['--is-inside-work-tree']).then((out) => out.trim() === 'true', () => false)
  }

  private invalidate(): void {
    this.repoRootCache = null
  }

  private async git(): Promise<SimpleGit | null> {
    const repo = await this.repoRoot()
    return repo ? simpleGit(repo) : null
  }

  /** 上次 fetch 时间（.git/FETCH_HEAD mtime；worktree 的 .git 文件指针亦解析）。 */
  private async lastFetch(repo: string): Promise<number | null> {
    let gitDir = path.join(repo, '.git')
    const stat = await fsp.stat(gitDir).catch(() => null)
    if (!stat) return null
    if (stat.isFile()) {
      const text = await fsp.readFile(gitDir, 'utf8').catch(() => '')
      const match = /^gitdir:\s*(.+)$/m.exec(text)
      if (!match) return null
      gitDir = path.resolve(repo, match[1].trim())
    }
    const head = await fsp.stat(path.join(gitDir, 'FETCH_HEAD')).catch(() => null)
    return head ? head.mtimeMs : null
  }

  async status(): Promise<GitStatusView | null> {
    const git = await this.git()
    if (!git) return null
    const repo = (await this.repoRoot()) as string
    const status = await git.status()
    const files: GitFileStatus[] = []
    for (const file of status.files) {
      // index=暂存区状态字母；working_dir=工作区状态字母（simple-git StatusResult）
      if (file.index !== ' ' && file.index !== '?') {
        files.push({ path: file.path, state: LETTER_STATE[file.index] ?? 'modified', staged: true })
      }
      if (file.working_dir !== ' ') {
        files.push({ path: file.path, state: LETTER_STATE[file.working_dir] ?? 'modified', staged: false })
      } else if (file.index === '?') {
        files.push({ path: file.path, state: 'untracked', staged: false })
      }
    }
    files.sort((a, b) => a.path.localeCompare(b.path))
    const remotes = await git.getRemotes(true).catch(() => [])
    const origin = remotes.find((item) => item.name === 'origin') ?? remotes[0] ?? null
    return {
      repoRoot: repo,
      branch: status.current ?? 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      files,
      remote: origin?.refs.fetch ?? null,
      lastFetch: await this.lastFetch(repo),
    }
  }

  /** 统一 diff 文本（staged=true 比较 index↔HEAD，否则 工作区↔index）。未跟踪文件合成全量新增 diff。 */
  async diff(relPath: string | null, staged: boolean): Promise<string> {
    const git = await this.git()
    if (!git) return ''
    const args = staged ? ['--cached'] : []
    if (relPath) args.push('--', relPath)
    const out = await git.diff(args)
    if (out !== '' || staged || relPath === null) return out
    // git diff 不含未跟踪文件：直接读文件内容拼 new-file diff（GitHub Desktop 同样全量展示）
    const repo = await this.repoRoot()
    if (!repo) return out
    const status = await git.status()
    if (!status.not_added.includes(relPath)) return out
    const content = await fsp.readFile(path.join(repo, relPath), 'utf8').catch(() => null)
    if (content === null || content.includes('\0') || content.length > DIFF_CAP) return out
    const lines = (content.endsWith('\n') ? content.slice(0, -1) : content).split('\n')
    return [
      `diff --git a/${relPath} b/${relPath}`,
      'new file mode 100644',
      '--- /dev/null',
      `+++ b/${relPath}`,
      `@@ -0,0 +1,${lines.length} @@`,
      ...lines.map((line) => `+${line}`),
    ].join('\n')
  }

  async stage(paths: string[]): Promise<void> {
    const git = await this.git()
    if (!git || paths.length === 0) return
    // add 对删除文件同样生效（git add 记录 deletion）
    await git.add(paths)
  }

  async unstage(paths: string[]): Promise<void> {
    const git = await this.git()
    if (!git || paths.length === 0) return
    await git.reset(['HEAD', '--', ...paths])
  }

  async commit(message: string): Promise<{ hash: string }> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    const result = await git.commit(message)
    return { hash: result.commit }
  }

  async log(limit = 10): Promise<GitCommitInfo[]> {
    const git = await this.git()
    if (!git) return []
    const result = await git.log({ maxCount: limit }).catch(() => null)
    if (!result) return []
    return result.all.map((entry) => ({
      hash: entry.hash,
      date: new Date(entry.date).getTime(),
      message: entry.message,
      author: entry.author_name,
    }))
  }

  async branches(): Promise<GitBranchesView | null> {
    const git = await this.git()
    if (!git) return null
    const result = await git.branchLocal()
    return { current: result.current, branches: [...result.all].sort() }
  }

  async checkout(name: string): Promise<void> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    await git.checkout(name)
  }

  async createBranch(name: string): Promise<void> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    if (!/^[\w./-]+$/.test(name)) throw new Error(`invalid branch name: ${name}`)
    await git.checkoutLocalBranch(name)
  }

  // ---- 多仓库列表（settings.gitRepos / activeGitRepo 持久化） ----

  async repos(): Promise<GitReposView> {
    const { gitRepos, activeGitRepo } = this.settings.get()
    const repos: GitRepoInfo[] = []
    for (const dir of gitRepos) {
      // 目录已删除时 simpleGit 构造直接抛错，先 stat 兜底
      const stat = await fsp.stat(dir).catch(() => null)
      const branch = stat?.isDirectory()
        ? await simpleGit(dir).revparse(['--abbrev-ref', 'HEAD']).then((out) => out.trim(), () => null)
        : null
      repos.push({ path: dir, name: path.basename(dir), branch: branch ?? '', missing: branch === null })
    }
    const active = await this.repoRoot()
    const activeSource = active === null ? null
      : activeGitRepo !== '' && active === activeGitRepo ? 'list' : 'workspace'
    return { repos, active, activeSource }
  }

  /** 添加本地目录为仓库（子目录归一到仓库顶层），加入列表并激活。 */
  async addRepo(dir: string): Promise<GitReposView> {
    const real = await fsp.realpath(dir).catch(() => {
      throw new Error(`not a directory: ${dir}`)
    })
    const top = await simpleGit(real).revparse(['--show-toplevel']).then((out) => out.trim(), () => null)
    if (!top) throw new Error(`not a git repository: ${dir}`)
    const repo = await fsp.realpath(top)
    const { gitRepos } = this.settings.get()
    this.settings.patch({ gitRepos: gitRepos.includes(repo) ? gitRepos : [...gitRepos, repo], activeGitRepo: repo })
    this.invalidate()
    this.logger.info('git', `repo added: ${repo}`)
    return this.repos()
  }

  /** 克隆远端仓库到 parentDir/<repoName>，加入列表并激活。 */
  async cloneRepo(url: string, parentDir: string): Promise<GitReposView> {
    if (url.trim() === '') throw new Error('empty repository url')
    const parent = await fsp.realpath(parentDir).catch(() => {
      throw new Error(`not a directory: ${parentDir}`)
    })
    const target = path.join(parent, repoNameFromUrl(url))
    if (await fsp.stat(target).catch(() => null) !== null) throw new Error(`target already exists: ${target}`)
    this.logger.info('git', `clone ${url} -> ${target}`)
    await simpleGit().clone(url.trim(), target)
    return this.addRepo(target)
  }

  /** 从列表移除；移除激活项时回落工作区派生。 */
  async removeRepo(dir: string): Promise<GitReposView> {
    const { gitRepos, activeGitRepo } = this.settings.get()
    this.settings.patch({
      gitRepos: gitRepos.filter((item) => item !== dir),
      activeGitRepo: activeGitRepo === dir ? '' : activeGitRepo,
    })
    this.invalidate()
    return this.repos()
  }

  /** 切换激活仓库（须在列表内）；null = 回落工作区派生。 */
  async activateRepo(dir: string | null): Promise<GitReposView> {
    if (dir !== null && !this.settings.get().gitRepos.includes(dir)) {
      throw new Error(`repo not in list: ${dir}`)
    }
    this.settings.patch({ activeGitRepo: dir ?? '' })
    this.invalidate()
    return this.repos()
  }

  // ---- 远端同步 ----

  private async requireRemote(git: SimpleGit): Promise<void> {
    const remotes = await git.getRemotes(true)
    if (remotes.length === 0) throw new Error('no remote configured')
  }

  async fetch(): Promise<void> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    await this.requireRemote(git)
    await git.fetch()
  }

  async pull(): Promise<void> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    await this.requireRemote(git)
    await git.pull()
  }

  /** 当前分支无上游时自动 --set-upstream origin <branch>（等同 GitHub Desktop 的 Publish）。 */
  async push(): Promise<void> {
    const git = await this.git()
    if (!git) throw new Error('not a git repository')
    await this.requireRemote(git)
    const status = await git.status()
    if (status.tracking === null && status.current !== null) {
      await git.push(['--set-upstream', 'origin', status.current])
    } else {
      await git.push()
    }
  }

  /** 放弃更改：暂存的新文件 rm -f；其余已跟踪 checkout HEAD 还原；未跟踪 clean -f 删除。 */
  async discard(paths: string[]): Promise<void> {
    const git = await this.git()
    if (!git || paths.length === 0) return
    const status = await git.status()
    const untracked = new Set(status.not_added)
    const created = new Set(status.created)
    const toRm: string[] = []
    const toClean: string[] = []
    const toCheckout: string[] = []
    for (const item of paths) {
      if (created.has(item)) toRm.push(item)
      else if (untracked.has(item)) toClean.push(item)
      else toCheckout.push(item)
    }
    if (toRm.length > 0) await git.raw(['rm', '-q', '-f', '--', ...toRm])
    if (toCheckout.length > 0) await git.raw(['checkout', 'HEAD', '--', ...toCheckout])
    if (toClean.length > 0) await git.raw(['clean', '-f', '--', ...toClean])
  }

  // ---- 提交历史详情 ----

  /** 某提交变更的文件列表（--no-renames 把 R 拆成 A+D，简化状态机）。 */
  async commitFiles(hash: string): Promise<GitCommitFile[]> {
    const git = await this.git()
    if (!git) return []
    if (!HASH_RE.test(hash)) throw new Error(`invalid commit hash: ${hash}`)
    const out = await git.raw(['show', '--name-status', '--format=', '--no-renames', hash])
    const files: GitCommitFile[] = []
    for (const line of out.split('\n')) {
      const match = /^([AMDRTC])\t(.+)$/.exec(line.trim())
      if (match) files.push({ state: LETTER_STATE[match[1]] ?? 'modified', path: match[2] })
    }
    return files
  }

  /** 某提交的 diff 文本（可选限定单文件；超出 DIFF_CAP 截断）。 */
  async commitDiff(hash: string, relPath?: string): Promise<string> {
    const git = await this.git()
    if (!git) return ''
    if (!HASH_RE.test(hash)) throw new Error(`invalid commit hash: ${hash}`)
    const args = ['show', '--format=', '--no-renames', '--patch', hash]
    if (relPath) args.push('--', relPath)
    const out = await git.raw(args)
    return out.length > DIFF_CAP ? `${out.slice(0, DIFF_CAP)}\n… (diff truncated)` : out
  }

  /** 工作区相对路径 → 仓库相对路径（diff/stage 用；工作区即仓库根时恒等）。 */
  async toRepoRel(rel: string): Promise<string> {
    const root = this.workspace.getRoot()
    const repo = await this.repoRoot()
    if (!root || !repo || path.resolve(root) === path.resolve(repo)) return rel
    return path.relative(repo, path.join(root, rel)).split(path.sep).join('/')
  }
}
