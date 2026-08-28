import { useEffect, useState } from 'react'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import { bridge } from '../../../bridge'
import { IconCheck, IconFolder } from '../../../icons'
import { draftCwdFromInput, homeShorten, recentCwds } from '../cwdOptions'

/** 弹层通用壳（与 pickers.tsx 同款）。 */
function Popover({ onClose, wide, children }: { onClose(): void; wide?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className="popover-mask" onClick={onClose} />
      <div className={`popover${wide ? ' popover-wide' : ''}`}>{children}</div>
    </>
  )
}

/** 目录选择（起始页内联：输入/浏览/最近目录 chips，不用弹层）。 */
export function CwdPicker() {
  const t = useT()
  const hostInfo = useAgent((state) => state.hostInfo)
  const sessions = useAgent((state) => state.sessions)
  const draftCwd = useAgent((state) => state.draftCwd)
  const setDraftCwd = useAgent((state) => state.setDraftCwd)
  /** 编辑中的输入（null = 未编辑，输入框显示当前生效目录）。 */
  const [editing, setEditing] = useState<string | null>(null)

  const defaultCwd = hostInfo?.cwd ?? ''
  const recents = recentCwds(sessions)
  const current = draftCwd ?? defaultCwd

  const commit = (text: string): void => {
    setDraftCwd(draftCwdFromInput(text))
    setEditing(null)
  }

  return (
    <div className="start-cwd">
      <div className="newsession-inputrow">
        <IconFolder size={14} />
        <input
          className="input"
          value={editing ?? current}
          placeholder={defaultCwd}
          onChange={(event) => setEditing(event.target.value)}
          onBlur={() => { if (editing !== null) commit(editing) }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') commit(event.currentTarget.value)
            if (event.key === 'Escape') setEditing(null)
          }}
        />
        <button
          className="btn"
          onClick={() => void bridge.dialogPickDirectory().then((dir) => {
            if (dir) {
              setDraftCwd(dir)
              setEditing(null)
            }
          })}
        >
          {t('sessionCwdBrowse')}
        </button>
      </div>
      <div className="start-cwd-recents">
        <button
          className={`start-cwd-chip${draftCwd === null ? ' start-cwd-chip-active' : ''}`}
          title={defaultCwd}
          onClick={() => { setDraftCwd(null); setEditing(null) }}
        >
          {homeShorten(defaultCwd)}（{t('startCwdDefault')}）
        </button>
        {recents.filter((dir) => dir !== defaultCwd).map((dir) => (
          <button
            key={dir}
            className={`start-cwd-chip${draftCwd === dir ? ' start-cwd-chip-active' : ''}`}
            title={dir}
            onClick={() => { setDraftCwd(dir); setEditing(null) }}
          >
            {homeShorten(dir)}
          </button>
        ))}
      </div>
    </div>
  )
}

interface PresetEntry { id: string; name: string; isDefault: boolean }

/** 智能体预设选择器（起始页；写入 draftPreset，创建会话时生效）。 */
export function PresetPicker() {
  const client = useAgent((state) => state.client)
  const connection = useAgent((state) => state.connection)
  const draftPreset = useAgent((state) => state.draftPreset)
  const setDraftPreset = useAgent((state) => state.setDraftPreset)
  const [presets, setPresets] = useState<PresetEntry[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (connection !== 'ready') return
    void client.agentPresetList()
      .then((result) => setPresets(result.presets.map((p) => ({ id: p.id, name: p.name, isDefault: p.isDefault }))))
      .catch(() => undefined)
  }, [connection, client])

  const current = presets.find((p) => p.id === draftPreset) ?? presets.find((p) => p.isDefault)

  return (
    <span className="picker">
      <button className="btn btn-ghost start-picker-btn" onClick={() => setOpen((v) => !v)}>
        🧩 {current?.name ?? '…'} ▾
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)}>
          <div className="picker-list">
            {presets.map((preset) => {
              const active = (draftPreset ?? current?.id) === preset.id
              return (
                <button
                  key={preset.id}
                  className={`picker-row${active ? ' picker-row-active' : ''}`}
                  onClick={() => { setDraftPreset(preset.id); setOpen(false) }}
                >
                  <span className="picker-check">{active ? <IconCheck size={13} /> : ''}</span>
                  <span className="picker-label">{preset.name}</span>
                </button>
              )
            })}
          </div>
        </Popover>
      )}
    </span>
  )
}
