import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { createRequire } from 'node:module'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'

export interface LspServerStatus {
  running: boolean
  root: string | null
  pid: number | null
}

/** LSP 帧解析（Content-Length 头；输入为累积 buffer，返回完整帧与剩余）。 */
export function parseFrames(buffer: string): { messages: string[]; rest: string } {
  const messages: string[] = []
  let rest = buffer
  for (;;) {
    const headerEnd = rest.indexOf('\r\n\r\n')
    if (headerEnd === -1) break
    const header = rest.slice(0, headerEnd)
    const match = /Content-Length: (\d+)/i.exec(header)
    if (!match) {
      // 畸形头：丢弃到下一个头边界尝试再同步
      rest = rest.slice(headerEnd + 4)
      continue
    }
    const length = Number(match[1])
    const start = headerEnd + 4
    if (Buffer.byteLength(rest.slice(start), 'utf8') < length) break
    messages.push(rest.slice(start, start + length))
    rest = rest.slice(start + length)
  }
  return { messages, rest }
}

/** 组帧（长度按字节计）。 */
export function frameMessage(message: string): string {
  return `Content-Length: ${Buffer.byteLength(message, 'utf8')}\r\n\r\n${message}`
}

const require = createRequire(import.meta.url)

/**
 * TypeScript 语言服务器托管：spawn typescript-language-server（应用内置依赖，
 * ELECTRON_RUN_AS_NODE 复用 Electron 内嵌 Node），stdio 字节流 ↔ JSON 消息桥。
 * 单实例（一个工作区一个服务器）；root 变更自动重启。不依赖 electron，可 node 直测。
 */
export class LspService {
  private child: ChildProcess | null = null
  private pending = ''
  private startedFor: string | null = null
  private readonly listeners = new Set<(message: string) => void>()

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  status(): LspServerStatus {
    return { running: this.child !== null, root: this.startedFor, pid: this.child?.pid ?? null }
  }

  onMessage(listener: (message: string) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private serverEntry(): string {
    const pkg = require.resolve('typescript-language-server/package.json')
    return path.join(path.dirname(pkg), 'lib', 'cli.mjs')
  }

  /** 确保服务器运行（root 未设→抛错；root 变更→重启）。 */
  async ensure(): Promise<LspServerStatus> {
    const root = this.workspace.getRoot()
    if (!root) throw new Error('workspace root is not set')
    if (this.child && this.startedFor === root) return this.status()
    await this.dispose()
    const entry = this.serverEntry()
    // ELECTRON_RUN_AS_NODE：Electron 主进程内复用内嵌 Node（node 直测时 execPath 即 node，同样成立）
    const child = spawn(process.execPath, [entry, '--stdio'], {
      cwd: root,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.child = child
    this.startedFor = root
    this.pending = ''
    this.logger.info('lsp', `spawn ${entry} (pid ${String(child.pid)}, root ${root})`)
    child.stdout.on('data', (chunk: Buffer) => {
      this.pending += chunk.toString('utf8')
      const { messages, rest } = parseFrames(this.pending)
      this.pending = rest
      for (const message of messages) {
        for (const listener of this.listeners) {
          try { listener(message) } catch (error) { this.logger.warn('lsp', `listener error: ${String(error)}`) }
        }
      }
    })
    child.stderr.on('data', (chunk: Buffer) => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) this.logger.warn('tsserver', line.trim())
    })
    child.once('error', (error) => {
      this.logger.error('lsp', `spawn error: ${String(error)}`)
    })
    child.once('exit', (code, signal) => {
      this.logger.warn('lsp', `exited: code=${String(code)} signal=${String(signal)}`)
      if (this.child === child) {
        this.child = null
        this.startedFor = null
      }
    })
    return this.status()
  }

  /** 发送一条 JSON-RPC 消息（渲染层 Transport 的 send）。 */
  send(message: string): void {
    const stdin = this.child?.stdin
    if (!stdin?.writable) throw new Error('language server is not running')
    stdin.write(frameMessage(message), 'utf8')
  }

  async dispose(): Promise<void> {
    const child = this.child
    this.child = null
    this.startedFor = null
    if (!child) return
    const exited = new Promise<void>((resolve) => {
      const timer = setTimeout(() => { try { child.kill('SIGKILL') } catch { /* 已退出 */ } resolve() }, 3_000)
      child.once('exit', () => { clearTimeout(timer); resolve() })
    })
    try { child.kill('SIGTERM') } catch { /* 已退出 */ }
    await exited
  }
}
