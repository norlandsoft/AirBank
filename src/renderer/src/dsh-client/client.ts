import {
  parseHostFrame, parseMuxFrame, unwrapProjections,
  type ApprovalResponsePayload, type HistoryEntry, type HostDescription, type HostFrame,
  type MuxFrame, type ProjectionsEnvelope, type PromptContentPart, type RpcError, type RpcId, type RpcReceipt, type SessionSummary,
} from '../../../shared/dsh/wire'
import type { DshStreamEvent, DshStreamKind } from '../../../shared/api'
import { mainProxyCarrier, type StreamCarrier, type UnaryCarrier } from './transport'

/** 业务错误折叠点：RpcResult 的 error 分支在此转为异常。 */
export class DshRpcError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly details: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'DshRpcError'
  }
}

const fold = <T>(result: { ok: true; value: unknown } | { ok: false; error: RpcError }): T => {
  if (result.ok) return result.value as T
  throw new DshRpcError(result.error.code, result.error.message, result.error.details)
}

export type ConnectionState = 'idle' | 'connecting' | 'ready' | 'reconnecting' | 'closed'

/** 带 rpcId 的流帧（approval/requested 的 rpcId 稳定、重连重放，是应答唯一凭据）。 */
export interface MuxEnvelope { rpcId: RpcId; frame: MuxFrame }
export interface HostEnvelope { rpcId: RpcId; frame: HostFrame }

type Listener<T> = (payload: T) => void

/** 极简类型化事件总线（模块内自用）。 */
class Bus {
  private readonly muxListeners = new Set<Listener<MuxEnvelope>>()
  private readonly hostListeners = new Set<Listener<HostEnvelope>>()
  private readonly stateListeners = new Set<Listener<ConnectionState>>()

  onMux(listener: Listener<MuxEnvelope>): () => void { this.muxListeners.add(listener); return () => this.muxListeners.delete(listener) }
  onHost(listener: Listener<HostEnvelope>): () => void { this.hostListeners.add(listener); return () => this.hostListeners.delete(listener) }
  onState(listener: Listener<ConnectionState>): () => void { this.stateListeners.add(listener); return () => this.stateListeners.delete(listener) }
  emitMux(envelope: MuxEnvelope): void { for (const l of this.muxListeners) l(envelope) }
  emitHost(envelope: HostEnvelope): void { for (const l of this.hostListeners) l(envelope) }
  emitState(state: ConnectionState): void { for (const l of this.stateListeners) l(state) }
}

const RETRY_BASE_MS = 500
const RETRY_CAP_MS = 10_000

/**
 * DSH 内核客户端门面：一元 RPC 与事件流均经主进程 kernel-proxy
 *（渲染层 HTTP 有 CORS/WS 有 Origin，双双被内核信任围栏拦截——curl 实测 §2.1）。
 * 断线指数退避 500ms×2→10s；恢复（重拉 session.history）属 store 职责（见 onState）。
 */
export class DshClient {
  private readonly bus = new Bus()
  private retryAttempt = 0
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private wanted = false
  private openedKinds = new Set<DshStreamKind>()
  private state: ConnectionState = 'idle'
  private unsubscribe: (() => void) | null = null

  constructor(private readonly carrier: UnaryCarrier & StreamCarrier = mainProxyCarrier) {}

  readonly onMux = (listener: Listener<MuxEnvelope>): (() => void) => this.bus.onMux(listener)
  readonly onHost = (listener: Listener<HostEnvelope>): (() => void) => this.bus.onHost(listener)
  readonly onState = (listener: Listener<ConnectionState>): (() => void) => this.bus.onState(listener)

  getState(): ConnectionState { return this.state }

  private setState(state: ConnectionState): void {
    if (this.state === state) return
    this.state = state
    this.bus.emitState(state)
  }

  /** 连接内核事件流（幂等；baseHttpUrl 仅作连接语义标识，实际载体是主进程代理）。 */
  connect(_baseHttpUrl: string): void {
    this.wanted = true
    this.retryAttempt = 0
    this.unsubscribe ??= this.carrier.onEvent((event) => this.handleStreamEvent(event))
    this.setState('connecting')
    this.openBoth()
  }

  close(): void {
    this.wanted = false
    if (this.retryTimer !== null) { clearTimeout(this.retryTimer); this.retryTimer = null }
    this.openedKinds.clear()
    void this.carrier.close('mux')
    void this.carrier.close('host')
    this.setState('closed')
  }

  private openBoth(): void {
    if (!this.wanted) return
    void this.carrier.open('mux').catch(() => this.scheduleRetry())
    void this.carrier.open('host').catch(() => this.scheduleRetry())
  }

  private handleStreamEvent(event: DshStreamEvent): void {
    switch (event.type) {
      case 'open': {
        this.openedKinds.add(event.kind)
        if (this.openedKinds.size === 2) {
          this.retryAttempt = 0
          this.setState('ready')
        }
        break
      }
      case 'frame': {
        if (event.kind === 'mux') {
          const frame = parseMuxFrame(event.payload)
          if (frame) this.bus.emitMux({ rpcId: event.rpcId, frame })
        } else {
          const frame = parseHostFrame(event.payload)
          if (frame) this.bus.emitHost({ rpcId: event.rpcId, frame })
        }
        break
      }
      case 'closed': {
        this.openedKinds.delete(event.kind)
        if (this.wanted) {
          void this.carrier.close(event.kind === 'mux' ? 'host' : 'mux')
          this.openedKinds.clear()
          this.scheduleRetry()
        }
        break
      }
    }
  }

  private scheduleRetry(): void {
    if (!this.wanted || this.retryTimer !== null) return
    const delay = Math.min(RETRY_BASE_MS * 2 ** this.retryAttempt, RETRY_CAP_MS)
    this.retryAttempt += 1
    this.setState('reconnecting')
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      this.openBoth()
    }, delay)
  }

  // ---- 一元 RPC（载体代理；业务错误折叠为 DshRpcError） ----

  async rpc<T = unknown>(method: string, payload: unknown): Promise<T> {
    const response = await this.carrier.rpc(method, payload)
    return fold<T>(response.result)
  }

  /** 需要 rpcId 回声（乐观回显对账）的调用走这里。 */
  async rpcWithId<T = unknown>(method: string, payload: unknown): Promise<{ rpcId: RpcId; value: T }> {
    const response = await this.carrier.rpc(method, payload)
    return { rpcId: response.rpcId, value: fold<T>(response.result) }
  }

  hostDescribe(): Promise<HostDescription> { return this.rpc('host.describe', {}) }
  /** 会话清单（投影信封解包为平铺键值：title/sessionStats/permissions…）。 */
  async sessionList(): Promise<{ items: SessionSummary[] }> {
    const raw = await this.rpc<{ items: (Omit<SessionSummary, 'projections'> & { projections?: ProjectionsEnvelope })[] }>('session.list', {})
    return { items: raw.items.map((item) => ({ ...item, projections: unwrapProjections(item.projections) })) }
  }
  sessionCreate(payload: { workspaceId?: string; cwd?: string; sessionId?: string; agentPreset?: string } = {}): Promise<{ sessionId: string; agentPreset?: string }> {
    return this.rpc('session.create', payload)
  }
  /** 历史尾页（投影信封解包为平铺键值，作为切片投影基线）。 */
  async sessionHistory(payload: { sessionId: string; beforeSeq?: number; maxMessages?: number }): Promise<{ events: HistoryEntry[]; hasMore: boolean; projections?: Record<string, unknown> }> {
    const raw = await this.rpc<{ events: HistoryEntry[]; hasMore: boolean; projections?: ProjectionsEnvelope }>('session.history', payload)
    return { events: raw.events, hasMore: raw.hasMore, projections: unwrapProjections(raw.projections) }
  }
  sessionPrompt(payload: { sessionId: string; mode: 'queue' | 'steer'; content: PromptContentPart[]; clientTimeZone?: string }): Promise<{ rpcId: RpcId; value: { accepted: true; command?: { kind: 'success'; text?: string } } }> {
    return this.rpcWithId('session.prompt', payload)
  }
  sessionCancel(sessionId: string): Promise<{ accepted: true }> { return this.rpc('session.cancel', { sessionId }) }
  /** 重命名会话（标题走 title 投影回流）。 */
  sessionRename(sessionId: string, title: string): Promise<{ title: string; seq: number }> {
    return this.rpc('session.rename', { sessionId, title })
  }
  /** 存档会话（从列表隐藏；v1 内核无 unarchive RPC）。 */
  archiveSession(sessionId: string): Promise<{ archivedSessionIds: string[] }> {
    return this.rpc('workspace.archiveSession', { sessionId })
  }
  sessionModels(sessionId: string): Promise<unknown> { return this.rpc('session.models', { sessionId }) }
  sessionSelectModel(payload: { sessionId: string; provider: string; model: string; reasoningEffort?: string }): Promise<unknown> {
    return this.rpc('session.selectModel', payload)
  }

  /** 会话附件（图片等，base64）。 */
  sessionAttachment(sessionId: string, attachmentId: string): Promise<{ attachment: unknown; data: string }> {
    return this.rpc('session.attachment', { sessionId, attachmentId })
  }

  /** 斜杠命令清单（Typert：payload={args:{agentId}}，curl 实测）。 */
  commandsList(sessionId: string): Promise<{ name: string; description?: string; input?: { hint?: string; images?: boolean } }[]> {
    return this.rpc('commands/list', { args: { agentId: sessionId } })
  }

  /**
   * 斜杠命令执行（Typert：payload={args:{agentId,line,images}}）。
   * 对齐 dsh web 提交路径：命中即在内核执行（不进模型）；语法/名称未解析返回 undefined/null，
   * 调用方据此回退为普通 session.prompt 消息。session.prompt 自身不拦截斜杠命令（apiproxy 实测）。
   */
  commandsExecute(
    sessionId: string,
    line: string,
    images: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string; name?: string }[] = [],
  ): Promise<{ commandId: string; result: { kind: 'success'; text?: string; sourceEventSeq?: number } | { kind: 'error'; text: string } } | undefined | null> {
    return this.rpc('commands/execute', { args: { agentId: sessionId, line, images } })
  }

  // ---- 设置面板三域（模型/智能体/权限，均 loopback 可用） ----

  llmProviders(): Promise<{ providers: { provider: string; displayName: string; active: boolean; declared?: boolean; settingsNs?: string }[] }> {
    return this.rpc('llm.providers', {})
  }
  llmModels(): Promise<{ groups: { id: string; name: string; models: { id: string; name: string; reasoning?: { efforts: { id: string; name: string }[]; defaultEffort?: string } }[] }[] }> {
    return this.rpc('llm.models', {})
  }
  credentialsDescribe(refs: string[]): Promise<{ credentials: Record<string, { configured: boolean; source?: string; writable: boolean }> }> {
    return this.rpc('credentials.describe', { refs })
  }
  credentialsSet(ref: string, value: string): Promise<unknown> { return this.rpc('credentials.set', { ref, value }) }
  credentialsUnset(ref: string): Promise<unknown> { return this.rpc('credentials.unset', { ref }) }
  agentPresetList(): Promise<{ presets: { id: string; trust: string; isDefault: boolean; name: string; description?: string }[] }> {
    return this.rpc('agentPreset.list', {})
  }
  agentPresetSelect(sessionId: string, agentPreset: string): Promise<unknown> {
    return this.rpc('agentPreset.select', { sessionId, agentPreset })
  }
  agentPresetCopy(agentPreset: string): Promise<unknown> { return this.rpc('agentPreset.copy', { agentPreset }) }
  agentPresetRemove(agentPreset: string): Promise<unknown> { return this.rpc('agentPreset.remove', { agentPreset }) }

  /** settings 用户层合并写（loopback-only；patch 深合并进 providers 等映射）。 */
  settingsUpdate(ns: string, patch: Record<string, unknown>): Promise<unknown> {
    return this.rpc('settings.update', { ns, patch })
  }
  /** settings 路径级编辑（unset 删除供应商等子键）。 */
  settingsMutate(ns: string, ops: ({ op: 'set'; path: string[]; value: unknown } | { op: 'unset'; path: string[] })[]): Promise<unknown> {
    return this.rpc('settings.mutate', { ns, ops })
  }
  /** settings 描述（命名空间清单 + redacted 分层值）。 */
  settingsDescribe(): Promise<{ writable: boolean; namespaces: { ns: string; value?: unknown; user?: unknown }[] }> {
    return this.rpc('settings.describe', {})
  }

  /** 审批应答：rpcId 来自 approval/requested 帧（稳定、重连重放 → 应答天然幂等）。 */
  async answerApproval(rpcId: RpcId, answer: ApprovalResponsePayload): Promise<void> {
    const receipt = await this.carrier.respond(rpcId, { ok: true, value: answer })
    if (!receipt.accepted) throw new Error(`approval response rejected: ${receipt.reason}`)
  }

  /** 提问应答（questions.ts QuestionResponsePayload：一次 ask 整批作答）。 */
  async answerQuestionRaw(
    rpcId: RpcId,
    payload: { sessionId: string; answer: { answers: { id: string; selected: string[]; custom?: string }[] } },
  ): Promise<RpcReceipt> {
    return this.carrier.respond(rpcId, { ok: true, value: payload })
  }
}
