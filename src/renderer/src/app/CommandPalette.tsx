import { useEffect, useMemo, useRef, useState } from 'react'
import { useApp, type View } from '../store'
import { useT } from '../hooks'
import { useIde } from '../modules/ide/store'
import { useAgent } from '../modules/agent/store'
import { bridge } from '../bridge'
import { fuzzyFilter } from '../lib/fuzzy'
import { IconFile } from '../icons'

interface Command {
  id: string
  label: string
  hint?: string
  run(): void
}

/** ⌘K 命令面板：模块切换 + 动作 + IDE 文件模糊打开（⌘P 语义并入）。 */
export function CommandPalette({ onClose }: { onClose(): void }) {
  const t = useT()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const [walkFiles, setWalkFiles] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const root = useIde((state) => state.root)
  const setView = useApp((state) => state.setView)

  useEffect(() => { inputRef.current?.focus() }, [])

  // 打开面板时拉取工作区文件清单（有 root 才拉）
  useEffect(() => {
    if (!root) return
    void bridge.workspace.walk().then((result) => setWalkFiles(result.files)).catch(() => undefined)
  }, [root])

  const commands = useMemo<Command[]>(() => {
    const views: Array<{ id: View; label: string }> = [
      { id: 'chat', label: t('navChat') },
      { id: 'ide', label: t('navIde') },
      { id: 'git', label: t('navGit') },
      { id: 'servers', label: t('navServers') },
      { id: 'cicd', label: t('navCicd') },
      { id: 'profiles', label: t('navProfiles') },
      { id: 'plugins', label: t('navPlugins') },
      { id: 'cores', label: t('navCores') },
      { id: 'logs', label: t('navLogs') },
      { id: 'settings', label: t('navSettings') },
    ]
    const list: Command[] = views.map((view) => ({
      id: `view:${view.id}`,
      label: `${t('paletteGoto')}: ${view.label}`,
      run: () => { setView(view.id); onClose() },
    }))
    list.push({
      id: 'agent:new',
      label: t('agentNewSession'),
      run: () => { setView('chat'); void useAgent.getState().createSession(); onClose() },
    })
    list.push({
      id: 'ide:save',
      label: t('paletteSaveFile'),
      run: () => { void useIde.getState().saveActive(); onClose() },
    })
    const fileCommands: Command[] = fuzzyFilter(query, walkFiles, (file) => file, 30).map((file) => ({
      id: `file:${file}`,
      label: file.split('/').pop() ?? file,
      hint: file,
      run: () => { setView('ide'); void useIde.getState().openFile(file); onClose() },
    }))
    const commandHits = fuzzyFilter(query, list, (command) => command.label, 20)
    return [...commandHits, ...fileCommands]
  }, [query, walkFiles, root, t, setView, onClose])

  useEffect(() => { setCursor(0) }, [query])

  const runAt = (index: number): void => {
    const command = commands[index]
    if (command) command.run()
  }

  return (
    <div className="palette-overlay" onClick={onClose}>
      <div className="palette" onClick={(event) => event.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder={t('palettePlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') onClose()
            else if (event.key === 'ArrowDown') { event.preventDefault(); setCursor((v) => Math.min(v + 1, commands.length - 1)) }
            else if (event.key === 'ArrowUp') { event.preventDefault(); setCursor((v) => Math.max(v - 1, 0)) }
            else if (event.key === 'Enter') { event.preventDefault(); runAt(cursor) }
          }}
        />
        <div className="palette-list">
          {commands.map((command, index) => (
            <button
              key={command.id}
              className={`palette-row${index === cursor ? ' palette-row-active' : ''}`}
              onMouseEnter={() => setCursor(index)}
              onClick={() => command.run()}
            >
              {command.id.startsWith('file:') && <IconFile size={12} />}
              <span className="palette-label">{command.label}</span>
              {command.hint && <span className="palette-hint">{command.hint}</span>}
            </button>
          ))}
          {commands.length === 0 && <div className="palette-empty text-dim">{t('paletteEmpty')}</div>}
        </div>
      </div>
    </div>
  )
}
