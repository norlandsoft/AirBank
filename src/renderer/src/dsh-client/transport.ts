import type { RpcId, RpcReceipt, RpcResult } from '../../../shared/dsh/wire'
import type { DshRpcResponse, DshStreamEvent, DshStreamKind } from '../../../shared/api'
import { bridge } from '../bridge'

/**
 * 一元 RPC 载体（设计文档 §2.1 Transport 抽象）：
 * 渲染层直连内核 HTTP 会被同源信任围栏拦截，故一元调用一律经主进程 kernel-proxy。
 */
export interface UnaryCarrier {
  rpc(method: string, payload: unknown): Promise<DshRpcResponse>
  respond(rpcId: RpcId, result: RpcResult<unknown>): Promise<RpcReceipt>
}

/**
 * 事件流载体：渲染层 WebSocket 一律带 Origin 头（dev=localhost:5173 / prod=null），
 * 被内核信任围栏 403（curl 实测）——故双流也经主进程（Node WebSocket 无 Origin，101 通过）。
 * 重连节奏由 DshClient 驱动，载体只提供开/关/订阅。
 */
export interface StreamCarrier {
  open(kind: DshStreamKind): Promise<void>
  close(kind: DshStreamKind): Promise<void>
  onEvent(listener: (event: DshStreamEvent) => void): () => void
}

/** 主进程 kernel-proxy 载体（生产唯一实现）。 */
export const mainProxyCarrier: UnaryCarrier & StreamCarrier = {
  rpc: (method, payload) => bridge.dsh.rpc(method, payload),
  respond: (rpcId, result) => bridge.dsh.respond(rpcId, result),
  open: (kind) => bridge.dsh.stream.open(kind),
  close: (kind) => bridge.dsh.stream.close(kind),
  onEvent: (listener) => bridge.onDshStreamEvent(listener),
}
