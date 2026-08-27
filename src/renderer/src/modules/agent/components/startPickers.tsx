import { useEffect, useState } from 'react'
import { useAgent } from '../store'
import { useT } from '../../../hooks'
import { bridge } from '../../../bridge'
import { IconCheck, IconFolder } from '../../../icons'

/** 弹层通用壳（与 pickers.tsx 同款）。 */
function Popover({ onClose, wide, children }: { onClose(): void; wide?: boolean; children: React.ReactNode }) {
  return (
    <>
      <div className="popover-mask" onClick={onClose} />
      <div className={`popover${wide ? ' popover-wide' : ''}`}>{children}</div>
    </>
  )
}

const homeShorten = (cwd: string): string => cwd.replace(/^\/(?:Users|home)\/[^/]+/, '~')

/** 目录选择器（起始页左上角；输入/浏览/最近目录）。 */
export function CwdPicker() {
  const t = useT()
  const hostInfo = useAgent((state) => state.hostInfo)
  const sessions = useAgent((state) => state.sessions)
  const draftCwd = useAgent((state) => state.draftCwd)
  const setDraftCwd = useAgent((state) => state.setDraftCwd)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')

  const defaultCwd = hostInfo?.cwd ?? ''
  const recents = [...new Set(sessions.map((s) => s.cwd).filter((c): c is string => Boolean(c)))].slice(0, 8)
  const current = draftCwd ?? defaultCwd

  return (
    <span className="picker">
      <button className="btn btn-ghost start-picker-btn" onClick={() => { setDraft(''); setOpen((v) => !v) }}>
        <IconFolder size={14} /> {homeShorten(current) || '…'} ▾
      </button>
      {open && (
        <Popover onClose={() => setOpen(false)} wide>
          <div className="picker-list">
            <div className="newsession-inputrow" style={{ padding: '4px 6px' }}>
              <input
                className="input" autoFocus placeholder={defaultCwd}
                value={draft} onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    setDraftCwd(draft.trim() || null)
                    setOpen(false)
                  }
                }}
              />
              <button
                className="btn"
                onClick={() => void bridge.dialogPickDirectory().then((dir) => {
                  if (dir) {
                    setDraftCwd(dir)
                    setOpen(false)
                  }
                })}
              >
                {t('sessionCwdBrowse')}
              </button>
            </div>
            <button
              className={`picker-row${draftCwd === null ? ' picker-row-active' : ''}`}
              onClick={() => { setDraftCwd(null); setOpen(false) }}
            >
              <span className="picker-check">{draftCwd === null ? <IconCheck size={13} /> : ''}</span>
              <span className="picker-label">{homeShorten(defaultCwd)}（{t('startCwdDefault')}）</span>
            </button>
            {recents.filter((dir) => dir !== defaultCwd).map((dir) => (
              <button
                key={dir}
                className={`picker-row${draftCwd === dir ? ' picker-row-active' : ''}`}
                onClick={() => { setDraftCwd(dir); setOpen(false) }}
              >
                <span className="picker-check">{draftCwd === dir ? <IconCheck size={13} /> : ''}</span>
                <span className="picker-label newsession-path">{dir}</span>
              </button>
            ))}
          </div>
        </Popover>
      )}
    </span>
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
