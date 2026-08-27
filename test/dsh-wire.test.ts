import { describe, expect, it } from 'vitest'
import {
  apiPath, makeClientRequest, mintRpcId, parseHostFrame, parseMuxFrame, parseRpcReceipt,
  parseServerRequest, parseServerResponse,
} from '../src/shared/dsh/wire'

describe('makeClientRequest / mintRpcId', () => {
  it('生成四象限请求信封且 rpcId 唯一', () => {
    const a = makeClientRequest('host.describe', {})
    const b = makeClientRequest('host.describe', {})
    expect(a).toMatchObject({ type: 'client-request', method: 'host.describe', payload: {} })
    expect(typeof a.rpcId).toBe('string')
    expect(a.rpcId).not.toBe(b.rpcId)
    expect(mintRpcId()).not.toBe(mintRpcId())
  })
})

describe('parseServerResponse', () => {
  it('ok 分支', () => {
    const parsed = parseServerResponse({ type: 'server-response', rpcId: 'r1', result: { ok: true, value: { version: '1' } } })
    expect(parsed).toEqual({ type: 'server-response', rpcId: 'r1', result: { ok: true, value: { version: '1' } } })
  })
  it('error 分支（details 缺省补空对象）', () => {
    const parsed = parseServerResponse({
      type: 'server-response', rpcId: 'r1',
      result: { ok: false, error: { code: 'session-not-found', message: 'nope' } },
    })
    expect(parsed).toEqual({
      type: 'server-response', rpcId: 'r1',
      result: { ok: false, error: { code: 'session-not-found', message: 'nope', details: {} } },
    })
  })
  it('畸形输入返回 null', () => {
    for (const bad of [null, 42, 'x', {}, { type: 'server-response' }, { type: 'client-request', rpcId: 'r' },
      { type: 'server-response', rpcId: 'r', result: { ok: false, error: {} } }]) {
      expect(parseServerResponse(bad)).toBeNull()
    }
  })
})

describe('parseServerRequest', () => {
  it('合法帧', () => {
    expect(parseServerRequest({ type: 'server-request', rpcId: 'r', method: 'm', payload: { a: 1 } }))
      .toEqual({ type: 'server-request', rpcId: 'r', method: 'm', payload: { a: 1 } })
  })
  it('畸形帧返回 null', () => {
    expect(parseServerRequest({ type: 'server-request', method: 'm' })).toBeNull()
    expect(parseServerRequest({ type: 'client-request', rpcId: 'r', method: 'm' })).toBeNull()
  })
})

describe('parseMuxFrame', () => {
  it('session/subscribed', () => {
    expect(parseMuxFrame({ type: 'session/subscribed', sessionId: 's', lastSeq: 7 }))
      .toEqual({ type: 'session/subscribed', sessionId: 's', lastSeq: 7 })
  })
  it('session/event（event.data 宽松透传）', () => {
    const frame = parseMuxFrame({ type: 'session/event', sessionId: 's', event: { type: 'turn/start', seq: 1, time: 2, data: { x: 1 } } })
    expect(frame).toMatchObject({ type: 'session/event', sessionId: 's', event: { type: 'turn/start', seq: 1 } })
  })
  it('approval/requested（可选字段缺省为 undefined）', () => {
    expect(parseMuxFrame({ type: 'approval/requested', sessionId: 's', approvalId: 'a', toolName: 'bash' }))
      .toEqual({ type: 'approval/requested', sessionId: 's', approvalId: 'a', toolName: 'bash', callId: undefined, reason: undefined })
  })
  it('session/projection / stream/error', () => {
    expect(parseMuxFrame({ type: 'session/projection', sessionId: 's', key: 'title', value: 't', seq: 3 }))
      .toMatchObject({ type: 'session/projection', key: 'title', seq: 3 })
    expect(parseMuxFrame({ type: 'stream/error', error: { code: 'internal', message: 'x' } }))
      .toMatchObject({ type: 'stream/error', error: { code: 'internal' } })
  })
  it('未知 type 与畸形帧返回 null（malformed-drop）', () => {
    expect(parseMuxFrame({ type: 'session/future', sessionId: 's' })).toBeNull()
    expect(parseMuxFrame({ type: 'approval/requested', sessionId: 's' })).toBeNull()
    expect(parseMuxFrame(null)).toBeNull()
    expect(parseMuxFrame({})).toBeNull()
  })
})

describe('parseHostFrame', () => {
  it('host/session-added 全字段', () => {
    expect(parseHostFrame({ type: 'host/session-added', sessionId: 's', blank: true, cwd: '/tmp', origin: 'subagent' }))
      .toEqual({ type: 'host/session-added', sessionId: 's', blank: true, parentSessionId: undefined, origin: 'subagent', cwd: '/tmp', agentPreset: undefined })
  })
  it('host/remote-event 与未知 type', () => {
    expect(parseHostFrame({ type: 'host/remote-event', event: 'llm/adapters-updated', args: [] }))
      .toEqual({ type: 'host/remote-event', event: 'llm/adapters-updated', args: [] })
    expect(parseHostFrame({ type: 'host/future' })).toBeNull()
  })
})

describe('parseRpcReceipt', () => {
  it('三种形态', () => {
    expect(parseRpcReceipt({ accepted: true })).toEqual({ accepted: true })
    expect(parseRpcReceipt({ accepted: false, reason: 'not-pending' })).toEqual({ accepted: false, reason: 'not-pending' })
    expect(parseRpcReceipt({ accepted: false, reason: 'other' })).toBeNull()
  })
})

describe('apiPath', () => {
  it('拼接 /api 前缀', () => {
    expect(apiPath('session.list')).toBe('/api/session.list')
  })
})
