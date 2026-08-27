/**
 * M0 协议验证（设计文档 §8）：不经 UI，直连真实内核跑通八步全链路。
 *
 * 用法：
 *   pnpm verify:protocol                       # 只读步骤（1,2,3,4,7 + 重连健全性）
 *   DSH_VERIFY_LLM=1 pnpm verify:protocol      # 追加 LLM 步骤（5 流式、6 审批、8 中断/重连）
 *   DSH_API_URL=http://127.0.0.1:3080          # 目标内核（默认 3080）
 *
 * 注意：LLM 步骤会在目标档案新建一个会话并消耗少量模型额度；审批步骤是否触发
 * 取决于该档案的权限预设（可能 SKIP，属正常）。
 */
import {
  apiPath, HOST_EVENTS_PATH, makeClientRequest, MUX_EVENTS_PATH, parseHostFrame, parseMuxFrame,
  parseServerRequest, parseServerResponse, RESPOND_PATH,
  type HostFrame, type MuxFrame, type PromptContentPart,
} from '../src/shared/dsh/wire'

const BASE = (process.env.DSH_API_URL ?? 'http://127.0.0.1:3080').replace(/\/$/, '')
const LLM = process.env.DSH_VERIFY_LLM === '1'

let failures = 0
const ok = (msg: string): void => console.log(`  ✅ ${msg}`)
const fail = (msg: string): void => { failures += 1; console.error(`  ❌ ${msg}`) }
const skip = (msg: string): void => console.log(`  ⏭  ${msg}`)
const info = (msg: string): void => console.log(`  · ${msg}`)
const step = (title: string): void => console.log(`\n${title}`)

async function rpc<T = unknown>(method: string, payload: unknown): Promise<T> {
  const request = makeClientRequest(method, payload)
  const response = await fetch(`${BASE}${apiPath(method)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`${method}: HTTP ${response.status}`)
  const full = parseServerResponse(await response.json())
  if (!full) throw new Error(`${method}: malformed server-response`)
  if (full.rpcId !== request.rpcId) throw new Error(`${method}: rpcId mismatch`)
  if (!full.result.ok) throw new Error(`${method}: ${full.result.error.code}: ${full.result.error.message}`)
  return full.result.value as T
}

interface StreamHandle {
  close(): void
}

/** 开一条只下行 WS（Node 无 Origin 头——Chromium 下的 Origin 判定需在 Electron 里实测，见步骤 2 备注）。 */
function openStream<F extends MuxFrame | HostFrame>(
  path: string,
  parse: (v: unknown) => F | null,
  onFrame: (rpcId: string, frame: F) => void,
): { opened: Promise<void>; handle: StreamHandle } {
  const wsBase = BASE.replace(/^http/, 'ws')
  const socket = new WebSocket(`${wsBase}${path}`)
  let resolveOpen!: () => void
  let rejectOpen!: (e: Error) => void
  const opened = new Promise<void>((resolve, reject) => { resolveOpen = resolve; rejectOpen = reject })
  socket.addEventListener('open', () => resolveOpen())
  socket.addEventListener('error', () => rejectOpen(new Error(`${path}: socket error`)), { once: true })
  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string') return
    try {
      const full = parseServerRequest(JSON.parse(event.data))
      if (!full) return
      const frame = parse(full.payload)
      if (frame) onFrame(full.rpcId, frame)
    } catch { /* 畸形帧丢弃 */ }
  })
  return { opened, handle: { close: () => socket.close() } }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 等待谓词满足或超时；返回是否等到。 */
async function waitFor(predicate: () => boolean, timeoutMs: number, intervalMs = 100): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return true
    await sleep(intervalMs)
  }
  return predicate()
}

// ---- mux 帧收集器（每会话一份） ----
interface SessionTap {
  events: string[]
  chunks: string[]
  turnEnded: boolean
  userMessageSeen: boolean
  pendingApprovals: { rpcId: string; approvalId: string; toolName: string }[]
  resolvedApprovals: string[]
  subscribed: boolean
}

function makeTap(): SessionTap {
  return { events: [], chunks: [], turnEnded: false, userMessageSeen: false, pendingApprovals: [], resolvedApprovals: [], subscribed: false }
}

function tapFrame(tap: SessionTap, rpcId: string, frame: MuxFrame): void {
  switch (frame.type) {
    case 'session/subscribed':
      tap.subscribed = true
      break
    case 'session/event':
      tap.events.push(frame.event.type)
      if (frame.event.type === 'assistant/chunk') {
        const chunk = (frame.event.data as { chunk?: { type?: string } }).chunk
        if (chunk?.type) tap.chunks.push(chunk.type)
      }
      if (frame.event.type === 'turn/end') tap.turnEnded = true
      if (frame.event.type === 'user/message') tap.userMessageSeen = true
      break
    case 'approval/requested':
      tap.pendingApprovals.push({ rpcId, approvalId: frame.approvalId, toolName: frame.toolName })
      break
    case 'approval/resolved':
      tap.resolvedApprovals.push(frame.approvalId)
      break
    default:
      break
  }
}

async function respond(rpcId: string, value: unknown): Promise<void> {
  const response = await fetch(`${BASE}${RESPOND_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-response', rpcId, result: { ok: true, value } }),
    signal: AbortSignal.timeout(30_000),
  })
  if (!response.ok) throw new Error(`respond: HTTP ${response.status}`)
}

// ---- 步骤 ----

async function main(): Promise<void> {
  console.log(`M0 协议验证 → ${BASE}（LLM 步骤：${LLM ? '开启' : '跳过，DSH_VERIFY_LLM=1 开启'}）`)

  step('① host.describe 探活')
  const desc = await rpc<{ version: string; cwd: string; provider?: string; model?: string; home: string }>('host.describe', {})
  ok(`version=${desc.version} cwd=${desc.cwd} provider=${desc.provider ?? '-'} model=${desc.model ?? '-'}`)

  step('② 开 mux/host 双 WebSocket')
  const taps = new Map<string, SessionTap>()
  const tapOf = (sessionId: string): SessionTap => {
    let tap = taps.get(sessionId)
    if (!tap) { tap = makeTap(); taps.set(sessionId, tap) }
    return tap
  }
  const mux = openStream(MUX_EVENTS_PATH, parseMuxFrame, (rpcId, frame) => {
    if ('sessionId' in frame) tapFrame(tapOf(frame.sessionId), rpcId, frame)
  })
  const host = openStream(HOST_EVENTS_PATH, parseHostFrame, () => undefined)
  await Promise.all([mux.opened, host.opened])
  ok('双流已建立（Node 无 Origin 头；Chromium Origin 判定待 Electron 内实测）')
  await sleep(800)
  info(`已附着会话 subscribed 数量：${taps.size}`)

  step('③ session.list')
  const list = await rpc<{ items: { sessionId: string; blank: boolean; running: boolean }[] }>('session.list', {})
  ok(`共 ${list.items.length} 个会话`)

  step('④ session.create → session.history（空会话）')
  const created = await rpc<{ sessionId: string }>('session.create', {})
  info(`新建会话 ${created.sessionId}`)
  const emptyHistory = await rpc<{ events: unknown[]; hasMore: boolean }>('session.history', { sessionId: created.sessionId })
  if (emptyHistory.events.length === 0) ok('空会话 history 为空，信封/分页字段正常')
  else { info(`新会话已带 ${emptyHistory.events.length} 条事件（非空白，正常）`) }

  const promptText = process.env.DSH_VERIFY_PROMPT ?? '用一句话介绍你自己。'

  if (LLM) {
    step('⑤ session.prompt → 流式消费至 turn/end')
    const content: PromptContentPart[] = [{ type: 'text', text: promptText }]
    const accepted = await rpc<{ accepted: true }>('session.prompt', {
      sessionId: created.sessionId, mode: 'queue', content,
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    if (!accepted.accepted) fail('prompt 未被接纳')
    const tap = tapOf(created.sessionId)
    const finished = await waitFor(() => tap.turnEnded, 180_000)
    if (!finished) fail('180s 内未等到 turn/end')
    else {
      if (tap.userMessageSeen) ok('user/message 回显到达')
      else fail('缺 user/message 事件')
      if (tap.chunks.length > 0) ok(`StreamChunk 流动：${[...new Set(tap.chunks)].join(', ')}`)
      else fail('未见 assistant/chunk')
      info(`事件序列：${[...new Set(tap.events)].join(' → ')}`)
    }

    step('⑥ 审批链路（依赖权限预设，可能 SKIP）')
    const approvalTap = makeTap()
    taps.set(created.sessionId, approvalTap)
    await rpc('session.prompt', {
      sessionId: created.sessionId, mode: 'queue',
      content: [{ type: 'text', text: '请使用 shell 工具运行命令：echo aircode-verify-approval。不要做任何其他事。' }],
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    const gotApproval = await waitFor(() => approvalTap.pendingApprovals.length > 0 || approvalTap.turnEnded, 120_000)
    if (approvalTap.pendingApprovals.length > 0) {
      const pending = approvalTap.pendingApprovals[0]
      info(`approval/requested：tool=${pending.toolName}（rpcId 稳定可应答）`)
      await respond(pending.rpcId, { sessionId: created.sessionId, approvalId: pending.approvalId, outcome: 'allowed-once' })
      const resolved = await waitFor(() => approvalTap.resolvedApprovals.includes(pending.approvalId), 30_000)
      if (resolved) ok('/api/respond 应答 → approval/resolved 收敛')
      else fail('应答后未见 approval/resolved')
      await waitFor(() => approvalTap.turnEnded, 120_000)
    } else if (gotApproval) {
      skip('本轮未触发审批（权限预设已自动放行），审批链路未实测')
    } else {
      skip('120s 内既无审批也无 turn/end，审批链路未实测')
    }

    step('⑦ session.models')
    const models = await rpc<{ current: unknown; routable: unknown[] }>('session.models', { sessionId: created.sessionId })
    ok(`current=${JSON.stringify(models.current)} routable=${Array.isArray(models.routable) ? models.routable.length : '?'} 个`)

    step('⑧ session.cancel + 断线重连重拉 history')
    const cancelTap = makeTap()
    taps.set(created.sessionId, cancelTap)
    await rpc('session.prompt', {
      sessionId: created.sessionId, mode: 'queue',
      content: [{ type: 'text', text: '请从 1 数到 50，每个数字单独一行，不要快。' }],
      clientTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
    await waitFor(() => cancelTap.chunks.length > 0, 60_000)
    const cancelResult = await rpc<{ accepted: true }>('session.cancel', { sessionId: created.sessionId })
    if (cancelResult.accepted) ok('cancel 被接纳')
    else fail('cancel 未接纳')
    await waitFor(() => cancelTap.turnEnded, 30_000)
    mux.handle.close(); host.handle.close()
    await sleep(500)
    const mux2 = openStream(MUX_EVENTS_PATH, parseMuxFrame, () => undefined)
    const host2 = openStream(HOST_EVENTS_PATH, parseHostFrame, () => undefined)
    await Promise.all([mux2.opened, host2.opened])
    const full = await rpc<{ events: unknown[] }>('session.history', { sessionId: created.sessionId })
    if (full.events.length > 0) ok(`重连成功，重拉 history 得 ${full.events.length} 条事件`)
    else fail('重连后 history 为空')
    mux2.handle.close(); host2.handle.close()
  } else {
    step('⑤–⑧（LLM 依赖）')
    skip('流式/审批/中断未跑；DSH_VERIFY_LLM=1 pnpm verify:protocol 开启')
    step('⑦ session.models（只读，仍执行）')
    const models = await rpc<{ current: unknown }>('session.models', { sessionId: created.sessionId })
    ok(`current=${JSON.stringify(models.current)}`)
    step('⑧ 断线重连健全性')
    mux.handle.close(); host.handle.close()
    await sleep(500)
    const mux2 = openStream(MUX_EVENTS_PATH, parseMuxFrame, () => undefined)
    await mux2.opened
    ok('重开 mux 流成功')
    mux2.handle.close()
  }

  console.log(failures === 0 ? '\n[verify] PASS' : `\n[verify] FAIL（${failures} 处）`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error: unknown) => {
  console.error('\n[verify] FATAL:', error instanceof Error ? error.message : error)
  process.exit(1)
})
