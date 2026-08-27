import { describe, expect, it } from 'vitest'
import {
  applyHistory, applyMuxFrame, applySessionEvent, foldChunk, isVisibleAssistantChunk, toAssistantBlocks,
} from '../src/renderer/src/modules/agent/fold'
import { emptySlice, type AssistantBlock, type StreamChunk } from '../src/renderer/src/modules/agent/model'
import type { SessionEventEnvelope } from '../src/shared/dsh/wire'

const ev = (type: string, data: unknown, seq = 1, time = 1000): SessionEventEnvelope => ({ type, seq, time, data })

describe('foldChunk（对齐官方 PartialAccumulator）', () => {
  it('text-delta 按 index 累加', () => {
    let blocks: AssistantBlock[] = []
    blocks = foldChunk(blocks, { type: 'block-start', index: 0, blockType: 'text' })
    blocks = foldChunk(blocks, { type: 'text-delta', index: 0, text: '你好' })
    blocks = foldChunk(blocks, { type: 'text-delta', index: 0, text: '世界' })
    expect(blocks).toEqual([{ kind: 'text', text: '你好世界' }])
  })
  it('reasoning 与 text 分块', () => {
    let blocks: AssistantBlock[] = []
    blocks = foldChunk(blocks, { type: 'block-start', index: 0, blockType: 'reasoning' })
    blocks = foldChunk(blocks, { type: 'reasoning-delta', index: 0, text: '想' })
    blocks = foldChunk(blocks, { type: 'block-start', index: 1, blockType: 'text' })
    blocks = foldChunk(blocks, { type: 'text-delta', index: 1, text: '答' })
    expect(blocks).toEqual([{ kind: 'reasoning', text: '想' }, { kind: 'text', text: '答' }])
  })
  it('tool-call-delta 累积参数', () => {
    let blocks: AssistantBlock[] = []
    blocks = foldChunk(blocks, { type: 'tool-call-delta', index: 0, id: 'c1', name: 'bash', argumentsDelta: '{"cmd":' })
    blocks = foldChunk(blocks, { type: 'tool-call-delta', index: 0, id: 'c1', argumentsDelta: '"ls"}' })
    expect(blocks).toEqual([{ kind: 'tool-call', callId: 'c1', name: 'bash', argsRaw: '{"cmd":"ls"}' }])
  })
  it('block-end 用权威块替换', () => {
    let blocks: AssistantBlock[] = []
    blocks = foldChunk(blocks, { type: 'text-delta', index: 0, text: 'x' })
    blocks = foldChunk(blocks, { type: 'block-end', index: 0, block: { type: 'text', text: 'xyz' } })
    expect(blocks).toEqual([{ kind: 'text', text: 'xyz' }])
  })
  it('usage/finish 不可见', () => {
    expect(isVisibleAssistantChunk('usage')).toBe(false)
    expect(isVisibleAssistantChunk('finish')).toBe(false)
    expect(isVisibleAssistantChunk('text-delta')).toBe(true)
    const blocks: AssistantBlock[] = [{ kind: 'text', text: 'a' }]
    expect(foldChunk(blocks, { type: 'usage', usage: {} })).toBe(blocks)
  })
})

describe('toAssistantBlocks', () => {
  it('分类核心块', () => {
    expect(toAssistantBlocks([
      { type: 'text', text: 't' },
      { type: 'reasoning', text: 'r' },
      { type: 'tool-call', id: 'c', name: 'bash', arguments: '{}' },
      { type: 'unknown-x', foo: 1 },
    ])).toEqual([
      { kind: 'text', text: 't' },
      { kind: 'reasoning', text: 'r' },
      { kind: 'tool-call', callId: 'c', name: 'bash', argsRaw: '{}' },
      { kind: 'other', block: { type: 'unknown-x', foo: 1 } },
    ])
  })
})

describe('applySessionEvent', () => {
  it('turn 生命周期驱动 running 与 partial 清理', () => {
    let s = emptySlice('s1')
    s = applySessionEvent(s, ev('turn/start', { turn: 1 }))
    expect(s.running).toBe(true)
    s = applySessionEvent(s, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'hi' } satisfies StreamChunk }, 2))
    expect(s.partial?.blocks).toEqual([{ kind: 'text', text: 'hi' }])
    s = applySessionEvent(s, ev('turn/end', { turn: 1, reason: { kind: 'stop' } }, 3))
    expect(s.running).toBe(false)
    expect(s.partial).toBeNull()
  })

  it('user/message 按 id 去重', () => {
    let s = emptySlice('s1')
    const data = { id: 'm1', content: [{ type: 'text', text: 'q' }], source: { kind: 'human' } }
    s = applySessionEvent(s, ev('user/message', data, 1))
    s = applySessionEvent(s, ev('user/message', data, 2))
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({ kind: 'user', id: 'user:m1' })
  })

  it('assistant/message 定稿并清同名 partial', () => {
    let s = emptySlice('s1')
    s = applySessionEvent(s, ev('assistant/chunk', { turn: 1, step: 1, chunk: { type: 'text-delta', index: 0, text: 'part' } }, 1))
    s = applySessionEvent(s, ev('assistant/message', { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'full' }] } }, 2))
    expect(s.partial).toBeNull()
    expect(s.items[0]).toMatchObject({ kind: 'assistant', id: 'assistant:1:1', blocks: [{ kind: 'text', text: 'full' }] })
  })

  it('tool/call 与 tool/result 经 callId 配对（ToolResultBlock.toolCallId）', () => {
    let s = emptySlice('s1')
    s = applySessionEvent(s, ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{"cmd":"ls"}' }, 1))
    s = applySessionEvent(s, ev('tool/result', {
      turn: 1, step: 1,
      message: { content: [{ type: 'tool-result', toolCallId: 'c1', content: [{ type: 'text', text: 'ok' }] }] },
    }, 2))
    expect(s.items).toHaveLength(1)
    expect(s.items[0]).toMatchObject({
      kind: 'tool', callId: 'c1', name: 'bash', argumentsRaw: '{"cmd":"ls"}',
      result: { content: [{ type: 'text', text: 'ok' }] },
    })
  })
})

describe('applyMuxFrame', () => {
  it('approval/requested 幂等（重连重放）+ resolved 收敛', () => {
    let s = emptySlice('s1')
    const frame = { type: 'approval/requested', sessionId: 's1', approvalId: 'a1', toolName: 'bash' } as const
    s = applyMuxFrame(s, 'rpc-1', frame)
    s = applyMuxFrame(s, 'rpc-1', frame)
    expect(s.pendingApprovals.size).toBe(1)
    expect(s.pendingApprovals.get('a1')?.rpcId).toBe('rpc-1')
    s = applyMuxFrame(s, 'rpc-x', { type: 'approval/resolved', sessionId: 's1', approvalId: 'a1', outcome: 'allowed-once' })
    expect(s.pendingApprovals.size).toBe(0)
  })

  it('projection high-seq-wins', () => {
    let s = emptySlice('s1')
    s = applyMuxFrame(s, 'r', { type: 'session/projection', sessionId: 's1', key: 'title', value: '新', seq: 5 })
    s = applyMuxFrame(s, 'r', { type: 'session/projection', sessionId: 's1', key: 'title', value: '旧', seq: 3 })
    expect(s.projections.get('title')?.value).toBe('新')
    s = applyMuxFrame(s, 'r', { type: 'session/projection', sessionId: 's1', key: 'title', value: '更新', seq: 9 })
    expect(s.projections.get('title')?.value).toBe('更新')
  })

  it('跨会话帧被忽略', () => {
    const s = emptySlice('s1')
    const next = applyMuxFrame(s, 'r', { type: 'session/subscribed', sessionId: 'other', lastSeq: 99 })
    expect(next).toBe(s)
  })

  it('question/requested → resolved', () => {
    let s = emptySlice('s1')
    s = applyMuxFrame(s, 'rpc-q', {
      type: 'question/requested', sessionId: 's1',
      questions: [{ id: 'q1', question: '继续吗？' }],
    })
    expect(s.pendingQuestion?.rpcId).toBe('rpc-q')
    s = applyMuxFrame(s, 'r', { type: 'question/resolved', sessionId: 's1', questionRpcId: 'rpc-q', outcome: 'answered' })
    expect(s.pendingQuestion).toBeNull()
  })
})

describe('applyHistory', () => {
  const entries = [
    { event: ev('user/message', { id: 'm1', content: [{ type: 'text', text: 'q' }], source: { kind: 'human' } }, 1) },
    { event: ev('assistant/message', { turn: 1, step: 1, message: { content: [{ type: 'text', text: 'a' }] } }, 2) },
    { event: ev('tool/call', { turn: 1, step: 1, callId: 'c1', name: 'bash', arguments: '{}' }, 3) },
  ]

  it('replace 重建时间线 + 投影基线', () => {
    const s = applyHistory(emptySlice('s1'), entries, false, { title: 'T' }, 'replace')
    expect(s.items.map((i) => i.id)).toEqual(['user:m1', 'assistant:1:1', 'tool:c1'])
    expect(s.projections.get('title')?.value).toBe('T')
    expect(s.hasMoreHistory).toBe(false)
  })

  it('prepend 旧页插头部且按 id 去重', () => {
    let s = applyHistory(emptySlice('s1'), entries, true, undefined, 'replace')
    const older = [{ event: ev('user/message', { id: 'm0', content: [], source: { kind: 'human' } }, 0, 500) }]
    s = applyHistory(s, older, false, undefined, 'prepend')
    expect(s.items.map((i) => i.id)).toEqual(['user:m0', 'user:m1', 'assistant:1:1', 'tool:c1'])
    // 重复 prepend 同页不产生重复条目
    s = applyHistory(s, older, false, undefined, 'prepend')
    expect(s.items).toHaveLength(4)
  })
})
