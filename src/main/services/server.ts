import http from 'node:http'
import { spawn, type ChildProcess } from 'node:child_process'
import type { SettingsService } from './settings'
import type { RuntimeManager } from './runtime'
import type { KernelManager } from './kernel'
import type { Logger } from './logger'
import { buildServerArgs, buildServerEnv } from '../core/args'
import { findAvailablePort, waitForPortRelease } from '../core/ports'
import { pollReadiness } from '../core/readiness'
import type { ServerStatus } from '../../shared/types'

const STOPPED: ServerStatus = { state: 'stopped', url: null, port: null, pid: null, profile: null, detail: null }

function probeHttp(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const request = http.get({ host: '127.0.0.1', port, path: '/', timeout: 4_000 }, (response) => {
      response.resume()
      const status = response.statusCode ?? 0
      resolve(status >= 200 && status < 400)
    })
    request.on('error', () => resolve(false))
    request.on('timeout', () => { request.destroy(); resolve(false) })
  })
}

/** dsh Web 服务生命周期：端口漂移、spawn、健康检查、信号停止、日志接管。 */
export class DshServerManager {
  private status: ServerStatus = STOPPED
  private child: ChildProcess | null = null
  private listeners = new Set<(status: ServerStatus) => void>()

  constructor(
    private readonly settings: SettingsService,
    private readonly runtime: RuntimeManager,
    private readonly kernel: KernelManager,
    private readonly logger: Logger,
  ) {}

  getStatus(): ServerStatus {
    return { ...this.status }
  }

  private setStatus(patch: Partial<ServerStatus>): ServerStatus {
    this.status = { ...this.status, ...patch }
    for (const listener of this.listeners) listener(this.getStatus())
    return this.getStatus()
  }

  onStatus(listener: (status: ServerStatus) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  async start(): Promise<ServerStatus> {
    if (this.status.state === 'running' || this.status.state === 'starting') return this.getStatus()
    const node = this.runtime.status()
    if (!node.available || !node.supported || !node.path) throw new Error('runtime unavailable')
    const kernel = this.kernel.status()
    if (!kernel.installed || !kernel.binPath) throw new Error('kernel unavailable')

    const settings = this.settings.get()
    const port = await findAvailablePort(settings.port)
    if (port !== settings.port) this.logger.warn('server', `port ${settings.port} busy, drifting to ${port}`)
    const profile = settings.activeProfile
    const dshHome = this.settings.effectiveDshHome()
    const args = buildServerArgs({ binPath: kernel.binPath, profile, host: '127.0.0.1', port, noOpen: true })
    const env = buildServerEnv(dshHome, process.env, this.runtime.envPathPrefixes())

    this.logger.info('server', `spawn ${node.path} ${args.join(' ')} (DSH_HOME=${dshHome})`)
    this.setStatus({ state: 'starting', url: null, port, pid: null, profile, detail: null })

    const child = spawn(node.path, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    this.child = child
    let exited = false
    child.stdout.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.logger.info('dsh', line)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.logger.warn('dsh', line)
    })
    child.once('error', (error) => {
      this.logger.error('server', `spawn error: ${String(error)}`)
      this.setStatus({ state: 'error', detail: String(error) })
    })
    child.once('exit', (code, signal) => {
      exited = true
      this.child = null
      this.logger.warn('server', `dsh exited: code=${String(code)} signal=${String(signal)}`)
      if (this.status.state !== 'stopping') {
        this.setStatus({ ...STOPPED, detail: code === 0 ? null : `exited ${String(code)}` })
      } else {
        this.setStatus(STOPPED)
      }
    })

    const readiness = await pollReadiness({
      probe: async () => ({ healthy: await probeHttp(port), notOwned: false }),
      intervalMs: 500,
      maxAttempts: 120,
      shouldContinue: () => !exited,
    })

    if (readiness.healthy && !exited && child.pid !== undefined) {
      const url = `http://127.0.0.1:${port}/`
      this.logger.info('server', `healthy at ${url}`)
      return this.setStatus({ state: 'running', url, pid: child.pid, detail: null })
    }
    const detail = exited ? 'dsh exited before becoming healthy' : 'health check timed out'
    this.logger.error('server', detail)
    await this.stopChild()
    return this.setStatus({ state: 'error', url: null, pid: null, detail })
  }

  private async stopChild(): Promise<void> {
    const child = this.child
    if (!child || child.killed) return
    const exited = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        if (process.platform === 'win32') {
          spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
        } else {
          try { child.kill('SIGKILL') } catch { /* 已退出 */ }
        }
        resolve()
      }, 5_000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
    })
    try { child.kill('SIGTERM') } catch { /* 已退出 */ }
    await exited
    this.child = null
  }

  async stop(): Promise<ServerStatus> {
    if (this.status.state === 'stopped') return this.getStatus()
    const port = this.status.port
    this.setStatus({ state: 'stopping', detail: null })
    await this.stopChild()
    if (port !== null) await waitForPortRelease(port, 8_000)
    return this.setStatus(STOPPED)
  }

  async restart(): Promise<ServerStatus> {
    await this.stop()
    return this.start()
  }

  /** 应用退出前调用：尽力停止子进程。 */
  async dispose(): Promise<void> {
    await this.stop()
  }
}
