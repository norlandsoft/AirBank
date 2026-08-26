import { useApp } from '../store'
import { useT } from '../hooks'
import { IconLogo, IconPlay } from '../icons'

/** 服务停止时的占位页（对话视图）。 */
export function Dashboard() {
  const t = useT()
  const server = useApp((state) => state.server)
  const starting = server?.state === 'starting'
  return (
    <div className="flex-1 surface flex items-center justify-center">
      <div className="text-center max-w-[420px] px-6">
        <div className="flex justify-center mb-4"><IconLogo size={52} /></div>
        <h1 className="text-xl font-semibold mb-2">{t('dashboardTitle')}</h1>
        <p className="text-dim text-[13px] leading-relaxed mb-5">{t('dashboardDesc')}</p>
        {server?.detail && <p className="text-[var(--err)] text-xs mb-3 select-text">{server.detail}</p>}
        <button className="btn btn-primary !px-5 !py-2 !text-[13px]" disabled={starting} onClick={() => void useApp.getState().startServer()}>
          <IconPlay size={13} /> {starting ? t('serverStarting') : t('startServer')}
        </button>
      </div>
    </div>
  )
}
