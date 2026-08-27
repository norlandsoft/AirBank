/**
 * DSH 内核 wire 协议：四象限信封 + mux/host 事件帧。
 * 逐字段对齐内核 packages/host/apiproxy/src/api/{rpc,events,events.schema}.ts（随内核版本锁定抄录，
 * 升级内核时人工 diff 以上三个文件）。纯类型 + 手工结构守卫，零依赖（不引 zod）。
 *
 * 解析哲学与官方客户端一致（web-api-client.ts）：畸形帧返回 null 由调用方丢弃，
 * 单帧损坏不杀流；深层业务数据（SessionEvent.data / projection value）留给消费方解释。
 */

// ---- 基础标量 ----

export type RpcId = string
export type SessionId = string
export type ApprovalRequestId = string

/** 业务错误（rpc.ts RpcError 的宽松版：details 各 code 不同，消费方按 code 解释）。 */
export interface RpcError {
  code: string
  message: string
  details: Record<string, unknown>
}

/** 业务结果槽：方法不抛业务错误，失败走 error 分支。 */
export type RpcResult<T> = { ok: true; value: T } | { ok: false; error: RpcError }

/** /api/respond 的载体回执（rpc.ts RpcReceipt）。 */
export type RpcReceipt = { accepted: true } | { accepted: false; reason: 'not-pending' | 'bad-response' }

// ---- 四象限信封（rpc.ts:144-177） ----

export interface ClientRequest {
  type: 'client-request'
  rpcId: RpcId
  method: string
  payload: unknown
}

export interface ServerResponse {
  type: 'server-response'
  rpcId: RpcId
  result: RpcResult<unknown>
}

export interface ServerRequest {
  type: 'server-request'
  rpcId: RpcId
  method: string
  payload: unknown
}

export interface ClientResponse {
  type: 'client-response'
  rpcId: RpcId
  result: RpcResult<unknown>
}

// ---- 路径常量 ----

export const MUX_EVENTS_PATH = '/api/events.mux'
export const HOST_EVENTS_PATH = '/api/events.host'
export const RESPOND_PATH = '/api/respond'
export const apiPath = (method: string): string => `/api/${method}`

// ---- 事件帧载荷（events.ts:69-155） ----

/** 会话事件信封（core/session types.ts:408 宽松版；data 由消费方按 type 解释，M1 起逐域收紧）。 */
export interface SessionEventEnvelope {
  type: string
  seq: number
  time: number
  data: unknown
  ignorable?: boolean
}

/** Host 计算的渲染意图（events.ts:32；具体视图形态 M1 收紧）。 */
export type ToolEventView = { for: 'call' | 'result'; view: unknown }

/** 用户提问条目（events.schema.ts:20-32 严格对齐）。 */
export interface AskUserQuestionItem {
  id: string
  question: string
  header?: string
  detail?: string
  options?: { label: string; description?: string }[]
  multiSelect?: boolean
  intent?: { kind: 'plan-review'; approve: string }
}

/** 排队消息快照条目（events.ts:37-44 + events.schema.ts:35-40）。 */
export interface QueuedInboxItem {
  id: string
  placement: 'queued' | 'steering' | 'context'
  message: {
    id: string
    role: 'system' | 'user' | 'assistant'
    content: unknown[]
    source: Record<string, unknown>
  }
}

/** 后台任务视图（jobs.schema taskViewSchema；M1 收紧为具体字段）。 */
export type JobView = Record<string, unknown>

/** 工作区视图（workspace.schema workspaceViewSchema 宽松版）。 */
export interface WorkspaceView {
  workspaceId: string
  path: string
  title: string
  sessionIds: string[]
  createdAt: number
  updatedAt: number
}

export type ApprovalOutcome = 'allowed-once' | 'rejected' | 'cancelled' | 'unavailable'

/** 审批应答载荷（approvals.ts ApprovalResponsePayload，置于 client-response 的 result.value）。 */
export interface ApprovalResponsePayload {
  sessionId: SessionId
  approvalId: ApprovalRequestId
  outcome: 'allowed-once' | 'rejected'
}

/** mux 流帧：payload 槽位（ServerRequest.payload），10 个变体。 */
export type MuxFrame =
  | { type: 'session/event'; sessionId: SessionId; event: SessionEventEnvelope; view?: ToolEventView }
  | { type: 'session/subscribed'; sessionId: SessionId; lastSeq: number }
  | { type: 'approval/requested'; sessionId: SessionId; approvalId: ApprovalRequestId; toolName: string; callId?: string; reason?: string }
  | { type: 'approval/resolved'; sessionId: SessionId; approvalId: ApprovalRequestId; outcome: ApprovalOutcome }
  | { type: 'question/requested'; sessionId: SessionId; questions: AskUserQuestionItem[] }
  | { type: 'question/resolved'; sessionId: SessionId; questionRpcId: RpcId; outcome: 'answered' | 'cancelled' }
  | { type: 'session/queue'; sessionId: SessionId; items: QueuedInboxItem[] }
  | { type: 'session/jobs'; sessionId: SessionId; jobs: JobView[] }
  | { type: 'session/projection'; sessionId: SessionId; key: string; value: unknown; seq: number }
  | { type: 'stream/error'; error: RpcError }

/** host 流帧：payload 槽位，10 个变体。 */
export type HostFrame =
  | { type: 'host/session-added'; sessionId: SessionId; blank: boolean; parentSessionId?: SessionId; origin?: 'subagent'; cwd?: string; agentPreset?: string }
  | { type: 'host/session-removed'; sessionId: SessionId }
  | { type: 'host/session-status'; sessionId: SessionId; running: boolean }
  | { type: 'host/agent-error'; sessionId: SessionId; message: string }
  | { type: 'host/workspace-changed'; workspace: WorkspaceView }
  | { type: 'host/workspace-removed'; workspaceId: string }
  | { type: 'host/workspace-order-changed'; workspaceIds: string[] }
  | { type: 'host/archived-sessions-changed'; archivedSessionIds: SessionId[] }
  | { type: 'host/remote-event'; event: string; args: unknown[] }
  | { type: 'stream/error'; error: RpcError }

// ---- 会话域常用 RPC 载荷/返回（sessions.ts / host.ts，宽松抄录） ----

export type PromptContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string; name?: string }

export interface SessionSummary {
  sessionId: SessionId
  updatedAt: number
  running: boolean
  blank: boolean
  parentSessionId?: SessionId
  origin?: 'subagent'
  cwd?: string
  agentPreset?: string
  projections?: Record<string, unknown>
}

export interface HistoryEntry {
  event: SessionEventEnvelope
  view?: ToolEventView
}

export interface HostDescription {
  version: string
  cwd: string
  provider?: string
  model?: string
  attachedSessions: number
  home: string
  canOpenPath: boolean
}

// ---- 构造与解析（手工守卫，畸形 → null） ----

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export function mintRpcId(): RpcId {
  return crypto.randomUUID()
}

export function makeClientRequest(method: string, payload: unknown): ClientRequest {
  return { type: 'client-request', rpcId: mintRpcId(), method, payload }
}

export function parseRpcError(value: unknown): RpcError | null {
  if (!isRecord(value)) return null
  if (typeof value.code !== 'string' || typeof value.message !== 'string') return null
  return { code: value.code, message: value.message, details: isRecord(value.details) ? value.details : {} }
}

export function parseRpcResult(value: unknown): RpcResult<unknown> | null {
  if (!isRecord(value)) return null
  if (value.ok === true) return { ok: true, value: value.value }
  if (value.ok === false) {
    const error = parseRpcError(value.error)
    return error ? { ok: false, error } : null
  }
  return null
}

export function parseServerResponse(value: unknown): ServerResponse | null {
  if (!isRecord(value) || value.type !== 'server-response' || typeof value.rpcId !== 'string') return null
  const result = parseRpcResult(value.result)
  return result ? { type: 'server-response', rpcId: value.rpcId, result } : null
}

export function parseServerRequest(value: unknown): ServerRequest | null {
  if (!isRecord(value) || value.type !== 'server-request') return null
  if (typeof value.rpcId !== 'string' || typeof value.method !== 'string') return null
  return { type: 'server-request', rpcId: value.rpcId, method: value.method, payload: value.payload }
}

export function parseRpcReceipt(value: unknown): RpcReceipt | null {
  if (!isRecord(value)) return null
  if (value.accepted === true) return { accepted: true }
  if (value.accepted === false && (value.reason === 'not-pending' || value.reason === 'bad-response')) {
    return { accepted: false, reason: value.reason }
  }
  return null
}

const withSession = (value: Record<string, unknown>): SessionId | null =>
  typeof value.sessionId === 'string' ? value.sessionId : null

/** mux 帧浅校验：已知 type + 关键字段在位；深层数据交给消费方（对齐官方 malformed-drop 语义）。 */
export function parseMuxFrame(value: unknown): MuxFrame | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  switch (value.type) {
    case 'session/event': {
      const sessionId = withSession(value)
      if (!sessionId || !isRecord(value.event) || typeof value.event.type !== 'string') return null
      return { type: 'session/event', sessionId, event: value.event as unknown as SessionEventEnvelope, view: value.view as ToolEventView | undefined }
    }
    case 'session/subscribed': {
      const sessionId = withSession(value)
      return sessionId && typeof value.lastSeq === 'number' ? { type: 'session/subscribed', sessionId, lastSeq: value.lastSeq } : null
    }
    case 'approval/requested': {
      const sessionId = withSession(value)
      if (!sessionId || typeof value.approvalId !== 'string' || typeof value.toolName !== 'string') return null
      return {
        type: 'approval/requested', sessionId, approvalId: value.approvalId, toolName: value.toolName,
        callId: typeof value.callId === 'string' ? value.callId : undefined,
        reason: typeof value.reason === 'string' ? value.reason : undefined,
      }
    }
    case 'approval/resolved': {
      const sessionId = withSession(value)
      if (!sessionId || typeof value.approvalId !== 'string' || typeof value.outcome !== 'string') return null
      return { type: 'approval/resolved', sessionId, approvalId: value.approvalId, outcome: value.outcome as ApprovalOutcome }
    }
    case 'question/requested': {
      const sessionId = withSession(value)
      if (!sessionId || !Array.isArray(value.questions) || value.questions.length === 0) return null
      return { type: 'question/requested', sessionId, questions: value.questions as AskUserQuestionItem[] }
    }
    case 'question/resolved': {
      const sessionId = withSession(value)
      if (!sessionId || typeof value.questionRpcId !== 'string') return null
      return { type: 'question/resolved', sessionId, questionRpcId: value.questionRpcId, outcome: value.outcome === 'answered' ? 'answered' : 'cancelled' }
    }
    case 'session/queue': {
      const sessionId = withSession(value)
      if (!sessionId || !Array.isArray(value.items)) return null
      return { type: 'session/queue', sessionId, items: value.items as QueuedInboxItem[] }
    }
    case 'session/jobs': {
      const sessionId = withSession(value)
      if (!sessionId || !Array.isArray(value.jobs)) return null
      return { type: 'session/jobs', sessionId, jobs: value.jobs as JobView[] }
    }
    case 'session/projection': {
      const sessionId = withSession(value)
      if (!sessionId || typeof value.key !== 'string' || typeof value.seq !== 'number') return null
      return { type: 'session/projection', sessionId, key: value.key, value: value.value, seq: value.seq }
    }
    case 'stream/error': {
      const error = parseRpcError(value.error)
      return error ? { type: 'stream/error', error } : null
    }
    default:
      return null
  }
}

/** host 帧浅校验。 */
export function parseHostFrame(value: unknown): HostFrame | null {
  if (!isRecord(value) || typeof value.type !== 'string') return null
  switch (value.type) {
    case 'host/session-added': {
      const sessionId = withSession(value)
      if (!sessionId || typeof value.blank !== 'boolean') return null
      return {
        type: 'host/session-added', sessionId, blank: value.blank,
        parentSessionId: typeof value.parentSessionId === 'string' ? value.parentSessionId : undefined,
        origin: value.origin === 'subagent' ? 'subagent' : undefined,
        cwd: typeof value.cwd === 'string' ? value.cwd : undefined,
        agentPreset: typeof value.agentPreset === 'string' ? value.agentPreset : undefined,
      }
    }
    case 'host/session-removed': {
      const sessionId = withSession(value)
      return sessionId ? { type: 'host/session-removed', sessionId } : null
    }
    case 'host/session-status': {
      const sessionId = withSession(value)
      return sessionId && typeof value.running === 'boolean' ? { type: 'host/session-status', sessionId, running: value.running } : null
    }
    case 'host/agent-error': {
      const sessionId = withSession(value)
      return sessionId && typeof value.message === 'string' ? { type: 'host/agent-error', sessionId, message: value.message } : null
    }
    case 'host/workspace-changed':
      return isRecord(value.workspace) ? { type: 'host/workspace-changed', workspace: value.workspace as unknown as WorkspaceView } : null
    case 'host/workspace-removed':
      return typeof value.workspaceId === 'string' ? { type: 'host/workspace-removed', workspaceId: value.workspaceId } : null
    case 'host/workspace-order-changed':
      return Array.isArray(value.workspaceIds) ? { type: 'host/workspace-order-changed', workspaceIds: value.workspaceIds as string[] } : null
    case 'host/archived-sessions-changed':
      return Array.isArray(value.archivedSessionIds) ? { type: 'host/archived-sessions-changed', archivedSessionIds: value.archivedSessionIds as string[] } : null
    case 'host/remote-event':
      return typeof value.event === 'string' && Array.isArray(value.args)
        ? { type: 'host/remote-event', event: value.event, args: value.args }
        : null
    case 'stream/error': {
      const error = parseRpcError(value.error)
      return error ? { type: 'stream/error', error } : null
    }
    default:
      return null
  }
}
