import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'
import type { SettingsService } from './settings'
import type { RuntimeManager } from './runtime'
import type { KernelManager } from './kernel'
import type { Logger } from './logger'
import { buildServerEnv } from '../core/args'
import type { PluginInfo } from '../../shared/types'

/** 插件管理：读取 profile package.json 列表，增删转发 `dsh plugin`（内部走 pnpm）。 */
export class PluginService {
  constructor(
    private readonly settings: SettingsService,
    private readonly runtime: RuntimeManager,
    private readonly kernel: KernelManager,
    private readonly logger: Logger,
  ) {}

  private profileDir(profile: string): string {
    return path.join(this.settings.effectiveDshHome(), 'profiles', profile)
  }

  list(profile: string): PluginInfo[] {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(this.profileDir(profile), 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>
      }
      return Object.entries(pkg.dependencies ?? {})
        .map(([name, version]) => ({ name, version }))
        .sort((a, b) => a.name.localeCompare(b.name))
    } catch {
      return []
    }
  }

  private run(profile: string, args: string[]): Promise<void> {
    const node = this.runtime.status()
    const kernel = this.kernel.status()
    if (!node.available || !node.path) return Promise.reject(new Error('runtime unavailable'))
    if (!kernel.installed || !kernel.binPath) return Promise.reject(new Error('kernel unavailable'))
    const nodePath: string = node.path
    const binPath: string = kernel.binPath
    const env = buildServerEnv(this.settings.effectiveDshHome(), process.env, this.runtime.envPathPrefixes())
    const fullArgs = [binPath, 'plugin', '--profile', profile, ...args]
    this.logger.info('plugin', `${nodePath} ${fullArgs.join(' ')}`)
    return new Promise((resolve, reject) => {
      const child = spawn(nodePath, fullArgs, { env, cwd: this.profileDir(profile) })
      let tail = ''
      child.stdout.on('data', (chunk: Buffer) => { const s = chunk.toString(); tail = (tail + s).slice(-600); this.logger.info('pnpm', s.trim()) })
      child.stderr.on('data', (chunk: Buffer) => { const s = chunk.toString(); tail = (tail + s).slice(-600); this.logger.warn('pnpm', s.trim()) })
      child.once('error', reject)
      child.once('close', (code) => (code === 0 ? resolve() : reject(new Error(`dsh plugin exited ${code}: ${tail.trim()}`))))
    })
  }

  async add(profile: string, spec: string): Promise<PluginInfo[]> {
    if (!/^[\w@./-][\w@./-]*$/u.test(spec.trim())) throw new Error(`invalid plugin spec: ${spec}`)
    await this.run(profile, ['add', spec.trim()])
    return this.list(profile)
  }

  async remove(profile: string, name: string): Promise<PluginInfo[]> {
    await this.run(profile, ['remove', name.trim()])
    return this.list(profile)
  }
}