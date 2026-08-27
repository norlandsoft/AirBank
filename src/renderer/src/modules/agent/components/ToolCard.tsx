import { useState } from 'react'
import type { TimelineItem } from '../model'
import { useIde } from '../../ide/store'
import { useApp } from '../../../store'
import { useT } from '../../../hooks'

type ToolItem = Extract<TimelineItem, { kind: 'tool' }>

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

/** 在 IDE 中打开工具涉及的文件（root 已设置且路径可解析时显示）。 */
function OpenInIde({ argumentsRaw }: { argumentsRaw: string }) {
  const t = useT()
  const root = useIde((state) => state.root)
  const setView = useApp((state) => state.setView)
  if (!root) return null
  const target = extractPath(argumentsRaw)
  if (!target) return null
  const rel = toRel(target, root)
  if (rel === null || rel === '') return null
  return (
    <button
      className="btn btn-ghost toolcard-open"
      onClick={(event) => {
        event.stopPropagation()
        setView('ide')
        void useIde.getState().openFile(rel)
      }}
    >
      {t('ideOpenInIde')} ↗
    </button>
  )
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

function preview(text: string, max = 120): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length > max ? `${flat.slice(0, max)}…` : flat
}

/** 工具调用卡片：默认折叠（名称 + 参数摘要 + 状态），展开看全量参数与结果。 */
export function ToolCard({ item, running }: { item: ToolItem; running: boolean }) {
  const [open, setOpen] = useState(false)
  const pending = !item.result && !item.error && running
  const failed = Boolean(item.error)
  const resultText = item.result ? preview(extractText(item.result.content), 4000) : ''

  return (
    <div className={`toolcard${failed ? ' toolcard-error' : ''}`}>
      <button className="toolcard-head" onClick={() => setOpen((v) => !v)}>
        <span className={`toolcard-dot${pending ? ' toolcard-dot-running' : failed ? ' toolcard-dot-error' : ''}`} />
        <span className="toolcard-name">{item.name || 'tool'}</span>
        <span className="toolcard-args">{preview(item.argumentsRaw, 80)}</span>
        <OpenInIde argumentsRaw={item.argumentsRaw} />
        <span className="toolcard-chevron">{open ? '▾' : '▸'}</span>
      </button>
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
