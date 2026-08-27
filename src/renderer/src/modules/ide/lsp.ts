import { LSPClient, languageServerSupport, type Transport } from '@codemirror/lsp-client'
import type { Extension } from '@codemirror/state'
import type { EditorView as CmEditorView } from '@codemirror/view'
import { bridge } from '../../bridge'

/**
 * IDE ↔ TypeScript 语言服务器（设计文档 §5.2 二期）：
 * Transport 经主进程 LspService 桥（JSON 字符串，无 LSP 头）。
 * 单例客户端（一个工作区一个服务器），编辑器经 languageServerSupport 接入
 * （悬停/补全/诊断/签名/跳转/重命名/格式化一键捆绑）。
 */
let client: LSPClient | null = null
let clientRoot: string | null = null
let wired = false
const handlers = new Set<(message: string) => void>()

function wire(): void {
  if (wired) return
  wired = true
  bridge.onLspMessage((message) => { for (const handler of handlers) handler(message) })
}

/** 文件扩展名 → LSP languageId（仅 ts/js 家族接入本服务器）。 */
export function languageIdFor(rel: string): string | null {
  const ext = rel.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts': case 'mts': case 'cts': return 'typescript'
    case 'tsx': return 'typescriptreact'
    case 'js': case 'mjs': case 'cjs': return 'javascript'
    case 'jsx': return 'javascriptreact'
    default: return null
  }
}

export function fileUri(root: string, rel: string): string {
  return `file://${root}/${rel}`
}

export function getLspClient(root: string): LSPClient {
  if (client && clientRoot === root) return client
  wire()
  client?.disconnect()
  const transport: Transport = {
    send: (message) => { void bridge.lsp.send(message).catch(() => undefined) },
    subscribe: (handler) => handlers.add(handler),
    unsubscribe: (handler) => handlers.delete(handler),
  }
  client = new LSPClient({ rootUri: `file://${root}`, timeout: 30_000 })
  clientRoot = root
  void bridge.lsp.ensure().catch(() => undefined)
  client.connect(transport)
  return client
}

/** 编辑器 LSP 扩展（非 ts/js 家族或未设 root → null）。 */
export function lspSupport(root: string | null, rel: string): Extension | null {
  const languageId = languageIdFor(rel)
  if (!root || !languageId) return null
  return languageServerSupport(getLspClient(root), fileUri(root, rel), languageId)
}

interface LspTextEdit {
  range: { start: { line: number; character: number }; end: { line: number; character: number } }
  newText: string
}

function offsetAt(view: CmEditorView, pos: { line: number; character: number }): number {
  const line = view.state.doc.line(Math.min(pos.line + 1, view.state.doc.lines))
  return Math.min(line.from + pos.character, line.to)
}

/** source.organizeImports code action → 应用 WorkspaceEdit（⌘⇧O）。 */
export async function organizeImports(root: string, rel: string, view: CmEditorView): Promise<boolean> {
  const lsp = getLspClient(root)
  const uri = fileUri(root, rel)
  const response = await lsp.request<unknown, unknown>('textDocument/codeAction', {
    textDocument: { uri },
    range: { start: { line: 0, character: 0 }, end: { line: 0, character: 0 } },
    context: { diagnostics: [], only: ['source.organizeImports'] },
  }).catch(() => null)
  if (!Array.isArray(response)) return false
  const withEdit = response.find((action) => typeof action === 'object' && action !== null && 'edit' in action) as
    { edit?: { changes?: Record<string, LspTextEdit[]>; documentChanges?: unknown } } | undefined
  const edits = withEdit?.edit?.changes?.[uri]
  if (!edits || edits.length === 0) return false
  view.dispatch({
    changes: edits.map((edit) => ({ from: offsetAt(view, edit.range.start), to: offsetAt(view, edit.range.end), insert: edit.newText })),
    userEvent: 'input.complete',
  })
  return true
}
