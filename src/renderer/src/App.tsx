import { useEffect, useRef } from 'react'
import { useApp } from './store'
import { useApplyTheme } from './hooks'
import { bridge } from './bridge'
import { TitleBar } from './components/TitleBar'
import { Sidebar } from './components/Sidebar'
import { SetupView } from './components/SetupView'
import { Dashboard } from './components/Dashboard'
import { WebviewPane, type WebviewHandle } from './components/WebviewPane'
import { ProfilesPanel } from './components/panels/ProfilesPanel'
import { PluginsPanel } from './components/panels/PluginsPanel'
import { CoresPanel } from './components/panels/CoresPanel'
import { LogsPanel } from './components/panels/LogsPanel'
import { SettingsPanel } from './components/panels/SettingsPanel'
import { AboutPanel } from './components/panels/AboutPanel'
import { IconSpinner } from './icons'

function Toast() {
  const toast = useApp((state) => state.toast)
  if (!toast) return null
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 card !py-2 !px-4 text-[12.5px] shadow-lg max-w-[70%] select-text">
      {toast}
    </div>
  )
}

export default function App() {
  const { ready, runtime, kernel, server, view } = useApp()
  const webviewRef = useRef<WebviewHandle | null>(null)
  useApplyTheme()

  useEffect(() => {
    void useApp.getState().init()
    const unsub = bridge.onMenuReloadWebview(() => webviewRef.current?.reload())
    return unsub
  }, [])

  if (!ready) {
    return (
      <div className="h-full surface flex items-center justify-center">
        <IconSpinner size={24} />
      </div>
    )
  }

  const needsSetup = (runtime !== null && (!runtime.available || !runtime.supported))
    || (kernel !== null && !kernel.installed)
  const running = server?.state === 'running' && server.url

  return (
    <div className="h-full surface flex flex-col">
      <TitleBar onReloadWebview={() => webviewRef.current?.reload()} />
      <div className="flex-1 flex min-h-0">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0">
          {needsSetup ? (
            <SetupView />
          ) : view === 'chat' ? (
            running ? <WebviewPane ref={webviewRef} url={server.url as string} /> : <Dashboard />
          ) : view === 'profiles' ? (
            <ProfilesPanel />
          ) : view === 'plugins' ? (
            <PluginsPanel />
          ) : view === 'cores' ? (
            <CoresPanel />
          ) : view === 'logs' ? (
            <LogsPanel />
          ) : view === 'settings' ? (
            <SettingsPanel />
          ) : (
            <AboutPanel />
          )}
        </main>
      </div>
      <Toast />
    </div>
  )
}
