import { useState } from 'react'
import { useT } from '../../hooks'
import { PanelHeader } from './PanelHeader'
import { GeneralSettings } from './settings/GeneralSettings'
import { ModelSettings } from './settings/ModelSettings'
import { AgentSettings } from './settings/AgentSettings'
import { PermissionSettings } from './settings/PermissionSettings'
import { useResizableWidth } from '../../lib/resizable'

type Group = 'general' | 'models' | 'agent' | 'permission'

const GROUPS: { id: Group; labelKey: 'settingsGroupGeneral' | 'setModels' | 'setAgent' | 'setPermission' }[] = [
  { id: 'general', labelKey: 'settingsGroupGeneral' },
  { id: 'models', labelKey: 'setModels' },
  { id: 'agent', labelKey: 'setAgent' },
  { id: 'permission', labelKey: 'setPermission' },
]

/** 设置面板：左侧分组导航 + 右侧配置项（占满整页）。 */
export function SettingsPanel() {
  const t = useT()
  const [group, setGroup] = useState<Group>('general')
  const navSplit = useResizableWidth('settings-nav', 168)
  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader title={t('settingsTitle')} />
      <div className="flex-1 flex min-h-0">
        <nav className="settings-nav" style={{ width: navSplit.width }}>
          {GROUPS.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item hoverable${group === item.id ? ' active-nav' : ''}`}
              onClick={() => setGroup(item.id)}
            >
              {t(item.labelKey)}
            </button>
          ))}
        </nav>
        {navSplit.handle}
        <div className="settings-content">
          {group === 'general' && <GeneralSettings />}
          {group === 'models' && <ModelSettings />}
          {group === 'agent' && <AgentSettings />}
          {group === 'permission' && <PermissionSettings />}
        </div>
      </div>
    </div>
  )
}
