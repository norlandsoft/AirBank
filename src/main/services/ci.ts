import fs from 'node:fs/promises'
import path from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'
import { parse as parseYaml } from 'yaml'
import type { Logger } from './logger'
import type { WorkspaceService } from './workspace'
import type {
  CiEvent, CiPipelineDef, CiPipelineInfo, CiRunView, CiStepDef, CiStepView,
} from '../../shared/types'

const PIPELINES_DIR = '.aircode/pipelines'
const DEFAULT_STEP_TIMEOUT_S = 600
const MAX_RUNS = 30

/** 流水线 YAML 校验（手工守卫，逐字段报错）。 */
export function parsePipeline(text: string, file: string): CiPipelineDef {
  let raw: unknown
  try {
    raw = parseYaml(text)
  } catch (error) {
    throw new Error(`${file}: YAML 解析失败：${error instanceof Error ? error.message : String(error)}`)
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${file}: 顶层必须是对象`)
  const doc = raw as Record<string, unknown>
  if (typeof doc.name !== 'string' || doc.name.trim() === '') throw new Error(`${file}: 缺 name`)
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) throw new Error(`${file}: steps 必须非空数组`)
  const env = parseEnv(doc.env, file)
  const steps: CiStepDef[] = doc.steps.map((item, index) => {
    if (typeof item !== 'object' || item === null) throw new Error(`${file}: steps[${index}] 必须是对象`)
    const step = item as Record<string, unknown>
    if (typeof step.name !== 'string' || step.name.trim() === '') throw new Error(`${file}: steps[${index}] 缺 name`)
    if (typeof step.run !== 'string' || step.run.trim() === '') throw new Error(`${file}: steps[${index}] 缺 run`)
    const def: CiStepDef = { name: step.name, run: step.run }
    if (step.timeout !== undefined) {
      if (typeof step.timeout !== 'number' || step.timeout <= 0) throw new Error(`${file}: steps[${index}].timeout 必须为正数`)
      def.timeout = step.timeout
    }
    const stepEnv = parseEnv(step.env, file)
    if (stepEnv) def.env = stepEnv
    return def
  })
  const def: CiPipelineDef = { name: doc.name, steps }
  if (env) def.env = env
  return def
}

function parseEnv(raw: unknown, file: string): Record<string, string> | undefined {
  if (raw === undefined) return undefined
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new Error(`${file}: env 必须是键值对象`)
  const env: Record<string, string> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    env[key] = typeof value === 'string' ? value : String(value)
  }
  return env
}

/** GitHub remote URL → owner/repo（https 与 ssh 形态）。 */
export function parseGithubRepo(remoteUrl: string): string | null {
  const https = /github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(remoteUrl.trim())
  return https ? https[1] : null
}

interface ActiveRun {
  view: CiRunView
  child: ChildProcess | null
  cancelled: boolean
}

/**
 * CI/CD 服务：.aircode/pipelines/*.yaml 本地流水线执行器。
 * 逐步 spawn（shell 执行，FORCE_COLOR 保真日志），事件：run 状态 + log 增量。
 * 每流水线同时只允许一个活跃 run；历史保留最近 MAX_RUNS 条（内存，v1 不持久化）。
 * 设计文档偏差：执行载体用 child_process 而非 node-pty（免原生依赖；TTY 强需求工具少见）。
 */
export class CiService {
  private readonly runs: CiRunView[] = []
  private readonly active = new Map<string, ActiveRun>()
  private readonly listeners = new Set<(event: CiEvent) => void>()
  private nextRun = 1

  constructor(
    private readonly workspace: WorkspaceService,
    private readonly logger: Logger,
  ) {}

  onEvent(listener: (event: CiEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: CiEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch (error) { this.logger.warn('ci', `listener error: ${String(error)}`) }
    }
  }

  private pipelinesDir(): string {
    const root = this.workspace.getRoot()
    if (!root) throw new Error('workspace root is not set')
    return path.join(root, PIPELINES_DIR)
  }

  async listPipelines(): Promise<CiPipelineInfo[]> {
    const dir = this.pipelinesDir()
    const names = await fs.readdir(dir).catch(() => [] as string[])
    const out: CiPipelineInfo[] = []
    for (const name of names) {
      if (!/\.(ya?ml)$/.test(name)) continue
      const file = path.join(dir, name)
      try {
        const def = parsePipeline(await fs.readFile(file, 'utf8'), name)
        out.push({ id: name.replace(/\.(ya?ml)$/, ''), name: def.name, file, stepCount: def.steps.length })
      } catch (error) {
        this.logger.warn('ci', String(error))
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name))
  }

  private async loadDef(pipelineId: string): Promise<CiPipelineDef> {
    if (!/^[\w.-]+$/.test(pipelineId)) throw new Error(`invalid pipeline id: ${pipelineId}`)
    for (const ext of ['.yaml', '.yml']) {
      const file = path.join(this.pipelinesDir(), `${pipelineId}${ext}`)
      const text = await fs.readFile(file, 'utf8').catch(() => null)
      if (text !== null) return parsePipeline(text, `${pipelineId}${ext}`)
    }
    throw new Error(`pipeline not found: ${pipelineId}`)
  }

  listRuns(): CiRunView[] {
    return [...this.runs]
  }

  /** 触发一次运行（同流水线已有活跃 run 则拒绝）。 */
  async run(pipelineId: string): Promise<CiRunView> {
    if (this.active.has(pipelineId)) throw new Error(`pipeline ${pipelineId} is already running`)
    const def = await this.loadDef(pipelineId)
    const root = this.workspace.getRoot()
    if (!root) throw new Error('workspace root is not set')
    const view: CiRunView = {
      runId: `run-${this.nextRun++}`,
      pipelineId,
      name: def.name,
      state: 'running',
      startedAt: Date.now(),
      steps: def.steps.map((step) => ({ name: step.name, state: 'pending' })),
    }
    this.runs.unshift(view)
    if (this.runs.length > MAX_RUNS) this.runs.length = MAX_RUNS
    const active: ActiveRun = { view, child: null, cancelled: false }
    this.active.set(pipelineId, active)
    this.emit({ type: 'run', run: { ...view } })
    this.logger.info('ci', `run ${view.runId} ${def.name} (${def.steps.length} steps)`)
    void this.execute(active, def, root).finally(() => {
      this.active.delete(pipelineId)
    })
    return { ...view }
  }

  cancel(pipelineId: string): void {
    const active = this.active.get(pipelineId)
    if (!active) return
    active.cancelled = true
    const child = active.child
    if (child) {
      try { child.kill('SIGTERM') } catch { /* 已退出 */ }
      setTimeout(() => { try { child.kill('SIGKILL') } catch { /* 已退出 */ } }, 3_000).unref()
    }
  }

  private patchRun(view: CiRunView): void {
    this.emit({ type: 'run', run: JSON.parse(JSON.stringify(view)) as CiRunView })
  }

  private async execute(active: ActiveRun, def: CiPipelineDef, cwd: string): Promise<void> {
    const { view } = active
    for (let index = 0; index < def.steps.length; index += 1) {
      const stepDef = def.steps[index]
      const stepView: CiStepView = view.steps[index]
      if (active.cancelled) {
        stepView.state = 'skipped'
        this.patchRun(view)
        continue
      }
      stepView.state = 'running'
      const startedAt = Date.now()
      this.patchRun(view)
      const exitCode = await this.execStep(active, view.runId, index, stepDef, def.env ?? {}, cwd)
      stepView.durationMs = Date.now() - startedAt
      stepView.exitCode = exitCode
      if (exitCode === 0) {
        stepView.state = 'success'
        this.patchRun(view)
        continue
      }
      stepView.state = active.cancelled ? 'cancelled' : 'failed'
      for (let rest = index + 1; rest < view.steps.length; rest += 1) view.steps[rest].state = 'skipped'
      view.state = active.cancelled ? 'cancelled' : 'failed'
      view.finishedAt = Date.now()
      this.patchRun(view)
      return
    }
    view.state = active.cancelled ? 'cancelled' : 'success'
    view.finishedAt = Date.now()
    this.patchRun(view)
  }

  /** 单步执行：spawn shell，日志实时推流，超时强杀。 */
  private execStep(
    active: ActiveRun,
    runId: string,
    stepIndex: number,
    step: CiStepDef,
    pipelineEnv: Record<string, string>,
    cwd: string,
  ): Promise<number> {
    return new Promise((resolve) => {
      const child = spawn(step.run, {
        cwd,
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1', CI: '1', ...pipelineEnv, ...(step.env ?? {}) },
      })
      active.child = child
      const timeoutMs = (step.timeout ?? DEFAULT_STEP_TIMEOUT_S) * 1000
      const timer = setTimeout(() => {
        this.emit({ type: 'log', runId, stepIndex, stream: 'err', text: `[aircode] 步骤超时（${step.timeout ?? DEFAULT_STEP_TIMEOUT_S}s），强制终止\n` })
        try { child.kill('SIGKILL') } catch { /* 已退出 */ }
      }, timeoutMs)
      child.stdout.on('data', (chunk: Buffer) => {
        this.emit({ type: 'log', runId, stepIndex, stream: 'out', text: chunk.toString('utf8') })
      })
      child.stderr.on('data', (chunk: Buffer) => {
        this.emit({ type: 'log', runId, stepIndex, stream: 'err', text: chunk.toString('utf8') })
      })
      child.once('error', () => {
        clearTimeout(timer)
        resolve(127)
      })
      child.once('exit', (code) => {
        clearTimeout(timer)
        if (active.child === child) active.child = null
        resolve(code ?? 130)
      })
    })
  }

  async dispose(): Promise<void> {
    for (const pipelineId of this.active.keys()) this.cancel(pipelineId)
  }
}
