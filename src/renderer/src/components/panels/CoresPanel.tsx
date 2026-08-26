import { useEffect, useState } from 'react'
import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import type { CoreInfo } from '../../../../shared/types'
import { PanelHeader } from './PanelHeader'
import { IconTrash, IconCheck, IconDownload, IconSpinner } from '../../icons'

/** 核心管理：多版本内核列表 / 安装最新 / 切换 / 卸载。 */
export function CoresPanel() {
  const t = useT()
  const kernel = useApp((state) => state.kernel)
  const reportError = useApp((state) => state.reportError)
  const [cores, setCores] = useState<CoreInfo[]>([])
  const [latest, setLatest] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = (): void => {
    void bridge.kernel.cores().then(setCores).catch(reportError)
    void bridge.kernel.latestVersion().then(setLatest).catch(() => undefined)
  }
  useEffect(refresh, [kernel?.dir, reportError])

  const installLatest = async (): Promise<void> => {
    setBusy(true)
    try {
      await useApp.getState().runSetup()
      refresh()
    } finally { setBusy(false) }
  }

  const current = kernel?.version ?? null
  const hasUpdate = latest !== null && current !== null && latest !== current

  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader
        title={t('coresTitle')} desc={t('coresDesc')}
        actions={(
          <div className="flex items-center gap-2">
            {latest && (
              <span className={`pill ${hasUpdate ? '!text-[var(--warn)]' : ''}`}>
                {hasUpdate ? `${t('updateAvailable')}: ${latest}` : `${t('upToDate')} (${latest})`}
              </span>
            )}
            <button className="btn btn-primary" disabled={busy} onClick={() => void installLatest()}>
              {busy ? <IconSpinner size={13} /> : <IconDownload size={13} />} {t('installLatest')}
            </button>
          </div>
        )}
      />
      <div className="flex-1 overflow-y-auto p-6 space-y-2">
        {kernel && kernel.installed && kernel.source !== 'core' && (
          <div className="card flex items-center gap-3 !py-3">
            <span className="dot dot-ok" />
            <span className="font-medium text-[13px]">dsh {kernel.version ?? t('unknown')}</span>
            <span className="pill text-[10.5px]">{kernel.source}</span>
            <span className="text-dim text-[11px] truncate select-text">{kernel.dir}</span>
          </div>
        )}
        {cores.map((core) => (
          <div key={core.id} className="card flex items-center gap-3 !py-3">
            <span className={core.active ? 'dot dot-ok' : 'dot dot-off'} />
            <span className="font-medium text-[13px]">dsh {core.version}</span>
            {core.active && <span className="pill text-[10.5px]">{t('active')}</span>}
            <span className="text-dim text-[11px] truncate select-text">{core.dir}</span>
            <div className="flex-1" />
            {!core.active && (
              <>
                <button className="btn" onClick={async () => {
                  try { setCores(await bridge.kernel.activateCore(core.id)) } catch (error) { reportError(error) }
                }}><IconCheck size={13} /> {t('activate')}</button>
                <button className="btn btn-danger" onClick={async () => {
                  if (!window.confirm(`${core.version}: ${t('confirmDelete')}`)) return
                  try { setCores(await bridge.kernel.removeCore(core.id)) } catch (error) { reportError(error) }
                }}><IconTrash size={13} /> {t('delete')}</button>
              </>
            )}
          </div>
        ))}
        {cores.length === 0 && (!kernel || !kernel.installed) && (
          <div className="text-dim text-xs">{t('kernelMissing')}</div>
        )}
      </div>
    </div>
  )
}
