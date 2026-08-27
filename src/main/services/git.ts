import path from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'
import type { GitBranchesView, GitCommitInfo, GitFileState, GitFileStatus, GitStatusView } from '../../shared/types'

const LETTER_STATE: Record<string, GitFileState> = {
  M: 'modified', A: 'added', D: 'deleted', R: 'renamed', C: 'added', U: 'conflicted', '?': 'untracked',
}

/**
 * Git 仓库服务：simple-git 封装（spawn 系统 git）。仓库根经 rev-parse 发现
 * （工作区 root 可以是仓库子目录）；非仓库时各方法返回 null 而非抛错。
 * 不依赖 electron，可 node 直测。
 */
export class GitService {
  private repoRootCache: { root: string; repo: string | null } | null = null

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  /** 仓库根（无工作区或非仓库 → null；按工作区 root 记忆化）。 */
  async repoRoot(): Promise<string | null> {
    const root = this.workspace.getRoot()
    if (!root) return null
    if (this.repoRootCache?.root === root) return this.repoRootCache.repo
    const git = simpleGit(root)
    const repo = await git.revparse(['--show-toplevel']).then((top) => top.trim(), () => null)
    this.repoRootCache = { root, repo }
    if (repo) this.logger.info('git', `repo root = ${repo}`)
    return repo
  }

  private async git(): Promise<SimpleGit | null> {
    const repo = await this.repoRoot()
    return repo ? simpleGit(repo) : null
  }

  async status(): Promise<GitStatusView | null> {
    const git = await this.git()
    if (!git) return null
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
    return {
      repoRoot: (await this.repoRoot()) as string,
      branch: status.current ?? 'HEAD',
      ahead: status.ahead,
      behind: status.behind,
      files,
    }
  }

  /** 统一 diff 文本（staged=true 比较 index↔HEAD，否则 工作区↔index）。 */
  async diff(relPath: string | null, staged: boolean): Promise<string> {
    const git = await this.git()
    if (!git) return ''
    const args = staged ? ['--cached'] : []
    if (relPath) args.push('--', relPath)
    return git.diff(args)
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
      hash: entry.hash.slice(0, 8),
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

  /** 工作区相对路径 → 仓库相对路径（diff/stage 用；工作区即仓库根时恒等）。 */
  async toRepoRel(rel: string): Promise<string> {
    const root = this.workspace.getRoot()
    const repo = await this.repoRoot()
    if (!root || !repo || path.resolve(root) === path.resolve(repo)) return rel
    return path.relative(repo, path.join(root, rel)).split(path.sep).join('/')
  }
}
