import { useState } from 'react'
import type { TimelineItem } from '../model'
import { useIde } from '../../ide/store'
import { useApp } from '../../../store'
import { useT } from '../../../hooks'

type ToolItem = Extract<TimelineItem, { kind: 'tool' }>
type ToolStatusItem = Extract<TimelineItem, { kind: 'tool-status' }>

const PATH_KEYS = ['path', 'file', 'filePath', 'file_path', 'filename', 'target_file', 'targetFile']

/** 从工具参数 JSON 提取文件路径（fs 系工具的常见键 + 正则兜底）。 */
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

/** write/edit 工具卡：工具名 + 文件名主显，状态点，展开看参数/结果。 */
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
  const resultText = item.result ? preview(extractText(item.result.content), 4000) : ''

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
        <div className="toolcard-body">
          {item.argumentsRaw && <pre className="toolcard-pre">{item.argumentsRaw}</pre>}
          {resultText && <pre className="toolcard-pre">{resultText}</pre>}
          {failed && <div className="toolcard-errtext">{item.error?.name}: {item.error?.code}</div>}
          {pending && <div className="text-dim text-xs">执行中…</div>}
        </div>
      )}
    </div>
  )
}

/** 瞬时工具状态行：单行、不累积、被下一条工具/消息覆盖。 */
export function ToolStatusLine({ item }: { item: ToolStatusItem }) {
  const target = extractPath(item.argumentsRaw)
  const brief = target ? shortenPath(target).base : preview(item.argumentsRaw, 64)
  return (
    <div className={`toolstatus toolstatus-${item.state}`}>
      {item.state === 'running' && <span className="toolstatus-spinner spin">◌</span>}
      {item.state === 'done' && <span className="toolstatus-ok">✓</span>}
      {item.state === 'error' && <span className="toolstatus-err">✗</span>}
      <span className="toolstatus-name">{item.name}</span>
      {brief && <span className="toolstatus-brief">{brief}</span>}
      {item.state === 'running' && <span className="toolstatus-state">执行中…</span>}
      {item.errorText && <span className="toolstatus-state">{item.errorText}</span>}
    </div>
  )
}
