import { useApp } from '../../store'
import { useT } from '../../hooks'
import { bridge } from '../../bridge'
import { PanelHeader } from './PanelHeader'
import { IconLogo, IconExternal } from '../../icons'

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex gap-4 py-2 border-b bordered last:border-b-0 text-[12.5px]">
      <span className="w-40 text-dim flex-shrink-0">{label}</span>
      <span className={`select-text break-all ${mono ? 'log-console' : ''}`}>{value}</span>
    </div>
  )
}

/** 关于面板：版本矩阵 + 目录入口。 */
export function AboutPanel() {
  const t = useT()
  const { info, kernel, runtime, reportError } = useApp()
  if (!info) return null
  return (
    <div className="flex-1 surface flex flex-col min-h-0">
      <PanelHeader
        title={t('aboutTitle')}
        actions={(
          <button className="btn" onClick={() => void bridge.shell.openExternal('https://github.com/deepseek-ai/deepseek-harness').catch(reportError)}>
            <IconExternal size={13} /> {t('homepage')}
          </button>
        )}
      />
      <div className="flex-1 overflow-y-auto px-6 py-4 max-w-[760px]">
        <div className="flex items-center gap-3 mb-4">
          <IconLogo size={40} />
          <div>
            <div className="font-semibold text-[15px]">DeepSeek Harness Desktop</div>
            <div className="text-dim text-xs">v{info.appVersion}</div>
          </div>
        </div>
        <div className="card !p-2">
          <InfoRow label="Electron" value={info.electron || '-'} mono />
          <InfoRow label="Chromium" value={info.chrome || '-'} mono />
          <InfoRow label="Node" value={info.node || '-'} mono />
          <InfoRow label="dsh Kernel" value={kernel?.version ?? '-'} mono />
          <InfoRow label="Node Runtime" value={runtime?.version ? `${runtime.version} (${runtime.source ?? '-'})` : '-'} mono />
          <InfoRow label="Platform" value={`${info.platform} / ${info.arch}`} mono />
          <InfoRow label={t('dataDir')} value={info.userData} mono />
          <InfoRow label="DSH_HOME" value={info.dshHome} mono />
        </div>
        <div className="mt-3 flex gap-2">
          <button className="btn" onClick={() => void bridge.shell.showItem(info.userData).catch(reportError)}>{t('openDataDir')}</button>
          <button className="btn btn-danger" onClick={() => void bridge.quit()}>{t('quit')}</button>
        </div>
      </div>
    </div>
  )
}
