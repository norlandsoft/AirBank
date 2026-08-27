import fs from 'node:fs'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import type { AppPaths } from '../core/paths'
import { PKG_LATEST_API, kernelPkg, nodePlatform, npmRegistry, KERNEL_NPM_SPEC } from '../core/urls'
import { parseVersionText } from '../core/args'
import { downloadFile, extractArchive } from './download'
import type { Logger } from './logger'
import { RuntimeManager } from './runtime'
import type { SettingsService } from './settings'
import type { CoreInfo, InstallStep, KernelStatus } from '../../shared/types'

interface CoresFile { active: string | null }

/** 在目录内定位 dsh CLI 入口 bin.js（兼容预打包与 npm 安装两种布局）。 */
export function locateBin(root: string): string | null {
  const candidates = [
    path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    path.join(root, 'dsh', 'lib', 'bin.js'),
    path.join(root, 'lib', 'bin.js'),
    path.join(root, 'dependencies', 'dsh', 'lib', 'bin.js'),
  ]
  for (const candidate of candidates) if (fs.existsSync(candidate)) return candidate
  // 浅扫一层（预打包 zip 可能多套一层目录）
  try {
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const nested = path.join(root, entry.name, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
      if (fs.existsSync(nested)) return nested
      const nestedDsh = path.join(root, entry.name, 'lib', 'bin.js')
      if (fs.existsSync(nestedDsh) && /dsh/i.test(entry.name)) return nestedDsh
    }
  } catch { /* 目录不可读时按未安装处理 */ }
  return null
}

/** 从内核目录读版本：@deepseek-ai/dsh 的 package.json 优先，回退 bin --version。 */
export function kernelVersion(root: string, binPath: string | null, nodePath: string | null): string | null {
  const pkgCandidates = [
    path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'package.json'),
    path.join(root, 'dsh', 'package.json'),
    path.join(root, 'package.json'),
  ]
  for (const candidate of pkgCandidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8')) as { name?: string; version?: string }
      if (typeof pkg.version === 'string' && (pkg.name === '@deepseek-ai/dsh' || pkg.name === undefined)) return pkg.version
    } catch { /* 尝试下一个 */ }
  }
  if (binPath && nodePath) {
    try {
      const result = spawnSync(nodePath, [binPath, '--version'], { encoding: 'utf8', timeout: 15_000 })
      return parseVersionText(result.stdout ?? '')
    } catch { /* 忽略 */ }
  }
  return null
}

function whichDsh(): string | null {
  const command = process.platform === 'win32' ? 'where' : 'which'
  try {
    const result = spawnSync(command, ['dsh'], { encoding: 'utf8', timeout: 5_000 })
    if (result.status !== 0) return null
    return result.stdout.split(/\r?\n/)[0]?.trim() || null
  } catch {
    return null
  }
}

/** 内核管理：多版本核心（cores/<id>）+ 自定义/环境变量/系统 dsh 探测。 */
export class KernelManager {
  constructor(
    private readonly paths: AppPaths,
    private readonly settings: SettingsService,
    private readonly runtime: RuntimeManager,
    private readonly logger: Logger,
  ) {}

  private readCoresFile(): CoresFile {
    try {
      return JSON.parse(fs.readFileSync(this.paths.coresFile, 'utf8')) as CoresFile
    } catch {
      return { active: null }
    }
  }

  private writeCoresFile(data: CoresFile): void {
    fs.mkdirSync(this.paths.userData, { recursive: true })
    fs.writeFileSync(this.paths.coresFile, JSON.stringify(data, null, 2))
  }

  cores(): CoreInfo[] {
    const { active } = this.readCoresFile()
    let entries: fs.Dirent[] = []
    try {
      entries = fs.readdirSync(this.paths.coresDir, { withFileTypes: true })
    } catch {
      return []
    }
    const node = this.runtime.status().path
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => {
        const dir = path.join(this.paths.coresDir, entry.name)
        const bin = locateBin(dir)
        return {
          id: entry.name,
          version: kernelVersion(dir, bin, node) ?? 'unknown',
          dir,
          active: active === entry.name,
        }
      })
      .filter((core) => locateBin(core.dir) !== null)
  }

  activeCoreDir(): string | null {
    const { active } = this.readCoresFile()
    if (!active) return null
    const dir = path.join(this.paths.coresDir, active)
    return locateBin(dir) ? dir : null
  }

  status(): KernelStatus {
    const node = this.runtime.status().path
    const custom = this.settings.get().kernelDir
    if (custom) {
      const bin = locateBin(custom)
      if (bin) return { installed: true, source: 'custom', dir: custom, binPath: bin, version: kernelVersion(custom, bin, node) }
    }
    const envDir = process.env.DSH_DESKTOP_KERNEL_DIR
    if (envDir) {
      const bin = locateBin(envDir)
      if (bin) return { installed: true, source: 'env', dir: envDir, binPath: bin, version: kernelVersion(envDir, bin, node) }
    }
    const coreDir = this.activeCoreDir()
    if (coreDir) {
      const bin = locateBin(coreDir)
      if (bin) return { installed: true, source: 'core', dir: coreDir, binPath: bin, version: kernelVersion(coreDir, bin, node) }
    }
    const system = whichDsh()
    if (system) {
      return { installed: true, source: 'system', dir: path.dirname(system), binPath: system, version: null }
    }
    return { installed: false, source: null, dir: null, binPath: null, version: null }
  }

  /** 安装最新内核：优先预打包 zip（解压即用），失败回退 npm 安装。 */
  async install(step: (patch: Partial<InstallStep> & { id: string }) => void): Promise<KernelStatus> {
    const mirror = this.settings.get().useMirror
    const platform = nodePlatform()
    step({ id: 'kernel', status: 'active', progress: 0, detail: '' })
    const runtimeStatus = this.runtime.status()
    if (!runtimeStatus.available || !runtimeStatus.supported || !runtimeStatus.path) {
      throw new Error(`no supported node runtime (need ^${RuntimeManager.minNodeText()} or >=24)`)
    }
    const stamp = Date.now().toString(36)
    const id = `core-${stamp}`
    const dir = path.join(this.paths.coresDir, id)
    fs.rmSync(dir, { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })

    let installed = false
    try {
      const { url } = kernelPkg(platform, process.arch, mirror)
      this.logger.info('kernel', `download ${url}`)
      const archive = path.join(this.paths.coresDir, `kernel-${stamp}.zip`)
      await downloadFile(url, archive, (progress) => {
        step({ id: 'kernel', status: 'active', progress: progress.percent ?? 0, detail: `${Math.round(progress.received / 1048576)} MB` })
      })
      await extractArchive(archive, dir)
      fs.rmSync(archive, { force: true })
      installed = locateBin(dir) !== null
      if (!installed) this.logger.warn('kernel', 'pkg archive has no dsh bin; falling back to npm install')
    } catch (error) {
      this.logger.warn('kernel', `pkg download failed: ${String(error)}; falling back to npm install`)
    }

    if (!installed) {
      step({ id: 'kernel', status: 'active', progress: 10, detail: 'npm' })
      await this.installViaNpm(dir, runtimeStatus.path, mirror, (percent) => {
        step({ id: 'kernel', status: 'active', progress: percent, detail: 'npm' })
      })
    }

    const bin = locateBin(dir)
    if (!bin) throw new Error('kernel install finished but dsh bin not found')
    const version = kernelVersion(dir, bin, runtimeStatus.path)
    this.writeCoresFile({ active: id })
    step({ id: 'kernel', status: 'done', progress: 100, detail: version ?? '' })
    return { installed: true, source: 'core', dir, binPath: bin, version }
  }

  /** npm 回退路径：在核心目录内 `npm install @deepseek-ai/dsh`。 */
  private async installViaNpm(dir: string, nodePath: string, mirror: boolean, onProgress: (percent: number) => void): Promise<void> {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({
      name: 'aircode-core', private: true, dependencies: { [KERNEL_NPM_SPEC]: 'latest' },
    }, null, 2))
    const npmCli = process.platform === 'win32'
      ? path.join(path.dirname(nodePath), 'node_modules', 'npm', 'bin', 'npm-cli.js')
      : path.join(path.dirname(nodePath), '..', 'lib', 'node_modules', 'npm', 'bin', 'npm-cli.js')
    const npmExec = fs.existsSync(npmCli) ? npmCli : null
    const args = npmExec
      ? [npmExec, 'install', '--omit=dev', '--no-audit', '--no-fund', `--registry=${npmRegistry(mirror)}`]
      : ['install', '--omit=dev', '--no-audit', '--no-fund', `--registry=${npmRegistry(mirror)}`]
    const command = npmExec ? nodePath : (process.platform === 'win32' ? 'npm.cmd' : 'npm')
    this.logger.info('kernel', `npm install ${KERNEL_NPM_SPEC} in ${dir}`)
    await new Promise<void>((resolve, reject) => {
      const child = spawn(command, args, { cwd: dir, env: process.env })
      let progressed = 10
      const tick = (): void => { progressed = Math.min(95, progressed + 3); onProgress(progressed) }
      child.stdout.on('data', (chunk: Buffer) => { this.logger.info('npm', chunk.toString().trim()); tick() })
      child.stderr.on('data', (chunk: Buffer) => { this.logger.warn('npm', chunk.toString().trim()); tick() })
      child.once('error', reject)
      child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(`npm install exited ${String(code)}`))))
    })
  }

  activateCore(id: string): void {
    const dir = path.join(this.paths.coresDir, id)
    if (!locateBin(dir)) throw new Error(`core not installed: ${id}`)
    this.writeCoresFile({ active: id })
  }

  removeCore(id: string): void {
    const { active } = this.readCoresFile()
    if (active === id) throw new Error('cannot remove the active core')
    fs.rmSync(path.join(this.paths.coresDir, id), { recursive: true, force: true })
  }

  /** 查询上游最新内核版本（最佳努力，失败返回 null）。 */
  async latestVersion(): Promise<string | null> {
    try {
      const response = await fetch(PKG_LATEST_API, { headers: { 'User-Agent': 'aircode/0.1' }, signal: AbortSignal.timeout(10_000) })
      if (!response.ok) return null
      const data = (await response.json()) as { tag_name?: string }
      return parseVersionText(data.tag_name ?? '')
    } catch {
      return null
    }
  }
}