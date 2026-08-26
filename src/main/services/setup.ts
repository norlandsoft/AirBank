import type { RuntimeManager } from './runtime'
import type { KernelManager } from './kernel'
import type { Logger } from './logger'
import type { InstallPlan, InstallStep } from '../../shared/types'

/** 首次启动安装状态机：运行时（含 pnpm）→ 内核，逐步推送进度快照。 */
export class SetupService {
  private plan: InstallPlan | null = null
  private running: Promise<InstallPlan> | null = null
  private listeners = new Set<(plan: InstallPlan) => void>()

  constructor(
    private readonly runtime: RuntimeManager,
    private readonly kernel: KernelManager,
    private readonly logger: Logger,
  ) {}

  snapshot(): InstallPlan | null {
    return this.plan ? { ...this.plan, steps: this.plan.steps.map((step) => ({ ...step })) } : null
  }

  onPlan(listener: (plan: InstallPlan) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(): void {
    const snapshot = this.snapshot()
    if (!snapshot) return
    for (const listener of this.listeners) listener(snapshot)
  }

  private patch = (update: Partial<InstallStep> & { id: string }): void => {
    if (!this.plan) return
    this.plan = {
      ...this.plan,
      steps: this.plan.steps.map((step) => (step.id === update.id ? { ...step, ...update } : step)),
    }
    this.emit()
  }

  /** 幂等：重复调用复用进行中的安装。 */
  run(): Promise<InstallPlan> {
    if (this.running) return this.running
    this.running = this.execute().finally(() => { this.running = null })
    return this.running
  }

  private async execute(): Promise<InstallPlan> {
    const runtimeStatus = this.runtime.status()
    const kernelStatus = this.kernel.status()
    const needRuntime = !runtimeStatus.available || !runtimeStatus.supported
    const needKernel = !kernelStatus.installed
    const steps: InstallStep[] = []
    if (needRuntime) {
      steps.push({ id: 'runtime', status: 'pending', progress: 0, detail: '' })
      steps.push({ id: 'pnpm', status: 'pending', progress: 0, detail: '' })
    }
    if (needKernel) steps.push({ id: 'kernel', status: 'pending', progress: 0, detail: '' })
    this.plan = { steps, active: true, done: false, error: null }
    this.emit()
    this.logger.info('setup', `install plan: runtime=${String(needRuntime)} kernel=${String(needKernel)}`)
    try {
      if (needRuntime) await this.runtime.install(this.patch)
      if (needKernel) await this.kernel.install(this.patch)
      this.plan = { ...this.plan, active: false, done: true }
      this.emit()
      return this.snapshot() as InstallPlan
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.logger.error('setup', `install failed: ${message}`)
      if (this.plan) {
        this.plan = {
          ...this.plan,
          active: false,
          error: message,
          steps: this.plan.steps.map((step) => (step.status === 'active' ? { ...step, status: 'error' } : step)),
        }
        this.emit()
      }
      throw error
    }
  }
}
