import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CiService, parseGithubRepo, parsePipeline } from '../src/main/services/ci'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'
import type { CiEvent, CiRunView } from '../src/shared/types'

describe('parsePipeline（schema 校验）', () => {
  it('合法定义：name/env/steps/timeout', () => {
    const def = parsePipeline('name: 构建\nenv:\n  CI: "1"\nsteps:\n  - name: 安装\n    run: pnpm install\n    timeout: 300\n  - name: 测试\n    run: pnpm test\n    env:\n      FOO: bar\n', 'a.yaml')
    expect(def.name).toBe('构建')
    expect(def.env).toEqual({ CI: '1' })
    expect(def.steps).toHaveLength(2)
    expect(def.steps[0]).toMatchObject({ name: '安装', run: 'pnpm install', timeout: 300 })
    expect(def.steps[1].env).toEqual({ FOO: 'bar' })
  })

  it('缺 name / 空 steps / 非法 timeout 逐项报错', () => {
    expect(() => parsePipeline('steps: [ {name: a, run: b} ]', 'a.yaml')).toThrow('缺 name')
    expect(() => parsePipeline('name: x\nsteps: []', 'a.yaml')).toThrow('非空数组')
    expect(() => parsePipeline('name: x\nsteps: [{name: a}]', 'a.yaml')).toThrow('缺 run')
    expect(() => parsePipeline('name: x\nsteps: [{name: a, run: b, timeout: -1}]', 'a.yaml')).toThrow('timeout')
  })

  it('YAML 语法错误带文件名', () => {
    expect(() => parsePipeline(':\n  - [', 'bad.yaml')).toThrow('bad.yaml')
  })
})

describe('parseGithubRepo', () => {
  it('https 与 ssh 形态', () => {
    expect(parseGithubRepo('https://github.com/deepseek-ai/deepseek-harness.git')).toBe('deepseek-ai/deepseek-harness')
    expect(parseGithubRepo('git@github.com:deepseek-ai/deepseek-harness.git')).toBe('deepseek-ai/deepseek-harness')
    expect(parseGithubRepo('https://github.com/a/b')).toBe('a/b')
    expect(parseGithubRepo('https://gitlab.com/a/b.git')).toBeNull()
  })
})

describe('CiService 执行器（真实 shell）', () => {
  let rootDir: string
  let service: CiService
  let events: CiEvent[]

  const writePipeline = (id: string, body: string): void => {
    fs.mkdirSync(path.join(rootDir, '.aircode', 'pipelines'), { recursive: true })
    fs.writeFileSync(path.join(rootDir, '.aircode', 'pipelines', `${id}.yaml`), body)
  }

  const waitRunDone = (runId: string, ms = 20_000): Promise<CiRunView> =>
    new Promise((resolve, reject) => {
      const deadline = Date.now() + ms
      const tick = (): void => {
        const run = service.listRuns().find((item) => item.runId === runId)
        if (run && run.state !== 'running') { resolve(run); return }
        if (Date.now() > deadline) { reject(new Error('run timeout')); return }
        setTimeout(tick, 100)
      }
      tick()
    })

  beforeEach(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-ci-'))
    const workspace = new WorkspaceService(new Logger(null))
    await workspace.setRoot(rootDir)
    service = new CiService(workspace, new Logger(null))
    events = []
    service.onEvent((event) => events.push(event))
  })

  afterEach(async () => {
    await service.dispose()
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  it('listPipelines 发现定义', async () => {
    writePipeline('build', 'name: 构建\nsteps:\n  - name: 回声\n    run: echo hi\n')
    const list = await service.listPipelines()
    expect(list).toEqual([{ id: 'build', name: '构建', file: path.join(fs.realpathSync(rootDir), '.aircode', 'pipelines', 'build.yaml'), stepCount: 1 }])
  })

  it('成功流水线：步骤全 success + 日志到达', async () => {
    writePipeline('ok', 'name: OK\nsteps:\n  - name: 第一步\n    run: echo hello-step\n  - name: 第二步\n    run: echo done\n')
    const { runId } = await service.run('ok')
    const run = await waitRunDone(runId)
    expect(run.state).toBe('success')
    expect(run.steps.map((s) => s.state)).toEqual(['success', 'success'])
    const logs = events.filter((e) => e.type === 'log' && e.runId === runId)
    expect(logs.some((e) => e.type === 'log' && e.text.includes('hello-step'))).toBe(true)
  })

  it('失败步骤中断后续（skipped）并标记 failed', async () => {
    writePipeline('bad', 'name: BAD\nsteps:\n  - name: 失败\n    run: exit 3\n  - name: 不会跑\n    run: echo never\n')
    const { runId } = await service.run('bad')
    const run = await waitRunDone(runId)
    expect(run.state).toBe('failed')
    expect(run.steps[0]).toMatchObject({ state: 'failed', exitCode: 3 })
    expect(run.steps[1].state).toBe('skipped')
  })

  it('步骤超时强杀', async () => {
    writePipeline('slow', 'name: SLOW\nsteps:\n  - name: 睡眠\n    run: sleep 30\n    timeout: 1\n')
    const { runId } = await service.run('slow')
    const run = await waitRunDone(runId, 15_000)
    expect(run.state).toBe('failed')
    expect(run.steps[0].state).toBe('failed')
  }, 20_000)

  it('取消运行：进程被杀、状态 cancelled', async () => {
    writePipeline('cancel-me', 'name: C\nsteps:\n  - name: 睡眠\n    run: sleep 30\n')
    const { runId } = await service.run('cancel-me')
    await new Promise((resolve) => setTimeout(resolve, 400))
    service.cancel('cancel-me')
    const run = await waitRunDone(runId, 15_000)
    expect(run.state).toBe('cancelled')
  }, 20_000)

  it('同流水线并发拒绝', async () => {
    writePipeline('busy', 'name: B\nsteps:\n  - name: 睡眠\n    run: sleep 5\n')
    await service.run('busy')
    await expect(service.run('busy')).rejects.toThrow('already running')
    service.cancel('busy')
  })

  it('env 传递（pipeline + step 级）', async () => {
    writePipeline('envtest', 'name: E\nenv:\n  OUTER: outer-val\nsteps:\n  - name: 回声\n    run: echo $OUTER-$INNER\n    env:\n      INNER: inner-val\n')
    const { runId } = await service.run('envtest')
    await waitRunDone(runId)
    const logs = events.filter((e) => e.type === 'log' && e.runId === runId)
    expect(logs.some((e) => e.type === 'log' && e.text.includes('outer-val-inner-val'))).toBe(true)
  })
})
