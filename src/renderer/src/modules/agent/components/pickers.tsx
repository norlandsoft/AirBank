import { useRef, useState } from 'react'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import { IconPlus, IconSettings, IconCheck } from '../../../icons'

interface PermissionSelect {
  options: { value: string; name: string; description?: string }[]
  currentValue: string
}

/** 弹层通用壳：点击遮罩关闭。 */
function Popover({ onClose, children }: { onClose(): void; children: React.ReactNode }) {
  return (
    <>
      <div className="popover-mask" onClick={onClose} />
      <div className="popover">{children}</div>
    </>
  )
}

/** 附件按钮：唤起文件选择（图片，多选），与粘贴/拖放同通道。 */
export function AttachButton({ onAttach }: { onAttach(files: File[]): void }) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <>
      <input
        ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" multiple hidden
        onChange={(event) => {
          onAttach([...(event.target.files ?? [])])
          event.target.value = ''
        }}
      />
      <button className="btn btn-ghost composer-icon-btn" title="添加图片附件" onClick={() => inputRef.current?.click()}>
        <IconPlus size={16} />
      </button>
    </>
  )
}

/** 模型+推理等级选择器（dsh WebUI 两级菜单：根面板两行各自下钻；无会话时写草稿）。 */
export function ModelPicker() {
  const t = useT()
  const models = useAgent((state) => state.models)
  const modelCatalog = useAgent((state) => state.modelCatalog)
  const defaultModel = useAgent((state) => state.defaultModel)
  const draftModel = useAgent((state) => state.draftModel)
  const setDraftModel = useAgent((state) => state.setDraftModel)
  const selectModel = useAgent((state) => state.selectModel)
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const [open, setOpen] = useState(false)
  const [pane, setPane] = useState<'root' | 'model' | 'effort'>('root')

  // 会话模式：session.models；起始模式：modelCatalog + draftModel/defaultModel
  const groups = activeSessionId ? (models?.groups ?? []) : modelCatalog
  const current = activeSessionId
    ? models?.current ?? null
    : draftModel ?? (defaultModel ? { provider: defaultModel.provider, model: defaultModel.model, reasoningEffort: defaultModel.reasoningEffort } : null)
  if (groups.length === 0 || !current) return null
  const group = groups.find((g) => g.id === current.provider)
  const currentModel = group?.models.find((m) => m.id === current.model)
  const efforts = currentModel?.reasoning?.efforts ?? []
  const effortValue = 'reasoningEffort' in current ? current.reasoningEffort : undefined
  const currentEffort = (activeSessionId ? effortValue : (draftModel?.effort ?? effortValue)) ?? currentModel?.reasoning?.defaultEffort
  const modelLabel = currentModel?.name ?? current.model
  const effortLabel = efforts.find((e) => e.id === currentEffort)?.name ?? currentEffort

  const close = (): void => { setOpen(false); setPane('root') }
  const pickModel = (provider: string, model: string, effort?: string): void => {
    close()
    if (activeSessionId) void selectModel(provider, model, effort)
    else setDraftModel({ provider, model, effort })
  }
  const pickEffort = (effortId: string): void => {
    close()
    if (activeSessionId) void selectModel(current.provider, current.model, effortId)
    else setDraftModel({ provider: current.provider, model: current.model, effort: effortId })
  }

  return (
    <div className="picker">
      <button className="btn btn-ghost composer-picker-btn" title={t('modelPickerTitle')} onClick={() => setOpen((v) => !v)}>
        ◈ {modelLabel}{effortLabel ? ` · ${effortLabel}` : ''} ▾
      </button>
      {open && (
        <Popover onClose={close}>
          <div className="picker-list">
            {pane === 'root' && (
              <>
                <button className="picker-row picker-cell" onClick={() => setPane('model')}>
                  <span className="picker-label">{t('menuModel')}</span>
                  <span className="picker-cellvalue">{modelLabel}</span>
                  <span className="picker-chevron">›</span>
                </button>
                {efforts.length > 0 && (
                  <button className="picker-row picker-cell" onClick={() => setPane('effort')}>
                    <span className="picker-label">{t('menuEffort')}</span>
                    <span className="picker-cellvalue">{effortLabel}</span>
                    <span className="picker-chevron">›</span>
                  </button>
                )}
              </>
            )}
            {pane !== 'root' && (
              <button className="picker-row picker-back" onClick={() => setPane('root')}>
                <span className="picker-chevron">‹</span>
                <span className="picker-label">{pane === 'model' ? t('menuModel') : t('menuEffort')}</span>
              </button>
            )}
            {pane === 'model' && groups.map((g) => (
              <div key={g.id} className="picker-group">
                <div className="picker-subgroup-name">{g.name}</div>
                {g.models.map((model) => {
                  const active = current.provider === g.id && current.model === model.id
                  return (
                    <button key={model.id} className={`picker-row${active ? ' picker-row-active' : ''}`} onClick={() => pickModel(g.id, model.id, model.reasoning?.defaultEffort)}>
                      <span className="picker-check">{active ? <IconCheck size={13} /> : ''}</span>
                      <span className="picker-label">{model.name}</span>
                    </button>
                  )
                })}
              </div>
            ))}
            {pane === 'effort' && efforts.map((effort) => {
              const active = effort.id === currentEffort
              return (
                <button
                  key={effort.id}
                  className={`picker-row${active ? ' picker-row-active' : ''}`}
                  onClick={() => pickEffort(effort.id)}
                >
                  <span className="picker-check">{active ? <IconCheck size={13} /> : ''}</span>
                  <span className="picker-label">{effort.name}</span>
                </button>
              )
            })}
          </div>
        </Popover>
      )}
    </div>
  )
}

/** 组合默认权限预设表（bundle/base cordis.patch.yml；会话投影就绪前的起始页数据源）。 */
const FALLBACK_ACCESS_OPTIONS: { value: string; name: string; description?: string }[] = [
  { value: 'read-only', name: 'Read Only' },
  { value: 'workspace-write', name: 'Workspace Write' },
  { value: 'danger-full-access', name: 'Full Access' },
]

/** access 模式选择器（会话内读投影；起始页读默认表并写草稿）。 */
export function AccessPicker() {
  const t = useT()
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const select = useAgent((state) => {
    if (!state.activeSessionId) return null
    const value = state.slices[state.activeSessionId]?.projections.get('permissions')?.value
    return (value ?? null) as PermissionSelect | null
  })
  const running = useAgent((state) => (state.activeSessionId ? state.slices[state.activeSessionId]?.running === true : false))
  const send = useAgent((state) => state.send)
  const defaultAccess = useAgent((state) => state.defaultAccess)
  const draftAccess = useAgent((state) => state.draftAccess)
  const setDraftAccess = useAgent((state) => state.setDraftAccess)
  const [open, setOpen] = useState(false)

  // 起始模式：静态预设表 + draftAccess/defaultAccess
  const options = activeSessionId ? (select?.options ?? []) : FALLBACK_ACCESS_OPTIONS
  const currentValue = activeSessionId ? select?.currentValue : (draftAccess ?? defaultAccess ?? 'workspace-write')
  if (options.length === 0) return null
  const current = options.find((option) => option.value === currentValue)

  return (
    <div className="picker">
      <button
        className="btn btn-ghost composer-picker-btn"
        title={running ? t('setPermissionRunning') : t('accessMode')}
        disabled={running}
        onClick={() => setOpen((v) => !v)}
      >
        <IconSettings size={13} /> {current?.name ?? currentValue} ▾
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="picker-list">
            {options.map((option) => {
              const active = option.value === currentValue
              return (
                <button
                  key={option.value}
                  className={`picker-row${active ? ' picker-row-active' : ''}`}
                  onClick={() => {
                    setOpen(false)
                    if (active) return
                    if (activeSessionId) void send(`/permission ${option.value}`)
                    else setDraftAccess(option.value)
                  }}
                >
                  <span className="picker-check">{active ? <IconCheck size={13} /> : ''}</span>
                  <span className="picker-label">{option.name}</span>
                  {option.description && <span className="picker-desc">{option.description}</span>}
                </button>
              )
            })}
          </div>
        </Popover>
      )}
    </div>
  )
}
