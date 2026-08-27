import type { Logger } from './logger'
import type { DshServerManager } from './server'
import {
  apiPath, HOST_EVENTS_PATH, makeClientRequest, MUX_EVENTS_PATH, parseRpcReceipt, parseServerRequest,
  parseServerResponse, RESPOND_PATH,
  type ClientResponse, type RpcId, type RpcReceipt, type RpcResult,
} from '../../shared/dsh/wire'

/** rpc 调用回执：镜像官方 RpcResponse（rpcId 回声供乐观回显对账）。 */
export interface KernelRpcResponse {
  rpcId: RpcId
  result: RpcResult<unknown>
}

export type StreamKind = 'mux' | 'host'

/** 流事件：open（物理可读）/ frame（已解信封的 ServerRequest）/ closed（ socket 关闭）。 */
export type StreamEvent =
  | { kind: StreamKind; type: 'open' }
  | { kind: StreamKind; type: 'frame'; rpcId: RpcId; payload: unknown }
  | { kind: StreamKind; type: 'closed' }

/** WebSocket 工厂（测试注入 fake；生产用 Node 全局 WebSocket——不带 Origin 头，过内核信任围栏）。 */
export type SocketFactory = (url: string) => WebSocket

const defaultSocketFactory: SocketFactory = (url) => new WebSocket(url)

const METHOD_PATTERN = /^[a-zA-Z][\w.-]*$/
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * 内核 HTTP RPC 代理（设计文档 §2.1）：渲染层直连内核 HTTP 会被
 * Origin/Host/Sec-Fetch-Site 信任围栏拦截（dev=file:// / prod 非同源），
 * 主进程是 Node fetch——无 CORS 概念、天然回环 Host、不带 Origin 头，过围栏。
 * 仅转发；业务错误不抛异常，以 RpcResult 原样回渲染层折叠。
 */
export class KernelProxyService {
  private readonly sockets = new Map<StreamKind, WebSocket>()
  private readonly streamListeners = new Set<(event: StreamEvent) => void>()

  constructor(
    private readonly server: DshServerManager,
    private readonly logger: Logger,
    private readonly createSocket: SocketFactory = defaultSocketFactory,
  ) {}

  private baseUrl(): string {
    const status = this.server.getStatus()
    if (status.state !== 'running' || !status.url) throw new Error('dsh server is not running')
    return status.url
  }

  private async post(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
    const response = await fetch(new URL(path, this.baseUrl()), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) throw new Error(`kernel transport failure for ${path}: HTTP ${response.status}`)
    return response.json() as Promise<unknown>
  }

  /** 一元 RPC：POST /api/<method>。传输/信封错误抛 Error；业务错误走 result.error。 */
  async rpc(method: string, payload: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<KernelRpcResponse> {
    if (!METHOD_PATTERN.test(method)) throw new Error(`invalid rpc method: ${method}`)
    const request = makeClientRequest(method, payload)
    const raw = await this.post(apiPath(method), request, timeoutMs)
    const full = parseServerResponse(raw)
    if (!full) throw new Error(`malformed server-response for ${method}`)
    if (full.rpcId !== request.rpcId) throw new Error(`rpcId mismatch for ${method}`)
    return { rpcId: full.rpcId, result: full.result }
  }

  /** 应答 server-request（审批/提问）：POST /api/respond，rpcId 原样回声（永不新铸）。 */
  async respond(rpcId: RpcId, result: RpcResult<unknown>): Promise<RpcReceipt> {
    const message: ClientResponse = { type: 'client-response', rpcId, result }
    const raw = await this.post(RESPOND_PATH, message, DEFAULT_TIMEOUT_MS)
    const receipt = parseRpcReceipt(raw)
    if (!receipt) throw new Error('malformed respond receipt')
    if (!receipt.accepted) this.logger.warn('dsh-proxy', `respond ${rpcId} rejected: ${receipt.reason}`)
    return receipt
  }

  /** 会话日志导出地址（GET /api/session.export，渲染层经 shell 或下载使用）。 */
  exportUrl(sessionId: string, includeDescendants = false): string {
    const url = new URL('/api/session.export', this.baseUrl())
    url.searchParams.set('sessionId', sessionId)
    url.searchParams.set('includeDescendants', String(includeDescendants))
    return url.toString()
  }

  // ---- 事件流代理（渲染层 WS 带 Origin 头被围栏 403，必须经主进程） ----

  onStreamEvent(listener: (event: StreamEvent) => void): () => void {
    this.streamListeners.add(listener)
    return () => this.streamListeners.delete(listener)
  }

  private emitStream(event: StreamEvent): void {
    for (const listener of this.streamListeners) {
      try { listener(event) } catch (error) { this.logger.warn('dsh-proxy', `stream listener error: ${String(error)}`) }
    }
  }

  /** 打开一条只下行流（幂等：同 kind 先关后开；重连节奏由渲染层驱动）。 */
  openStream(kind: StreamKind): void {
    this.closeStream(kind)
    const base = this.baseUrl()
    const url = new URL(kind === 'mux' ? MUX_EVENTS_PATH : HOST_EVENTS_PATH, base)
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
    this.logger.info('dsh-proxy', `open ${kind} stream ${url.toString()}`)
    const socket = this.createSocket(url.toString())
    this.sockets.set(kind, socket)
    socket.addEventListener('open', () => {
      if (this.sockets.get(kind) === socket) this.emitStream({ kind, type: 'open' })
    })
    socket.addEventListener('message', (event) => {
      if (this.sockets.get(kind) !== socket || typeof event.data !== 'string') return
      try {
        const full = parseServerRequest(JSON.parse(event.data))
        if (full) this.emitStream({ kind, type: 'frame', rpcId: full.rpcId, payload: full.payload })
      } catch { /* 畸形帧丢弃不杀流 */ }
    })
    socket.addEventListener('close', () => {
      if (this.sockets.get(kind) !== socket) return
      this.sockets.delete(kind)
      this.emitStream({ kind, type: 'closed' })
    })
    socket.addEventListener('error', () => { /* close 随后到达，统一处理 */ })
  }

  closeStream(kind: StreamKind): void {
    const socket = this.sockets.get(kind)
    this.sockets.delete(kind)
    if (socket && (socket.readyState === WebSocket.CONNECTING || socket.readyState === WebSocket.OPEN)) socket.close()
  }

  closeStreams(): void {
    this.closeStream('mux')
    this.closeStream('host')
  }
}
