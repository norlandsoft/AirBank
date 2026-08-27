import http from 'node:http'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { KernelProxyService, type StreamEvent } from '../src/main/services/kernel-proxy'
import type { DshServerManager } from '../src/main/services/server'
import type { ServerStatus } from '../src/shared/types'
import { Logger } from '../src/main/services/logger'
import type { ClientRequest } from '../src/shared/dsh/wire'

/** 本地内核桩：记录请求并返回可编程响应。 */
interface StubKernel {
  url: string
  requests: { path: string; body: ClientRequest | Record<string, unknown> }[]
  handler: (path: string, body: any) => { status?: number; json: unknown }
  close(): Promise<void>
}

async function startStub(handler: StubKernel['handler']): Promise<StubKernel> {
  const requests: StubKernel['requests'] = []
  const server = http.createServer((req, res) => {
    let raw = ''
    req.on('data', (c) => { raw += c })
    req.on('end', () => {
      const body = JSON.parse(raw || '{}')
      requests.push({ path: req.url ?? '', body })
      const { status = 200, json } = handler(req.url ?? '', body)
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(json))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  return {
    url: `http://127.0.0.1:${port}/`,
    requests,
    handler,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}

function fakeServerManager(url: string | null): DshServerManager {
  const status: ServerStatus = url
    ? { state: 'running', url, port: 1, pid: 1, profile: 'test', detail: null }
    : { state: 'stopped', url: null, port: null, pid: null, profile: null, detail: null }
  return { getStatus: () => status } as unknown as DshServerManager
}

const okEnvelope = (rpcId: string, value: unknown): unknown => ({
  type: 'server-response', rpcId, result: { ok: true, value },
})

describe('KernelProxyService', () => {
  let stub: StubKernel
  let proxy: KernelProxyService

  beforeEach(async () => {
    stub = await startStub((path, body: ClientRequest) => {
      if (path === '/api/host.describe') return { json: okEnvelope(body.rpcId, { version: '9.9.9' }) }
      if (path === '/api/session.fail') {
        return { json: { type: 'server-response', rpcId: body.rpcId, result: { ok: false, error: { code: 'internal', message: 'boom', details: {} } } } }
      }
      if (path === '/api/respond') return { json: { accepted: true } }
      if (path === '/api/echo-mismatch') return { json: okEnvelope('wrong-id', {}) }
      return { status: 404, json: {} }
    })
    proxy = new KernelProxyService(fakeServerManager(stub.url), new Logger(null))
  })

  afterEach(async () => {
    await stub.close()
  })

  it('rpc：信封形状 + rpcId 回声 + ok 解包', async () => {
    const response = await proxy.rpc('host.describe', {})
    expect(response.result).toEqual({ ok: true, value: { version: '9.9.9' } })
    const sent = stub.requests[0]
    expect(sent.path).toBe('/api/host.describe')
    expect(sent.body).toMatchObject({ type: 'client-request', method: 'host.describe', payload: {} })
    expect(response.rpcId).toBe((sent.body as ClientRequest).rpcId)
  })

  it('rpc：业务错误走 result.error 不抛异常', async () => {
    const response = await proxy.rpc('session.fail', { sessionId: 's' })
    expect(response.result).toMatchObject({ ok: false, error: { code: 'internal', message: 'boom' } })
  })

  it('rpc：rpcId 回声不符抛错', async () => {
    await expect(proxy.rpc('echo-mismatch', {})).rejects.toThrow('rpcId mismatch')
  })

  it('rpc：非法方法名拒绝', async () => {
    await expect(proxy.rpc('../etc', {})).rejects.toThrow('invalid rpc method')
  })

  it('rpc：HTTP 非 2xx 抛传输错误', async () => {
    await expect(proxy.rpc('missing', {})).rejects.toThrow('HTTP 404')
  })

  it('rpc：服务未运行时抛错', async () => {
    const down = new KernelProxyService(fakeServerManager(null), new Logger(null))
    await expect(down.rpc('host.describe', {})).rejects.toThrow('not running')
  })

  it('respond：POST /api/respond 且 rpcId 原样回声', async () => {
    const receipt = await proxy.respond('stable-rpc-id', { ok: true, value: { outcome: 'allowed-once' } })
    expect(receipt).toEqual({ accepted: true })
    expect(stub.requests[0].path).toBe('/api/respond')
    expect(stub.requests[0].body).toMatchObject({ type: 'client-response', rpcId: 'stable-rpc-id' })
  })

  it('exportUrl 带查询参数', () => {
    const url = proxy.exportUrl('s-1', true)
    expect(url).toContain('/api/session.export')
    expect(url).toContain('sessionId=s-1')
    expect(url).toContain('includeDescendants=true')
  })
})

/** 最小 fake WebSocket：同步事件派发，匹配全局 WebSocket 的 readyState 常量值。 */
class FakeSocket {
  static instances: FakeSocket[] = []
  readyState = 0 // CONNECTING
  readonly url: string
  closed = false
  private listeners = new Map<string, ((event: unknown) => void)[]>()

  constructor(url: string) {
    this.url = url
    FakeSocket.instances.push(this)
  }

  addEventListener(type: string, fn: (event: unknown) => void): void {
    const list = this.listeners.get(type) ?? []
    list.push(fn)
    this.listeners.set(type, list)
  }

  emit(type: string, event: unknown = {}): void {
    if (type === 'open') this.readyState = 1
    for (const fn of this.listeners.get(type) ?? []) fn(event)
  }

  close(): void {
    this.closed = true
    this.readyState = 3
    this.emit('close')
  }

  asWebSocket(): WebSocket {
    return this as unknown as WebSocket
  }
}

describe('KernelProxyService 事件流代理', () => {
  beforeEach(() => {
    FakeSocket.instances = []
  })

  function makeProxy(): { proxy: KernelProxyService; events: StreamEvent[] } {
    const events: StreamEvent[] = []
    const proxy = new KernelProxyService(
      fakeServerManager('http://127.0.0.1:39091/'),
      new Logger(null),
      (url) => new FakeSocket(url).asWebSocket(),
    )
    proxy.onStreamEvent((event) => events.push(event))
    return { proxy, events }
  }

  it('openStream：URL 转 ws 协议 + open/frame/closed 事件流', () => {
    const { proxy, events } = makeProxy()
    proxy.openStream('mux')
    const socket = FakeSocket.instances[0]
    expect(socket.url).toBe('ws://127.0.0.1:39091/api/events.mux')
    socket.emit('open')
    socket.emit('message', { data: JSON.stringify({ type: 'server-request', rpcId: 'r1', method: 'm', payload: { type: 'session/subscribed', sessionId: 's', lastSeq: 1 } }) })
    socket.emit('message', { data: 'not-json' }) // 畸形帧丢弃
    socket.emit('close')
    expect(events).toEqual([
      { kind: 'mux', type: 'open' },
      { kind: 'mux', type: 'frame', rpcId: 'r1', payload: { type: 'session/subscribed', sessionId: 's', lastSeq: 1 } },
      { kind: 'mux', type: 'closed' },
    ])
  })

  it('重复 openStream 幂等（先关旧 socket）', () => {
    const { proxy } = makeProxy()
    proxy.openStream('host')
    const first = FakeSocket.instances[0]
    proxy.openStream('host')
    expect(first.closed).toBe(true)
    expect(FakeSocket.instances).toHaveLength(2)
    expect(FakeSocket.instances[1].url).toBe('ws://127.0.0.1:39091/api/events.host')
  })

  it('closeStream 后 socket close 不再冒 closed 事件', () => {
    const { proxy, events } = makeProxy()
    proxy.openStream('mux')
    const socket = FakeSocket.instances[0]
    socket.emit('open')
    proxy.closeStream('mux')
    expect(socket.closed).toBe(true)
    expect(events).toEqual([{ kind: 'mux', type: 'open' }])
  })

  it('closeStreams 关闭全部', () => {
    const { proxy } = makeProxy()
    proxy.openStream('mux')
    proxy.openStream('host')
    proxy.closeStreams()
    expect(FakeSocket.instances.every((s) => s.closed)).toBe(true)
  })

  it('服务未运行时 openStream 抛错', () => {
    const proxy = new KernelProxyService(fakeServerManager(null), new Logger(null), (url) => new FakeSocket(url).asWebSocket())
    expect(() => proxy.openStream('mux')).toThrow('not running')
  })
})
