import { useState } from 'react'
import type { TimelineItem } from '../model'
import { useIde } from '../../ide/store'
import { useApp } from '../../../store'
import { useT } from '../../../hooks'
import { CodeBlock, langForPath } from '../../../lib/code-highlight'

type ToolItem = Extract<TimelineItem, { kind: 'tool' }>
type ToolStatusItem = Extract<TimelineItem, { kind: 'tool-status' }>

const PATH_KEYS = ['path', 'file', 'filePath', 'file_path', 'filename', 'target_file', 'targetFile']

/** 从工具参数 JSON 提取文件路径。 */
function extractPath(argumentsRaw: string): string | null {
  try {
    const args = JSON.parse(argumentsRaw) as Record<string, unknown>
    for (const key of PATH_KEYS) {
      if (typeof args[key] === 'string' && args[key].length > 0) return args[key]
    }
  } catch { /* fallthrough */ }
  const match = /"(?:path|file(?:[Pp]ath)?)"\s*:\s*"([^"]+)"/.exec(argumentsRaw)
  return match ? match[1] : null
}

/** 绝对/相对路径 → IDE 相对路径（root 外的绝对路径返回 null）。 */
function toRel(target: string, root: string): string | null {
  if (target.startsWith(root + '/')) return target.slice(root.length + 1)
  if (target === root) return ''
  if (!target.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(target)) return target
  return null
}

const shortenPath = (target: string): { dir: string; base: string } => {
  const norm = target.replace(/^\/(?:Users|home)\/[^/]+/, '~')
  const idx = norm.lastIndexOf('/')
  return idx <= 0 ? { dir: '', base: norm } : { dir: norm.slice(0, idx + 1), base: norm.slice(idx + 1) }
}

function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

function extractText(content: unknown[]): string {
  return content
    .map((block) => {
      if (typeof block === 'object' && block !== null && (block as { type?: string }).type === 'text') {
        return String((block as { text?: string }).text ?? '')
      }
      return ''
    })
    .filter((text) => text.length > 0)
    .join('\n')
}

interface ParsedArgs {
  path?: string
  content?: string
  edits?: { old?: string; new?: string; old_string?: string; new_string?: string }[]
}

function parseArgs(raw: string): ParsedArgs | null {
  try {
    const args = JSON.parse(raw) as Record<string, unknown>
    return {
      path: typeof args.path === 'string' ? args.path : undefined,
      content: typeof args.content === 'string' ? args.content : undefined,
      edits: Array.isArray(args.edits) ? (args.edits as ParsedArgs['edits']) : undefined,
    }
  } catch {
    return null
  }
}

/** write/edit 工具卡：紧凑头部（工具名 + 文件名），展开内容语法高亮。 */
export function FileToolCard({ item, running }: { item: ToolItem; running: boolean }) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const root = useIde((state) => state.root)
  const setView = useApp((state) => state.setView)
  const pending = !item.result && !item.error && running
  const failed = Boolean(item.error)
  const target = extractPath(item.argumentsRaw)
  const rel = target && root ? toRel(target, root) : null
  const parts = target ? shortenPath(target) : null
  const label = item.name === 'write' ? 'Write' : item.name === 'edit' ? 'Edit' : item.name
  const args = parseArgs(item.argumentsRaw)
  const resultText = item.result ? extractText(item.result.content) : ''
  const lang = target ? langForPath(target) : 'text'
  const code = args?.content ?? resultText

  return (
    <div className={`filetool${failed ? ' filetool-error' : ''}`}>
      <div className="filetool-head">
        <button className="filetool-main" onClick={() => setOpen((v) => !v)}>
          <span className={`toolcard-dot${pending ? ' toolcard-dot-running' : failed ? ' toolcard-dot-error' : ''}`} />
          <span className="filetool-label">{label}</span>
          {parts ? (
            <span className="filetool-path">
              <span className="filetool-base">{parts.base}</span>
              <span className="filetool-dir">{parts.dir}</span>
            </span>
          ) : (
            <span className="toolcard-args">{preview(item.argumentsRaw, 80)}</span>
          )}
        </button>
        {rel && (
          <button
            className="btn btn-ghost toolcard-open"
            onClick={() => {
              setView('ide')
              void useIde.getState().openFile(rel)
            }}
          >
            {t('ideOpenInIde')} ↗
          </button>
        )}
        <button className="filetool-chevron" onClick={() => setOpen((v) => !v)}>{open ? '▾' : '▸'}</button>
      </div>
      {open && (
        <div className="filetool-body">
          {args?.edits?.map((edit, index) => (
            <div key={index} className="filetool-edit">
              {edit.old !== undefined && (
                <div className="filetool-editline filetool-edit-old"><span className="filetool-editmark">−</span><pre>{edit.old}</pre></div>
              )}
              {edit.new !== undefined && (
                <div className="filetool-editline filetool-edit-new"><span className="filetool-editmark">＋</span><pre>{edit.new}</pre></div>
              )}
            </div>
          ))}
          {code.trim().length > 0 && <CodeBlock code={code} lang={lang} maxHeight={360} />}
          {!args?.edits && !code.trim() && item.argumentsRaw && <pre className="toolcard-pre">{item.argumentsRaw}</pre>}
          {failed && <div className="toolcard-errtext">{item.error?.name}: {item.error?.code}</div>}
          {pending && <div className="text-dim text-xs">执行中…</div>}
        </div>
      )}
    </div>
  )
}

/** 活动行：思考与工具的统一单行呈现（不换行；新记录原位替换上一条）。 */
export function ActivityLine({ item, reasoning }: { item?: ToolStatusItem; reasoning?: string }) {
  if (item) {
    const target = extractPath(item.argumentsRaw)
    const brief = target ? shortenPath(target).base : preview(item.argumentsRaw, 72)
    return (
      <div className={`activityline activityline-${item.state}`} title={item.argumentsRaw}>
        {item.state === 'running' && <span className="activityline-dot spin">◌</span>}
        {item.state === 'done' && <span className="activityline-dot activityline-ok">✓</span>}
        {item.state === 'error' && <span className="activityline-dot activityline-err">✗</span>}
        <span className="activityline-name">{item.name}</span>
        {brief && <span className="activityline-brief">{brief}</span>}
        {item.state === 'running' && <span className="activityline-state">执行中…</span>}
        {item.errorText && <span className="activityline-state">{item.errorText}</span>}
      </div>
    )
  }
  if (reasoning) {
    return (
      <div className="activityline" title={reasoning}>
        <span className="activityline-dot activityline-think">◍</span>
        <span className="activityline-name">思考</span>
        <span className="activityline-brief">{reasoning}</span>
      </div>
    )
  }
  return null
}
