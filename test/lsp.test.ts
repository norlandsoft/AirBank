import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { frameMessage, LspService, parseFrames } from '../src/main/services/lsp'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'

describe('LSP 帧编解码', () => {
  it('frameMessage：字节长度 + CRLF 头', () => {
    expect(frameMessage('{"a":1}')).toBe('Content-Length: 7\r\n\r\n{"a":1}')
    expect(frameMessage('中')).toBe(`Content-Length: 3\r\n\r\n中`)
  })

  it('parseFrames：完整帧 + 剩余', () => {
    const buffer = 'Content-Length: 2\r\n\r\n{}Content-Length: 3\r\n\r\nabcContent-Length: 5\r\n\r\nxy'
    const { messages, rest } = parseFrames(buffer)
    expect(messages).toEqual(['{}', 'abc'])
    expect(rest).toBe('Content-Length: 5\r\n\r\nxy')
  })

  it('parseFrames：半头等待', () => {
    expect(parseFrames('Content-Leng')).toEqual({ messages: [], rest: 'Content-Leng' })
  })

  it('parseFrames：畸形头再同步', () => {
    const { messages } = parseFrames('garbage\r\n\r\nContent-Length: 2\r\n\r\n{}')
    expect(messages).toEqual(['{}'])
  })
})

describe('LspService（真实 typescript-language-server）', () => {
  let rootDir: string
  let service: LspService

  beforeEach(async () => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-lsp-'))
    fs.writeFileSync(path.join(rootDir, 'a.ts'), 'export const a: number = 1\n')
    const workspace = new WorkspaceService(new Logger(null))
    await workspace.setRoot(rootDir)
    service = new LspService(workspace, new Logger(null))
  })

  afterEach(async () => {
    await service.dispose()
    fs.rmSync(rootDir, { recursive: true, force: true })
  })

  it('ensure 启动并状态可查；dispose 停止', async () => {
    const status = await service.ensure()
    expect(status.running).toBe(true)
    expect(status.pid).not.toBeNull()
    await service.dispose()
    expect(service.status().running).toBe(false)
  }, 20_000)

  it('initialize 握手返回 capabilities；didOpen/hover 有响应', async () => {
    await service.ensure()
    const inbox: string[] = []
    service.onMessage((message) => inbox.push(message))
    const uri = `file://${fs.realpathSync(rootDir)}/a.ts`
    service.send(JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: {
        processId: null,
        rootUri: `file://${fs.realpathSync(rootDir)}`,
        capabilities: { textDocument: { hover: { contentFormat: ['plaintext'] } } },
      },
    }))
    const waitFor = (predicate: () => boolean, ms: number): Promise<boolean> =>
      new Promise((resolve) => {
        const deadline = Date.now() + ms
        const tick = (): void => {
          if (predicate()) resolve(true)
          else if (Date.now() > deadline) resolve(false)
          else setTimeout(tick, 120)
        }
        tick()
      })
    const initialized = await waitFor(() => inbox.some((m) => m.includes('"id":1')), 20_000)
    expect(initialized).toBe(true)
    const initResponse = inbox.find((m) => m.includes('"id":1'))
    expect(initResponse).toContain('capabilities')

    service.send(JSON.stringify({ jsonrpc: '2.0', method: 'initialized', params: {} }))
    service.send(JSON.stringify({
      jsonrpc: '2.0', method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId: 'typescript', version: 1, text: 'export const a: number = 1\n' } },
    }))
    service.send(JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'textDocument/hover',
      params: { textDocument: { uri }, position: { line: 0, character: 14 } },
    }))
    const hovered = await waitFor(() => inbox.some((m) => m.includes('"id":2')), 20_000)
    expect(hovered).toBe(true)
    const hover = inbox.find((m) => m.includes('"id":2'))
    expect(hover).toContain('const a')
  }, 45_000)
})
