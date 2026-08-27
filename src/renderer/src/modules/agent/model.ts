import type {
  AskUserQuestionItem, JobView, QueuedInboxItem, RpcId, SessionId, ToolEventView,
} from '../../../../shared/dsh/wire'

/** UI 分类后的助手块（对齐官方 conversation.ts AssistantBlock）。 */
export type AssistantBlock =
  | { kind: 'text'; text: string }
  | { kind: 'reasoning'; text: string }
  | { kind: 'image'; attachment: unknown }
  | { kind: 'tool-call'; callId: string; name: string; argsRaw: string }
  | { kind: 'other'; block: unknown }

/** 流式增量（llm/types.ts StreamChunk 抄录）。 */
export type StreamChunk =
  | { type: 'block-start'; index: number; blockType: string }
  | { type: 'text-delta'; index: number; text: string }
  | { type: 'reasoning-delta'; index: number; text: string }
  | { type: 'tool-call-delta'; index: number; id: string; name?: string; argumentsDelta: string }
  | { type: 'block-end'; index: number; block: unknown }
  | { type: 'usage'; usage: unknown }
  | { type: 'finish'; reason: string; replayState?: unknown }

/** 时间线条目（id 稳定：live 与 history 重放经 id 去重）。 */
export type TimelineItem =
  | { kind: 'user'; id: string; seq: number; time: number; content: unknown[]; source: Record<string, unknown> }
  | { kind: 'assistant'; id: string; seq: number; time: number; turn: number; step: number; blocks: AssistantBlock[]; interrupted: boolean; usage?: unknown }
  | {
    kind: 'tool'; id: string; seq: number; time: number; turn: number; step: number
    callId: string; name: string; argumentsRaw: string
    result?: { content: unknown[]; meta?: unknown }
    error?: { name: string; code: string }
    view?: ToolEventView
  }
  | { kind: 'notice'; id: string; seq: number; time: number; text: string }

/** 待应答审批（rpcId 稳定，重连重放 → Map 幂等重建）。 */
export interface PendingApproval {
  rpcId: RpcId
  approvalId: string
  toolName: string
  callId?: string
  reason?: string
}

/** 待应答提问。 */
export interface PendingQuestion {
  rpcId: RpcId
  questions: AskUserQuestionItem[]
}

/** 进行中的助手步（partial），渲染时并入时间线尾部。 */
export interface LivePartial {
  turn: number
  step: number
  blocks: AssistantBlock[]
}

/** 单会话切片（纯数据；fold.ts 纯函数产出，store.ts 持有）。 */
export interface SessionSlice {
  sessionId: SessionId
  items: TimelineItem[]
  byId: ReadonlyMap<string, number>
  partial: LivePartial | null
  running: boolean
  pendingApprovals: ReadonlyMap<string, PendingApproval>
  pendingQuestion: PendingQuestion | null
  queue: QueuedInboxItem[]
  jobs: JobView[]
  /** 投影值（high-seq-wins）：title/todos/plan/permissions/sessionStats/tokenMeter… */
  projections: ReadonlyMap<string, { value: unknown; seq: number }>
  lastSeq: number
  hasMoreHistory: boolean
  /** 单调版本号：任何可见变更 +1（React memo/选择器用）。 */
  version: number
}

export function emptySlice(sessionId: SessionId): SessionSlice {
  return {
    sessionId,
    items: [],
    byId: new Map(),
    partial: null,
    running: false,
    pendingApprovals: new Map(),
    pendingQuestion: null,
    queue: [],
    jobs: [],
    projections: new Map(),
    lastSeq: 0,
    hasMoreHistory: false,
    version: 0,
  }
}
