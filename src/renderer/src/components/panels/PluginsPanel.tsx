import { useEffect, useState } from 'react'
import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import type { PluginInfo } from '../../../../shared/types'
import { PanelHeader } from './PanelHeader'
import { IconTrash, IconPlus, IconSpinner } from '../../icons'

/** 插件管理：当前档案的依赖列表 / 安装 / 卸载。 */
export function PluginsPanel() {
  const t = useT()
  const settings = useApp((state) => state.settings)
  const profile = settings?.activeProfile ?? 'web'
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [spec, setSpec] = useState('')
  const [busy, setBusy] = useState(false)
  const reportError = useApp((state) => state.reportError)

  const refresh = (): void => { void bridge.plugins.list(profile).then(setPlugins).catch(reportError) }
  useEffect(refresh, [profile, reportError])

  const add = async (): Promise<void> => {
    if (!spec.trim() || busy) return
    setBusy(true)
    try {
      setPlugins(await bridge.plugins.add(profile, spec))
      setSpec('')
    } catch (error) { reportError(error) } finally { setBusy(false) }
  }

  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader
        title={`${t('pluginsTitle')} · ${profile}`} desc={t('pluginsDesc')}
        actions={(
          <div className="flex gap-1.5">
            <input className="input !w-56" placeholder={t('pluginSpec')} value={spec}
              onChange={(event) => setSpec(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') void add() }} />
            <button className="btn btn-primary" disabled={busy} onClick={() => void add()}>
              {busy ? <IconSpinner size={13} /> : <IconPlus size={13} />} {t('addPlugin')}
            </button>
          </div>
        )}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {plugins.map((plugin) => (
          <div key={plugin.name} className="card flex items-center gap-3 !py-3">
            <span className="font-medium text-[13px] select-text">{plugin.name}</span>
            <span className="pill text-[10.5px]">{plugin.version}</span>
            <div className="flex-1" />
            <button className="btn btn-danger" disabled={busy} onClick={async () => {
              if (!window.confirm(`${plugin.name}: ${t('uninstall')}?`)) return
              setBusy(true)
              try { setPlugins(await bridge.plugins.remove(profile, plugin.name)) } catch (error) { reportError(error) } finally { setBusy(false) }
            }}><IconTrash size={13} /> {t('uninstall')}</button>
          </div>
        ))}
        {plugins.length === 0 && <div className="text-dim text-xs">{t('noPlugins')}</div>}
      </div>
    </div>
  )
}
