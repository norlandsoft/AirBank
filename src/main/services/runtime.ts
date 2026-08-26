import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import type { AppPaths } from '../core/paths'
import { NODE_VERSION, PNPM_VERSION, nodeDist, nodePlatform, pnpmDist } from '../core/urls'
import { nodeVersionSupported, parseVersion } from '../core/semver'
import { downloadFile, extractArchive } from './download'
import type { Logger } from './logger'
import type { SettingsService } from './settings'
import type { InstallStep, RuntimeSource, RuntimeStatus } from '../../shared/types'

const MIN_NODE: [number, number] = [22, 19]

function queryNodeVersion(nodePath: string): string | null {
  try {
    const result = spawnSync(nodePath, ['--version'], { encoding: 'utf8', timeout: 10_000 })
    if (result.status !== 0) return null
    const match = /v?(\d+\.\d+\.\d+)/.exec(result.stdout.trim())
    return match ? match[1] : null
  } catch {
    return null
  }
}

function whichNode(): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which'
  try {
    const result = spawnSync(command, ['node'], { encoding: 'utf8', timeout: 5_000 })
    if (result.status !== 0) return null
    const first = result.stdout.split(/\r?\n/)[0]?.trim()
    return first ? first : null
  } catch {
    return null
  }
}

/** Node 运行时管理：自定义 → 随包内置 → 已下载 → 系统 PATH，逐级解析。 */
export class RuntimeManager {
  constructor(
    private readonly paths: AppPaths,
    private readonly settings: SettingsService,
    private readonly logger: Logger,
    private readonly bundledRuntimeDir: string | null = null,
  ) {}

  private nodeBin(dir: string): string {
    return process.platform === 'win32' ? path.join(dir, 'node.exe') : path.join(dir, 'bin', 'node')
  }

  downloadedNodeDir(version = NODE_VERSION): string {
    return path.join(this.paths.runtimeDir, `node-v${version}`)
  }

  status(): RuntimeStatus {
    const candidates: Array<{ source: RuntimeSource; path: string | null }> = [
      { source: 'custom', path: this.settings.get().nodePath },
      { source: 'bundled', path: this.bundledRuntimeDir ? this.nodeBin(this.bundledRuntimeDir) : null },
      { source: 'downloaded', path: this.nodeBin(this.downloadedNodeDir()) },
      { source: 'system', path: whichNode() },
    ]
    for (const candidate of candidates) {
      if (!candidate.path || !fs.existsSync(candidate.path)) continue
      const version = queryNodeVersion(candidate.path)
      if (!version) continue
      return { available: true, source: candidate.source, path: candidate.path, version, supported: nodeVersionSupported(version) }
    }
    return { available: false, source: null, path: null, version: null, supported: false }
  }

  /** 下载并安装 Node 运行时与 pnpm（内核插件管理依赖 pnpm）。 */
  async install(step: (patch: Partial<InstallStep> & { id: string }) => void): Promise<RuntimeStatus> {
    const mirror = this.settings.get().useMirror
    const platform = nodePlatform()
    const { url, file } = nodeDist(NODE_VERSION, platform, process.arch, mirror)
    const archive = path.join(this.paths.runtimeDir, file)
    this.logger.info('runtime', `download ${url}`)
    step({ id: 'runtime', status: 'active', progress: 0, detail: url })
    await downloadFile(url, archive, (progress) => {
      step({ id: 'runtime', status: 'active', progress: progress.percent ?? 0, detail: `${Math.round(progress.received / 1048576)} MB` })
    })
    step({ id: 'runtime', status: 'active', progress: 100, detail: 'extract' })
    const extractTo = path.join(this.paths.runtimeDir, 'extract')
    fs.rmSync(extractTo, { recursive: true, force: true })
    await extractArchive(archive, extractTo)
    const innerName = file.replace(/\.(tar\.gz|zip)$/, '')
    const target = this.downloadedNodeDir()
    fs.rmSync(target, { recursive: true, force: true })
    fs.renameSync(path.join(extractTo, innerName), target)
    fs.rmSync(extractTo, { recursive: true, force: true })
    fs.rmSync(archive, { force: true })
    if (process.platform !== 'win32') fs.chmodSync(this.nodeBin(target), 0o755)

    step({ id: 'pnpm', status: 'active', progress: 0, detail: '' })
    await this.installPnpm(mirror, (percent) => step({ id: 'pnpm', status: 'active', progress: percent, detail: '' }))
    step({ id: 'pnpm', status: 'done', progress: 100, detail: '' })

    const status = this.status()
    if (!status.available || status.source !== 'downloaded') throw new Error('runtime install finished but node is not usable')
    step({ id: 'runtime', status: 'done', progress: 100, detail: status.version ?? '' })
    return status
  }

  /** pnpm 独立包：解出 package/bin/pnpm.cjs，供 `dsh plugin` 转发调用。 */
  pnpmBin(): string | null {
    const candidate = path.join(this.paths.runtimeDir, 'pnpm', 'bin', 'pnpm.cjs')
    return fs.existsSync(candidate) ? candidate : null
  }

  private async installPnpm(mirror: boolean, onProgress: (percent: number) => void): Promise<void> {
    if (this.pnpmBin()) { onProgress(100); return }
    const { url, file } = pnpmDist(PNPM_VERSION, mirror)
    const archive = path.join(this.paths.runtimeDir, file)
    this.logger.info('runtime', `download ${url}`)
    await downloadFile(url, archive, (progress) => onProgress(progress.percent ?? 0))
    const target = path.join(this.paths.runtimeDir, 'pnpm')
    fs.rmSync(target, { recursive: true, force: true })
    await extractArchive(archive, target) // tgz 解出 package/
    fs.renameSync(path.join(target, 'package'), path.join(this.paths.runtimeDir, 'pnpm.tmp'))
    fs.rmSync(target, { recursive: true, force: true })
    fs.renameSync(path.join(this.paths.runtimeDir, 'pnpm.tmp'), target)
    fs.rmSync(archive, { force: true })
  }

  /** 供 spawn 追加的 PATH 前缀：已下载 Node 的 bin 与 pnpm 的 bin。 */
  envPathPrefixes(): string[] {
    const prefixes: string[] = []
    const status = this.status()
    if (status.source === 'downloaded' && status.path) prefixes.push(path.dirname(status.path))
    const pnpm = this.pnpmBin()
    if (pnpm) prefixes.push(path.dirname(pnpm))
    return prefixes
  }

  static minNodeText(): string {
    return `${MIN_NODE[0]}.${MIN_NODE[1]}`
  }

  static versionOf(version: string): [number, number, number] {
    return parseVersion(version)
  }
}
