import { create } from 'zustand'
import { DshClient, DshRpcError, type ConnectionState } from '../../dsh-client/client'
import { bridge } from '../../bridge'
import { applyHistory, applyMuxFrame } from './fold'
import { emptySlice, type SessionSlice } from './model'
import type { HostDescription, PromptContentPart, SessionSummary } from '../../../../shared/dsh/wire'

const HISTORY_PAGE = 50

/** 跨会话的模型目录（session.models 实测结构）。 */
export interface SessionModelsView {
  current: { provider: string; model: string; reasoningEffort?: string } | null
  routable: boolean
  groups: {
    id: string
    name: string
    models: {
      id: string
      name: string
      reasoning?: { efforts: { id: string; name: string }[]; defaultEffort?: string }
    }[]
  }[]
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
  /** 全局模型目录（llm.models，起始页选择器数据源）。 */
  modelCatalog: SessionModelsView['groups']
  /** 内核默认模型（agent-default-model 设置：provider/model/effort）。 */
  defaultModel: { provider: string; model: string; reasoningEffort?: string } | null
  /** 默认权限预设（permission 设置：defaultPreset）。 */
  defaultAccess: string | null
  /** 起始页草稿：新会话的工作目录与智能体预设（发送首条消息时消费）。 */
  draftCwd: string | null
  draftPreset: string | null
  /** 起始页草稿：模型/推理等级/访问权限（创建会话后应用）。 */
  draftModel: { provider: string; model: string; effort?: string } | null
  draftAccess: string | null

  connect(baseUrl: string): void
  disconnect(): void
  refreshSessions(): Promise<void>
  openSession(sessionId: string): Promise<void>
  createSession(cwd?: string): Promise<void>
  setDraftCwd(cwd: string | null): void
  setDraftPreset(preset: string | null): void
  setDraftModel(model: { provider: string; model: string; effort?: string } | null): void
  setDraftAccess(access: string | null): void
  loadOlder(): Promise<void>
  send(text: string, images?: { mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'; data: string; name?: string }[]): Promise<void>
  cancelActive(): Promise<void>
  answerApproval(approvalId: string, outcome: 'allowed-once' | 'rejected'): Promise<void>
  answerQuestion(answers: { id: string; selected: string[]; custom?: string }[]): Promise<void>
  selectModel(provider: string, model: string, reasoningEffort?: string): Promise<void>
  renameSession(sessionId: string, title: string): Promise<void>
  archiveSession(sessionId: string): Promise<void>
  deleteSession(sessionId: string): Promise<void>
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
    modelCatalog: [],
    defaultModel: null,
    defaultAccess: null,
    draftCwd: null,
    draftPreset: null,
    draftModel: null,
    draftAccess: null,

    connect(baseUrl) {
      wire()
      client.connect(baseUrl)
      void (async () => {
        try {
          const [hostInfo, sessions] = await Promise.all([client.hostDescribe(), client.sessionList()])
          set({ hostInfo, sessions: sessions.items })
        } catch (error) { reportError(error) }
        // 起始页数据源：全局模型目录 + 默认模型/权限预设
        try {
          const catalog = await client.llmModels()
          set({ modelCatalog: catalog.groups })
        } catch { /* 目录不可用时起始页选择器隐藏 */ }
        try {
          const describe = await client.settingsDescribe()
          const modelNs = describe.namespaces.find((ns) => ns.ns === 'agent-default-model')
          const modelValue = modelNs?.value as { provider?: string; model?: string; reasoningEffort?: string } | undefined
          if (modelValue?.provider && modelValue.model) {
            set({ defaultModel: { provider: modelValue.provider, model: modelValue.model, reasoningEffort: modelValue.reasoningEffort } })
          }
          const permNs = describe.namespaces.find((ns) => ns.ns === 'permission')
          const permValue = permNs?.value as { defaultPreset?: string } | undefined
          if (permValue?.defaultPreset) set({ defaultAccess: permValue.defaultPreset })
        } catch { /* loopback-only 之外忽略 */ }
      })()
    },

    disconnect() {
      client.close()
      set({ connection: 'closed', sessions: [], activeSessionId: null, slices: {}, models: null, hostInfo: null })
    },

    setDraftCwd(cwd) { set({ draftCwd: cwd }) },
    setDraftPreset(preset) { set({ draftPreset: preset }) },
    setDraftModel(model) { set({ draftModel: model }) },
    setDraftAccess(access) { set({ draftAccess: access }) },

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

    async createSession(cwd?: string) {
      try {
        const created = await client.sessionCreate(cwd ? { cwd } : {})
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
      let { activeSessionId } = get()
      const trimmed = text.trim()
      if ((trimmed.length === 0 && images.length === 0) || get().sending) return
      set({ sending: true, error: null })
      try {
        // 起始页：无活动会话 → 按草稿（cwd/preset）创建会话再发送
        if (!activeSessionId) {
          const { draftCwd, draftPreset } = get()
          const created = await client.sessionCreate({
            ...(draftCwd ? { cwd: draftCwd } : {}),
            ...(draftPreset ? { agentPreset: draftPreset } : {}),
          })
          set({ draftCwd: null, draftPreset: null })
          await get().refreshSessions()
          await get().openSession(created.sessionId)
          activeSessionId = created.sessionId
          // 起始页草稿应用：模型/推理等级 → selectModel；访问权限 → /permission 命令
          const { draftModel, draftAccess, defaultAccess } = get()
          if (draftModel) {
            await client.sessionSelectModel({
              sessionId: activeSessionId, provider: draftModel.provider, model: draftModel.model, reasoningEffort: draftModel.effort,
            }).catch(() => undefined)
          }
          if (draftAccess && draftAccess !== defaultAccess) {
            await client.sessionPrompt({
              sessionId: activeSessionId, mode: 'queue',
              content: [{ type: 'text', text: `/permission ${draftAccess}` }],
              clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            }).catch(() => undefined)
          }
          set({ draftModel: null, draftAccess: null })
        }
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

    async renameSession(sessionId, title) {
      const trimmed = title.trim()
      if (!trimmed) return
      try {
        await client.sessionRename(sessionId, trimmed)
        // 标题经 title 投影回流；同时刷新列表兜底
        patchSlice(sessionId, (slice) => {
          const projections = new Map(slice.projections)
          projections.set('title', { value: trimmed, seq: Number.MAX_SAFE_INTEGER })
          return { ...slice, projections, version: slice.version + 1 }
        })
        await get().refreshSessions()
      } catch (error) { reportError(error) }
    },

    async archiveSession(sessionId) {
      try {
        await client.archiveSession(sessionId)
        set((state) => ({
          sessions: state.sessions.filter((s) => s.sessionId !== sessionId),
          activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
        }))
      } catch (error) { reportError(error) }
    },

    async deleteSession(sessionId) {
      try {
        await bridge.sessionAdmin.delete(sessionId)
        set((state) => {
          const slices = { ...state.slices }
          delete slices[sessionId]
          return {
            sessions: state.sessions.filter((s) => s.sessionId !== sessionId),
            activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId,
            slices,
          }
        })
        await get().refreshSessions()
      } catch (error) { reportError(error) }
    },
  }
})
