import { describe, expect, it } from 'vitest'
import { pollReadiness } from '../src/main/core/readiness'

const noWait = async (): Promise<void> => undefined

describe('pollReadiness', () => {
  it('健康后返回', async () => {
    let calls = 0
    const result = await pollReadiness({
      probe: async () => ({ healthy: ++calls >= 3, notOwned: false }),
      intervalMs: 1, maxAttempts: 10, wait: noWait,
    })
    expect(result.healthy).toBe(true)
    expect(calls).toBe(3)
  })
  it('notOwned 立即返回', async () => {
    const result = await pollReadiness({
      probe: async () => ({ healthy: false, notOwned: true }),
      intervalMs: 1, maxAttempts: 10, wait: noWait,
    })
    expect(result.notOwned).toBe(true)
  })
  it('尝试耗尽可能', async () => {
    let calls = 0
    const result = await pollReadiness({
      probe: async () => { calls++; return { healthy: false, notOwned: false } },
      intervalMs: 1, maxAttempts: 4, wait: noWait,
    })
    expect(result.healthy).toBe(false)
    expect(calls).toBe(4)
  })
  it('外部取消后停止', async () => {
    let calls = 0
    const result = await pollReadiness({
      probe: async () => { calls++; return { healthy: false, notOwned: false } },
      intervalMs: 1, maxAttempts: 100, shouldContinue: () => calls < 3, wait: noWait,
    })
    expect(result.healthy).toBe(false)
    expect(calls).toBeLessThanOrEqual(3)
  })
})
