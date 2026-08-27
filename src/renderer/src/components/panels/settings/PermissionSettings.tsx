import { useAgent } from '../../../modules/agent/store'
import { useT } from '../../../hooks'

interface PermissionSelect {
  options: { value: string; name: string; description?: string }[]
  currentValue: string
}

/** 权限设置：当前会话的权限预设（sandbox + approval 组合），点击切换（/permission 命令）。 */
export function PermissionSettings() {
  const t = useT()
  const activeSessionId = useAgent((state) => state.activeSessionId)
  const select = useAgent((state) => {
    if (!state.activeSessionId) return null
    const value = state.slices[state.activeSessionId]?.projections.get('permissions')?.value
    return (value ?? null) as PermissionSelect | null
  })
  const send = useAgent((state) => state.send)
  const running = useAgent((state) => (state.activeSessionId ? state.slices[state.activeSessionId]?.running === true : false))

  if (!activeSessionId) {
    return (
      <div className="settings-section">
        <div className="settings-section-title">{t('setPermission')}</div>
        <div className="text-dim text-xs py-1">{t('setPermissionHint')}</div>
      </div>
    )
  }
  if (!select) {
    return (
      <div className="settings-section">
        <div className="settings-section-title">{t('setPermission')}</div>
        <div className="text-dim text-xs py-1">{t('setPermissionLoading')}</div>
      </div>
    )
  }

  return (
    <div className="settings-section">
      <div className="settings-section-title">{t('setPermission')}</div>
      <div className="text-dim text-xs py-1">{t('setPermissionDesc')}</div>
      <div className="perm-options">
        {select.options.map((option) => {
          const current = option.value === select.currentValue
          return (
            <button
              key={option.value}
              className={`perm-card${current ? ' perm-card-active' : ''}`}
              disabled={current || running}
              title={running ? t('setPermissionRunning') : ''}
              onClick={() => void send(`/permission ${option.value}`)}
            >
              <div className="perm-card-head">
                <span className={`perm-radio${current ? ' perm-radio-on' : ''}`} />
                <span className="perm-name">{option.name}</span>
                {current && <span className="pill provider-active">{t('setPermissionCurrent')}</span>}
              </div>
              {option.description && <div className="perm-desc">{option.description}</div>}
            </button>
          )
        })}
      </div>
      {running && <div className="text-dim text-xs py-1">{t('setPermissionRunning')}</div>}
    </div>
  )
}
