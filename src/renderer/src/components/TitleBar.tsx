import { useApp } from '../store'
import { useT } from '../hooks'
import { bridge, inElectron } from '../bridge'
import { IconMinimize, IconMaximize, IconClose, IconExternal, IconCommand, IconLogo } from '../icons'

/** 状态点颜色映射。 */
export function dotClass(state: string | undefined): string {
  switch (state) {
    case 'running': return 'dot dot-ok'
    case 'starting': case 'stopping': return 'dot dot-warn'
    case 'error': case 'unhealthy': return 'dot dot-err'
    default: return 'dot dot-off'
  }
}

/** 顶部标题栏：可拖拽，左侧状态，中部 ⌘K 入口，右侧窗口控制（非 macOS 自绘）。 */
export function TitleBar({ onOpenPalette }: { onOpenPalette(): void }) {
  const t = useT()
  const server = useApp((state) => state.server)
  const view = useApp((state) => state.view)
  const isMac = bridge.platform === 'darwin'
  const stateText: Record<string, string> = {
    running: t('serverRunning'), stopped: t('serverStopped'), starting: t('serverStarting'),
    stopping: t('serverStopping'), unhealthy: t('serverUnhealthy'), error: t('serverError'),
  }
  return (
    <div className="titlebar">
      <div className="flex items-center gap-2" style={{ paddingLeft: isMac ? 66 : 2 }}>
        <span className="titlebar-brand titlebar-no-drag"><IconLogo size={18} /><span className="titlebar-name">AirCode</span></span>
        <span className="pill titlebar-no-drag">
          <span className={dotClass(server?.state)} />
          {stateText[server?.state ?? 'stopped'] ?? server?.state}
        </span>
        {server?.url && view === 'chat' && (
          <span className="text-dim text-xs titlebar-no-drag select-text">{server.url}</span>
        )}
      </div>
      <div className="flex-1" />
      <button className="btn titlebar-no-drag palette-trigger" onClick={onOpenPalette} title="⌘K">
        <IconCommand size={12} /> K
      </button>
      <div className="flex-1" />
      <div className="flex items-center gap-1 titlebar-no-drag">
        {server?.url && view === 'chat' && (
          <button className="btn-ghost btn !px-2" title={t('openInBrowser')} onClick={() => void bridge.shell.openExternal(server.url as string)}><IconExternal /></button>
        )}
        {!isMac && inElectron && (
          <>
            <button className="btn-ghost btn !px-2" title={t('minimize')} onClick={() => void bridge.window.minimize()}><IconMinimize /></button>
            <button className="btn-ghost btn !px-2" title={t('maximize')} onClick={() => void bridge.window.maximize()}><IconMaximize /></button>
            <button className="btn-ghost btn !px-2 hover:!bg-red-500 hover:!text-white" title={t('close')} onClick={() => void bridge.window.close()}><IconClose /></button>
          </>
        )}
      </div>
    </div>
  )
}
