import { useEffect, useRef, useState } from 'react'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import { fuzzyFilter } from '../../../lib/fuzzy'

interface AttachedImage {
  mediaType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  data: string
  name?: string
  preview: string
}

interface SlashCommand {
  name: string
  description?: string
  input?: { hint?: string; images?: boolean }
}

/** 每会话命令清单缓存（模块级，跨组件实例共享）。 */
const commandCache = new Map<string, SlashCommand[]>()

function useSlashCommands(sessionId: string | null): SlashCommand[] {
  const [commands, setCommands] = useState<SlashCommand[]>(sessionId ? (commandCache.get(sessionId) ?? []) : [])
  useEffect(() => {
    if (!sessionId) return
    const cached = commandCache.get(sessionId)
    if (cached) {
      setCommands(cached)
      return
    }
    void useAgent.getState().client.commandsList(sessionId).then((list) => {
      commandCache.set(sessionId, list)
      setCommands(list)
    }).catch(() => undefined)
  }, [sessionId])
  return commands
}

const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

function readImage(file: File): Promise<AttachedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('read failed'))
    reader.onload = () => {
      const dataUrl = String(reader.result)
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
      resolve({ mediaType: file.type as AttachedImage['mediaType'], data: base64, name: file.name, preview: dataUrl })
    }
    reader.readAsDataURL(file)
  })
}

/** 模型选择器：session.models 的 current + routable 列表。 */
function ModelSelect() {
  const models = useAgent((state) => state.models)
  const selectModel = useAgent((state) => state.selectModel)
  if (!models || !Array.isArray(models.routable) || models.routable.length === 0) return null
  const currentValue = models.current ? `${models.current.provider}/${models.current.model}` : ''
  return (
    <select
      className="input model-select"
      value={currentValue}
      onChange={(event) => {
        const [provider, model] = event.target.value.split('/')
        if (provider && model) void selectModel(provider, model)
      }}
    >
      {models.current && !models.routable.some((r) => r.provider === models.current?.provider && r.model === models.current?.model) && (
        <option value={currentValue}>{currentValue}</option>
      )}
      {models.routable.map((entry) => (
        <option key={`${entry.provider}/${entry.model}`} value={`${entry.provider}/${entry.model}`}>
          {entry.provider}/{entry.model}
        </option>
      ))}
    </select>
  )
}

/** 输入区：斜杠命令面板 + 图片附件 + 自适应高度；Enter 发送 / Shift+Enter 换行。 */
export function Composer() {
  const t = useT()
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const running = useAgent((state) => (state.activeSessionId ? state.slices[state.activeSessionId]?.running === true : false))
  const sending = useAgent((state) => state.sending)
  const send = useAgent((state) => state.send)
  const cancelActive = useAgent((state) => state.cancelActive)
  const [text, setText] = useState('')
  const [images, setImages] = useState<AttachedImage[]>([])
  const [slashCursor, setSlashCursor] = useState(0)
  const areaRef = useRef<HTMLTextAreaElement | null>(null)
  const commands = useSlashCommands(activeSessionId)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [text])

  // 斜杠面板：以 / 开头且尚未输入空格时激活
  const slashMatch = /^\/(\S*)$/.exec(text)
  const slashOpen = slashMatch !== null && commands.length > 0
  const slashHits = slashOpen ? fuzzyFilter(slashMatch[1], commands, (command) => command.name, 8) : []

  useEffect(() => { setSlashCursor(0) }, [text])

  const applySlash = (command: SlashCommand): void => {
    setText(`/${command.name} `)
    areaRef.current?.focus()
  }

  const attachFiles = (files: Iterable<File>): void => {
    for (const file of files) {
      if (!IMAGE_TYPES.has(file.type)) continue
      void readImage(file).then((image) => setImages((prev) => [...prev, image])).catch(() => undefined)
    }
  }

  const submit = (): void => {
    if (!activeSessionId || (text.trim().length === 0 && images.length === 0)) return
    void send(text, images)
    setText('')
    setImages([])
  }

  return (
    <div className="composer">
      {slashOpen && slashHits.length > 0 && (
        <div className="slash-panel">
          {slashHits.map((command, index) => (
            <button
              key={command.name}
              className={`slash-row${index === slashCursor ? ' slash-row-active' : ''}`}
              onMouseEnter={() => setSlashCursor(index)}
              onClick={() => applySlash(command)}
            >
              <span className="slash-name">/{command.name}</span>
              {command.input?.hint && <span className="slash-hint">{command.input.hint}</span>}
              <span className="slash-desc">{command.description ?? ''}</span>
            </button>
          ))}
        </div>
      )}
      {images.length > 0 && (
        <div className="attach-row">
          {images.map((image, index) => (
            <div key={index} className="attach-thumb">
              <img src={image.preview} alt={image.name ?? 'image'} />
              <button className="attach-remove" onClick={() => setImages((prev) => prev.filter((_, i) => i !== index))}>✕</button>
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={areaRef}
        className="composer-input"
        rows={1}
        placeholder={activeSessionId ? t('agentPlaceholder') : t('agentNeedSession')}
        value={text}
        disabled={!activeSessionId}
        onChange={(event) => setText(event.target.value)}
        onPaste={(event) => {
          const files = [...event.clipboardData.files]
          if (files.some((file) => IMAGE_TYPES.has(file.type))) {
            event.preventDefault()
            attachFiles(files)
          }
        }}
        onDrop={(event) => {
          event.preventDefault()
          attachFiles([...event.dataTransfer.files])
        }}
        onKeyDown={(event) => {
          if (slashOpen && slashHits.length > 0) {
            if (event.key === 'ArrowDown') { event.preventDefault(); setSlashCursor((v) => Math.min(v + 1, slashHits.length - 1)); return }
            if (event.key === 'ArrowUp') { event.preventDefault(); setSlashCursor((v) => Math.max(v - 1, 0)); return }
            if (event.key === 'Tab' || (event.key === 'Enter' && !event.shiftKey)) {
              event.preventDefault()
              applySlash(slashHits[slashCursor])
              return
            }
            if (event.key === 'Escape') { setText((v) => v.replace(/^\//, '')); return }
          }
          if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault()
            submit()
          }
        }}
      />
      <div className="composer-bar">
        <ModelSelect />
        <div className="flex-1" />
        {running ? (
          <button className="btn" title={t('agentStopTitle')} onClick={() => void cancelActive()}>⏹ {t('agentStopTitle')}</button>
        ) : (
          <button
            className="btn btn-primary"
            disabled={!activeSessionId || sending || (text.trim().length === 0 && images.length === 0)}
            onClick={submit}
          >
            {t('agentSend')}
          </button>
        )}
      </div>
    </div>
  )
}
