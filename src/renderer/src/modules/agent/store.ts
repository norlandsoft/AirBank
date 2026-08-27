import { create } from 'zustand'
import { DshClient, DshRpcError, type ConnectionState } from '../../dsh-client/client'
import { applyHistory, applyMuxFrame } from './fold'
import { emptySlice, type SessionSlice } from './model'
import type { HostDescription, PromptContentPart, SessionSummary } from '../../../../shared/dsh/wire'

const HISTORY_PAGE = 50

/** 跨会话的模型目录（session.models 的宽松视图）。 */
export interface SessionModelsView {
  current: { provider: string; model: string; reasoningEffort?: string } | null
  routable: { provider: string; model: string; reasoningEffort?: string }[]
  groups?: unknown
  failures?: unknown
}

interface AgentState {
  client: DshClient
  connection: ConnectionState
  hostInfo: HostDescription | null
  sessions: SessionSummary[]
  activeSessionId: SessionSummary['sessionId'] | null
  slices: Record<string, SessionSlice>
  models: SessionModelsView | null
  sending: boolean
  error: string | null

  connect(baseUrl: string): void
  disconnect(): void
  refreshSessions(): Promise<void>
  openSession(sessionId: string): Promise<void>
  createSession(): Promise<void>
  loadOlder(): Promise<void>
  send(text: string, images?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string; name?: string }[]): Promise<void>
  cancelActive(): Promise<void>
  answerApproval(approvalId: string, outcome: 'allowed-once' | 'rejected'): Promise<void>
  answerQuestion(answers: { id: string; selected: string[]; custom?: string }[]): Promise<void>
  selectModel(provider: string, model: string, reasoningEffort?: string): Promise<void>
}

/** 全局单例（一个渲染进程一条内核连接）。 */
const client = new DshClient()

export const useAgent = create<AgentState>((set, get) => {
  let wired = false

  const sliceOf = (sessionId: string): SessionSlice => get().slices[sessionId] ?? emptySlice(sessionId)
  const patchSlice = (sessionId: string, updater: (slice: SessionSlice) => SessionSlice): void => {
    set((state) => ({ slices: { ...state.slices, [sessionId]: updater(state.slices[sessionId] ?? emptySlice(sessionId)) } }))
  }

  const wire = (): void => {
    if (wired) return
    wired = true
    client.onState((connection) => set({ connection }))
    client.onMux(({ rpcId, frame }) => {
      if ('sessionId' in frame) patchSlice(frame.sessionId, (slice) => applyMuxFrame(slice, rpcId, frame))
    })
    client.onHost(({ frame }) => {
      switch (frame.type) {
        case 'host/session-added':
        case 'host/session-removed':
          void get().refreshSessions()
          break
        case 'host/session-status':
          set((state) => ({
            sessions: state.sessions.map((s) => s.sessionId === frame.sessionId ? { ...s, running: frame.running } : s),
          }))
          break
        default:
          break
      }
    })
  }

  const reportError = (error: unknown): void => {
    const message = error instanceof DshRpcError ? `${error.code}: ${error.message}`
      : error instanceof Error ? error.message : String(error)
    set({ error: message })
  }

  return {
    client,
    connection: 'idle',
    hostInfo: null,
    sessions: [],
    activeSessionId: null,
    slices: {},
    models: null,
    sending: false,
    error: null,

    connect(baseUrl) {
      wire()
      client.connect(baseUrl)
      void (async () => {
        try {
          const [hostInfo, sessions] = await Promise.all([client.hostDescribe(), client.sessionList()])
          set({ hostInfo, sessions: sessions.items })
        } catch (error) { reportError(error) }
      })()
    },

    disconnect() {
      client.close()
      set({ connection: 'closed', sessions: [], activeSessionId: null, slices: {}, models: null, hostInfo: null })
    },

    async refreshSessions() {
      try {
        const list = await client.sessionList()
        set({ sessions: list.items })
      } catch (error) { reportError(error) }
    },

    async openSession(sessionId) {
      set({ activeSessionId: sessionId, error: null })
      const existing = get().slices[sessionId]
      try {
        if (!existing || (existing.items.length === 0 && !existing.running)) {
          const history = await client.sessionHistory({ sessionId, maxMessages: HISTORY_PAGE })
          patchSlice(sessionId, (slice) => applyHistory(slice, history.events, history.hasMore, history.projections, 'replace'))
        }
        const models = await client.sessionModels(sessionId).catch(() => null)
        set({ models: models as SessionModelsView | null })
      } catch (error) { reportError(error) }
    },

    async createSession() {
      try {
        const created = await client.sessionCreate({})
        await get().refreshSessions()
        await get().openSession(created.sessionId)
      } catch (error) { reportError(error) }
    },

    async loadOlder() {
      const { activeSessionId } = get()
      if (!activeSessionId) return
      const slice = sliceOf(activeSessionId)
      if (!slice.hasMoreHistory || slice.items.length === 0) return
      const beforeSeq = Math.min(...slice.items.map((item) => item.seq))
      try {
        const history = await client.sessionHistory({ sessionId: activeSessionId, beforeSeq, maxMessages: HISTORY_PAGE })
        patchSlice(activeSessionId, (s) => applyHistory(s, history.events, history.hasMore, undefined, 'prepend'))
      } catch (error) { reportError(error) }
    },

    async send(text, images: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string; name?: string }[] = []) {
      const { activeSessionId } = get()
      const trimmed = text.trim()
      if (!activeSessionId || (trimmed.length === 0 && images.length === 0) || get().sending) return
      set({ sending: true, error: null })
      try {
        const content: PromptContentPart[] = []
        if (trimmed.length > 0) content.push({ type: 'text', text: trimmed })
        for (const image of images) content.push({ type: 'image', mediaType: image.mediaType, data: image.data, name: image.name })
        await client.sessionPrompt({
          sessionId: activeSessionId,
          mode: 'queue',
          content,
          clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        })
        // 无乐观回显：回环下 user/message 毫秒级到达；排队态由 session/queue 帧呈现
      } catch (error) {
        reportError(error)
      } finally {
        set({ sending: false })
      }
    },

    async cancelActive() {
      const { activeSessionId } = get()
      if (!activeSessionId) return
      try {
        await client.sessionCancel(activeSessionId)
      } catch (error) { reportError(error) }
    },

    async answerApproval(approvalId, outcome) {
      const { activeSessionId } = get()
      if (!activeSessionId) return
      const pending = sliceOf(activeSessionId).pendingApprovals.get(approvalId)
      if (!pending) return
      try {
        await client.answerApproval(pending.rpcId, { sessionId: activeSessionId, approvalId, outcome })
      } catch (error) { reportError(error) }
    },

    async answerQuestion(answers) {
      const { activeSessionId } = get()
      if (!activeSessionId) return
      const pending = sliceOf(activeSessionId).pendingQuestion
      if (!pending) return
      try {
        const receipt = await client.answerQuestionRaw(pending.rpcId, { sessionId: activeSessionId, answer: { answers } })
        if (!receipt.accepted) throw new Error(`question response rejected: ${receipt.reason}`)
      } catch (error) { reportError(error) }
    },

    async selectModel(provider, model, reasoningEffort) {
      const { activeSessionId } = get()
      if (!activeSessionId) return
      try {
        await client.sessionSelectModel({ sessionId: activeSessionId, provider, model, reasoningEffort })
        const models = await client.sessionModels(activeSessionId).catch(() => null)
        set({ models: models as SessionModelsView | null })
      } catch (error) { reportError(error) }
    },
  }
})
