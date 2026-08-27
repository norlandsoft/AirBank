/**
 * 会话事件折叠器（纯函数，无 React/zustand 依赖，可单测）。
 * 语义对齐官方 client/runtime/sessions/{partial,conversation-assembler}.ts 的核心子集：
 * - PartialAccumulator：六种 StreamChunk 按 block index 折叠，块级不可变；
 * - 时间线：user/assistant/tool 条目按稳定 id upsert，live 与 history 重放去重；
 * - 审批/提问：rpcId 稳定、重连重放 → Map 幂等；投影 high-seq-wins。
 */
import type { HistoryEntry, MuxFrame, RpcId, SessionEventEnvelope, ToolEventView } from '../../../../shared/dsh/wire'
import type {
  AssistantBlock, LivePartial, PendingApproval, SessionSlice, StreamChunk, TimelineItem,
} from './model'

// ---- ContentBlock → AssistantBlock（对齐官方 toAssistantBlock） ----

export function toAssistantBlock(block: unknown): AssistantBlock {
  if (typeof block === 'object' && block !== null) {
    const b = block as { type?: string; text?: string; id?: string | number; name?: string; arguments?: string; attachment?: unknown }
    switch (b.type) {
      case 'text': return { kind: 'text', text: b.text ?? '' }
      case 'reasoning': return { kind: 'reasoning', text: b.text ?? '' }
      case 'image': return { kind: 'image', attachment: b.attachment }
      case 'tool-call': return { kind: 'tool-call', callId: String(b.id ?? ''), name: b.name ?? '', argsRaw: b.arguments ?? '' }
      default: break
    }
  }
  return { kind: 'other', block }
}

export function toAssistantBlocks(content: readonly unknown[]): AssistantBlock[] {
  return content.map(toAssistantBlock)
}

// ---- StreamChunk 折叠（对齐官方 PartialAccumulator） ----

/** 该 chunk 是否产生可见变更（usage/finish 不触发发布）。 */
export function isVisibleAssistantChunk(type: string): boolean {
  return type === 'block-start' || type === 'text-delta' || type === 'reasoning-delta'
    || type === 'tool-call-delta' || type === 'block-end'
}

function emptyBlock(blockType: string): AssistantBlock {
  if (blockType === 'reasoning') return { kind: 'reasoning', text: '' }
  if (blockType === 'tool-call') return { kind: 'tool-call', callId: '', name: '', argsRaw: '' }
  return { kind: 'text', text: '' }
}

/** 把一个 chunk 折叠进 blocks（块级不可变：只换该块引用）。 */
export function foldChunk(blocks: AssistantBlock[], chunk: StreamChunk): AssistantBlock[] {
  switch (chunk.type) {
    case 'block-start': {
      const next = [...blocks]
      next[chunk.index] = emptyBlock(chunk.blockType)
      return next
    }
    case 'text-delta': {
      const prev = blocks[chunk.index]
      const next = [...blocks]
      next[chunk.index] = { kind: 'text', text: (prev?.kind === 'text' ? prev.text : '') + chunk.text }
      return next
    }
    case 'reasoning-delta': {
      const prev = blocks[chunk.index]
      const next = [...blocks]
      next[chunk.index] = { kind: 'reasoning', text: (prev?.kind === 'reasoning' ? prev.text : '') + chunk.text }
      return next
    }
    case 'tool-call-delta': {
      const prev = blocks[chunk.index]
      const base = prev?.kind === 'tool-call' ? prev : { kind: 'tool-call' as const, callId: '', name: '', argsRaw: '' }
      const next = [...blocks]
      next[chunk.index] = {
        kind: 'tool-call',
        callId: base.callId || String(chunk.id),
        name: chunk.name ?? base.name,
        argsRaw: base.argsRaw + chunk.argumentsDelta,
      }
      return next
    }
    case 'block-end': {
      const next = [...blocks]
      next[chunk.index] = toAssistantBlock(chunk.block)
      return next
    }
    case 'usage':
    case 'finish':
      return blocks
  }
}

// ---- 时间线 upsert ----

function upsert(items: TimelineItem[], byId: ReadonlyMap<string, number>, item: TimelineItem): { items: TimelineItem[]; byId: Map<string, number> } {
  const index = byId.get(item.id)
  if (index !== undefined) {
    const nextItems = [...items]
    // 合并而非覆盖：后到的字段补丁式并入（tool/result 补 result，assistant/message 补 usage）
    nextItems[index] = mergeItem(nextItems[index], item)
    const nextById = new Map(byId)
    return { items: nextItems, byId: nextById }
  }
  const nextItems = [...items, item]
  const nextById = new Map(byId)
  nextById.set(item.id, nextItems.length - 1)
  return { items: nextItems, byId: nextById }
}

function mergeItem(prev: TimelineItem, next: TimelineItem): TimelineItem {
  if (prev.kind !== next.kind) return next
  if (prev.kind === 'tool' && next.kind === 'tool') {
    return {
      ...prev, ...next,
      // 结果事件不带 name/arguments：空占位不得覆盖调用事件的真值
      name: next.name || prev.name,
      argumentsRaw: next.argumentsRaw || prev.argumentsRaw,
      result: next.result ?? prev.result,
      error: next.error ?? prev.error,
      view: next.view ?? prev.view,
    }
  }
  if (prev.kind === 'assistant' && next.kind === 'assistant') {
    return { ...prev, ...next, blocks: next.blocks.length > 0 ? next.blocks : prev.blocks, usage: next.usage ?? prev.usage }
  }
  return next
}

// ---- 会话事件折叠 ----

interface UserMessageData {
  id?: string
  content?: unknown[]
  source?: Record<string, unknown>
}

export function applySessionEvent(slice: SessionSlice, event: SessionEventEnvelope, view?: ToolEventView): SessionSlice {
  const data = event.data as Record<string, unknown>
  let next = slice
  switch (event.type) {
    case 'turn/start':
      next = { ...slice, running: true }
      break
    case 'turn/end':
      next = { ...slice, running: false, partial: null }
      break
    case 'user/message': {
      const message = data as unknown as UserMessageData
      const id = `user:${message.id ?? `seq:${event.seq}`}`
      const item: TimelineItem = {
        kind: 'user', id, seq: event.seq, time: event.time,
        content: message.content ?? [], source: message.source ?? {},
      }
      const merged = upsert(slice.items, slice.byId, item)
      next = { ...slice, items: merged.items, byId: merged.byId }
      break
    }
    case 'assistant/chunk': {
      const { turn, step, chunk } = data as { turn: number; step: number; chunk: StreamChunk }
      const partial: LivePartial = slice.partial && slice.partial.turn === turn && slice.partial.step === step
        ? slice.partial
        : { turn, step, blocks: [] }
      const blocks = foldChunk(partial.blocks, chunk)
      if (!isVisibleAssistantChunk(chunk.type)) return slice.lastSeq < event.seq ? { ...slice, lastSeq: event.seq } : slice
      next = { ...slice, partial: { ...partial, blocks } }
      break
    }
    case 'assistant/message': {
      const { turn, step, message, usage, interrupted } = data as {
        turn: number; step: number; message: { content?: unknown[] }; usage?: unknown; interrupted?: true
      }
      const item: TimelineItem = {
        kind: 'assistant', id: `assistant:${turn}:${step}`, seq: event.seq, time: event.time,
        turn, step, blocks: toAssistantBlocks(message.content ?? []), interrupted: interrupted === true, usage,
      }
      const merged = upsert(slice.items, slice.byId, item)
      next = {
        ...slice, items: merged.items, byId: merged.byId,
        partial: slice.partial && slice.partial.turn === turn && slice.partial.step === step ? null : slice.partial,
      }
      break
    }
    case 'tool/call': {
      const { turn, step, callId, name, arguments: argsRaw } = data as { turn: number; step: number; callId: string; name: string; arguments: string }
      const item: TimelineItem = {
        kind: 'tool', id: `tool:${callId}`, seq: event.seq, time: event.time, turn, step,
        callId, name, argumentsRaw: argsRaw, view: view?.for === 'call' ? view : undefined,
      }
      const merged = upsert(slice.items, slice.byId, item)
      next = { ...slice, items: merged.items, byId: merged.byId }
      break
    }
    case 'tool/result': {
      // 权威结构：message.content = [ToolResultBlock{type:'tool-result', toolCallId, content, isError?}]
      const { message, error, meta } = data as {
        message?: { content?: { type?: string; toolCallId?: string | number; content?: unknown[] }[] }
        error?: { name: string; code: string }
        meta?: unknown
      }
      const block = message?.content?.[0]
      const callId = block?.toolCallId !== undefined ? String(block.toolCallId) : undefined
      if (!callId) return slice
      const item: TimelineItem = {
        kind: 'tool', id: `tool:${callId}`, seq: event.seq, time: event.time,
        turn: Number(data.turn ?? 0), step: Number(data.step ?? 0),
        callId, name: '', argumentsRaw: '',
        result: { content: block?.content ?? [], meta },
        error,
        view: view?.for === 'result' ? view : undefined,
      }
      const merged = upsert(slice.items, slice.byId, item)
      next = { ...slice, items: merged.items, byId: merged.byId }
      break
    }
    case 'todo/write': {
      const projections = new Map(slice.projections)
      projections.set('todos', { value: (data as { todos?: unknown }).todos ?? null, seq: event.seq })
      next = { ...slice, projections }
      break
    }
    default:
      // request/header、request/context、session/end-seed、session/title、permission/preset 等：
      // 不进时间线（title 走 projection 帧）
      return slice.lastSeq < event.seq ? { ...slice, lastSeq: event.seq } : slice
  }
  return { ...next, lastSeq: Math.max(next.lastSeq, event.seq), version: next.version + 1 }
}

// ---- mux 帧折叠 ----

export function applyMuxFrame(slice: SessionSlice, rpcId: RpcId, frame: MuxFrame): SessionSlice {
  if ('sessionId' in frame && frame.sessionId !== slice.sessionId) return slice
  switch (frame.type) {
    case 'session/event':
      return applySessionEvent(slice, frame.event, frame.view)
    case 'session/subscribed':
      return { ...slice, lastSeq: Math.max(slice.lastSeq, frame.lastSeq) }
    case 'approval/requested': {
      const pendingApprovals = new Map(slice.pendingApprovals)
      const approval: PendingApproval = {
        rpcId, approvalId: frame.approvalId, toolName: frame.toolName, callId: frame.callId, reason: frame.reason,
      }
      pendingApprovals.set(frame.approvalId, approval)
      return { ...slice, pendingApprovals, version: slice.version + 1 }
    }
    case 'approval/resolved': {
      if (!slice.pendingApprovals.has(frame.approvalId)) return slice
      const pendingApprovals = new Map(slice.pendingApprovals)
      pendingApprovals.delete(frame.approvalId)
      return { ...slice, pendingApprovals, version: slice.version + 1 }
    }
    case 'question/requested':
      return { ...slice, pendingQuestion: { rpcId, questions: frame.questions }, version: slice.version + 1 }
    case 'question/resolved':
      return slice.pendingQuestion ? { ...slice, pendingQuestion: null, version: slice.version + 1 } : slice
    case 'session/queue':
      return { ...slice, queue: frame.items, version: slice.version + 1 }
    case 'session/jobs':
      return { ...slice, jobs: frame.jobs, version: slice.version + 1 }
    case 'session/projection': {
      const prev = slice.projections.get(frame.key)
      if (prev && prev.seq >= frame.seq) return slice
      const projections = new Map(slice.projections)
      projections.set(frame.key, { value: frame.value, seq: frame.seq })
      return { ...slice, projections, version: slice.version + 1 }
    }
    case 'stream/error':
      return slice
    default:
      return slice
  }
}

// ---- 历史装载（尾页含投影基线；向上翻页 prepend） ----

export function applyHistory(
  slice: SessionSlice,
  entries: HistoryEntry[],
  hasMore: boolean,
  projections: Record<string, unknown> | undefined,
  mode: 'replace' | 'prepend',
): SessionSlice {
  let next = mode === 'replace'
    ? { ...slice, items: [], byId: new Map<string, number>(), partial: null }
    : slice
  if (mode === 'prepend' && entries.length > 0) {
    // 旧事件 seq 更小：独立折叠后拼到头部，按 id 去重（与 live 已装载的重叠条目）
    let older: SessionSlice = { ...next, items: [], byId: new Map<string, number>() }
    for (const entry of entries) older = foldHistoryEntry(older, entry)
    const existingIds = new Set(next.items.map((item) => item.id))
    const prefix = older.items.filter((item) => !existingIds.has(item.id))
    const items = [...prefix, ...next.items]
    const byId = new Map<string, number>()
    items.forEach((item, index) => byId.set(item.id, index))
    next = { ...next, items, byId }
  } else {
    for (const entry of entries) next = foldHistoryEntry(next, entry)
  }
  if (projections) {
    const merged = new Map(next.projections)
    for (const [key, value] of Object.entries(projections)) {
      // 尾页投影是基线：仅当本地无更新值时采用（high-seq-wins 由帧路径保证）
      if (!merged.has(key)) merged.set(key, { value, seq: 0 })
    }
    next = { ...next, projections: merged }
  }
  return { ...next, hasMoreHistory: hasMore, version: next.version + 1 }
}

function foldHistoryEntry(slice: SessionSlice, entry: HistoryEntry): SessionSlice {
  return applySessionEvent(slice, entry.event, entry.view)
}
