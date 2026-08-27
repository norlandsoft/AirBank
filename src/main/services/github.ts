import { execFile } from 'node:child_process'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'
import { parseGithubRepo } from './ci'
import type { GhRun } from '../../shared/types'

interface GhApiRun {
  id: number
  name: string | null
  status: string | null
  conclusion: string | null
  head_branch: string | null
  html_url: string
  updated_at: string
}

/**
 * GitHub Actions 只读集成：origin remote → owner/repo，REST 拉最近 workflow runs。
 * v1 免认证（公开仓库 60 req/h）；私有仓库/高频率后续加 token（凭据走 safeStorage）。
 */
export class GithubService {
  private repoCache: { root: string; repo: string | null } | null = null

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  /** origin remote 的 owner/repo（非 GitHub 或非仓库 → null；按工作区记忆化）。 */
  async detectRepo(): Promise<string | null> {
    const root = this.workspace.getRoot()
    if (!root) return null
    if (this.repoCache?.root === root) return this.repoCache.repo
    const remoteUrl = await new Promise<string | null>((resolve) => {
      execFile('git', ['remote', 'get-url', 'origin'], { cwd: root }, (error, stdout) => {
        resolve(error ? null : stdout.trim())
      })
    })
    const repo = remoteUrl ? parseGithubRepo(remoteUrl) : null
    this.repoCache = { root, repo }
    if (repo) this.logger.info('github', `repo = ${repo}`)
    return repo
  }

  /** 最近 workflow runs（per_page=10；403/网络错误抛给 UI 展示）。 */
  async listRuns(): Promise<GhRun[]> {
    const repo = await this.detectRepo()
    if (!repo) return []
    const token = process.env.GITHUB_TOKEN
    const response = await fetch(`https://api.github.com/repos/${repo}/actions/runs?per_page=10`, {
      headers: {
        accept: 'application/vnd.github+json',
        'user-agent': 'aircode-desktop',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}（未认证限流 60 次/时，可设 GITHUB_TOKEN）`)
    const data = await response.json() as { workflow_runs?: GhApiRun[] }
    return (data.workflow_runs ?? []).map((run) => ({
      id: run.id,
      name: run.name ?? 'workflow',
      status: run.status ?? 'unknown',
      conclusion: run.conclusion,
      branch: run.head_branch ?? '',
      url: run.html_url,
      updatedAt: new Date(run.updated_at).getTime(),
    }))
  }
}
