import os from 'node:os'
import { execFileSync, spawn, type ChildProcess } from 'node:child_process'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'

export type TermEvent =
  | { type: 'term-data'; termId: string; data: string }
  | { type: 'term-exit'; termId: string; code: number | null }

interface TermHandle {
  termId: string
  child: ChildProcess
}

/** python3 可用性探测（一次性同步缓存）。python 的 pty.spawn 容忍非 TTY 父管道。 */
let python3Cache: boolean | null = null
function hasPython3(): boolean {
  if (python3Cache !== null) return python3Cache
  try {
    execFileSync('python3', ['--version'], { stdio: 'ignore' })
    python3Cache = true
  } catch {
    python3Cache = false
  }
  return python3Cache
}

/**
 * 本地终端服务（设计文档偏差：弃 node-pty，分级伪终端策略——
 * ① python3 `pty.spawn`（macOS/Linux，容忍非 TTY 父管道，零原生依赖）；
 * ② `script(1)`（util-linux 容忍管道；BSD script 在父进程无 TTY 时失败，仅兜底）；
 * ③ 纯管道 shell（Windows/极简环境，交互式 TUI 受限）。
 * 窗口尺寸经注入 `stty cols N rows M` 同步（pty 内可调）。
 */
export class TerminalService {
  private readonly terms = new Map<string, TermHandle>()
  private readonly listeners = new Set<(event: TermEvent) => void>()
  private nextTerm = 1

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  onEvent(listener: (event: TermEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: TermEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch (error) { this.logger.warn('term', `listener error: ${String(error)}`) }
    }
  }

  /** 打开一个本地终端（cwd 默认工作区 root，其次用户 home）。返回 termId。 */
  open(cols: number, rows: number, cwd?: string): string {
    const termId = `term-${this.nextTerm++}`
    const shell = process.env.SHELL || (process.platform === 'win32' ? 'cmd.exe' : '/bin/bash')
    const dir = cwd ?? this.workspace.getRoot() ?? os.homedir()
    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      COLUMNS: String(cols),
      LINES: String(rows),
    }
    let child: ChildProcess
    if (process.platform !== 'win32' && hasPython3()) {
      // ① python3 pty.spawn：父管道非 TTY 也能工作（pty.spawn 内部容错）
      child = spawn('python3', ['-c', 'import pty,sys; pty.spawn(sys.argv[1:])', shell, '-l'], { cwd: dir, env })
    } else if (process.platform === 'darwin') {
      // ② BSD script 兜底（要求父进程有 TTY，GUI 应用下可能失败——此时退化③更稳）
      child = spawn('script', ['-q', '/dev/null', shell, '-l'], { cwd: dir, env })
    } else if (process.platform === 'linux') {
      // ② util-linux script
      child = spawn('script', ['-qec', `${shell} -l`, '/dev/null'], { cwd: dir, env })
    } else {
      // ③ Windows/极简环境退化：无 PTY（v1 已知限制）
      child = spawn(shell, [], { cwd: dir, env, shell: false })
    }
    this.terms.set(termId, { termId, child })
    this.logger.info('term', `open ${termId} (${shell}, cwd ${dir})`)
    child.stdout?.on('data', (chunk: Buffer) => {
      this.emit({ type: 'term-data', termId, data: chunk.toString('utf8') })
    })
    child.stderr?.on('data', (chunk: Buffer) => {
      this.emit({ type: 'term-data', termId, data: chunk.toString('utf8') })
    })
    child.once('exit', (code) => {
      this.terms.delete(termId)
      this.emit({ type: 'term-exit', termId, code })
    })
    child.once('error', (error) => {
      this.emit({ type: 'term-data', termId, data: `\r\n[aircode] 终端启动失败：${error.message}\r\n` })
    })
    // 同步 pty 尺寸（script 分配的 pty 继承管道尺寸，需显式设定）
    if (process.platform !== 'win32') this.resize(termId, cols, rows)
    return termId
  }

  data(termId: string, data: string): void {
    this.terms.get(termId)?.child.stdin?.write(data)
  }

  /** 经 stty 注入同步 pty 窗口尺寸（开头换行避免污染命令行）。 */
  resize(termId: string, cols: number, rows: number): void {
    if (process.platform === 'win32') return
    this.terms.get(termId)?.child.stdin?.write(`\nstty cols ${Math.max(20, cols)} rows ${Math.max(4, rows)}\n`)
  }

  close(termId: string): void {
    const handle = this.terms.get(termId)
    if (!handle) return
    this.terms.delete(termId)
    try { handle.child.kill('SIGHUP') } catch { /* 已退出 */ }
    setTimeout(() => { try { handle.child.kill('SIGKILL') } catch { /* 已退出 */ } }, 1_000).unref()
  }

  async dispose(): Promise<void> {
    for (const termId of [...this.terms.keys()]) this.close(termId)
  }
}
