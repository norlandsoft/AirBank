/** 就绪探测：移植自参考项目 readiness.ts，间隔轮询直到健康 / 超时 / 外部取消。 */

export interface ReadinessProbeResult {
  healthy: boolean
  /** 端口被非本进程的服务占用（健康但不属于我们，不应复用）。 */
  notOwned: boolean
}

export interface PollReadinessOptions {
  probe: () => Promise<ReadinessProbeResult>
  intervalMs: number
  maxAttempts?: number
  shouldContinue?: () => boolean
  wait?: (milliseconds: number) => Promise<void>
}

const delay = (milliseconds: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds))

export async function pollReadiness({
  probe,
  intervalMs,
  maxAttempts,
  shouldContinue = () => true,
  wait = delay,
}: PollReadinessOptions): Promise<ReadinessProbeResult> {
  let remainingAttempts = maxAttempts
  while (shouldContinue() && remainingAttempts !== 0) {
    const result = await probe()
    if (!shouldContinue()) return { healthy: false, notOwned: false }
    if (remainingAttempts !== undefined) remainingAttempts--
    if (result.healthy || result.notOwned) return result
    if (shouldContinue() && remainingAttempts !== 0) await wait(intervalMs)
  }
  return { healthy: false, notOwned: false }
}
