import { useEffect, useState } from 'react'
import { useApp } from './store'
import { useApplyTheme } from './hooks'
import { TitleBar } from './components/TitleBar'
import { SetupView } from './components/SetupView'
import { Dashboard } from './components/Dashboard'
import { AgentPanel } from './modules/agent/AgentPanel'
import { useAgent } from './modules/agent/store'
import { IdePanel } from './modules/ide/IdePanel'
import { useIde } from './modules/ide/store'
import { GitPanel } from './modules/git/GitPanel'
import { useGit } from './modules/git/store'
import { ServersPanel } from './modules/servers/ServersPanel'
import { CicdPanel } from './modules/cicd/CicdPanel'
import { useCicd } from './modules/cicd/store'
import { ActivityBar } from './app/ActivityBar'
import { StatusBar } from './app/StatusBar'
import { BottomPanel } from './app/BottomPanel'
import { useTerminal } from './stores/terminal'
import { CommandPalette } from './app/CommandPalette'
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
  const bottomOpen = useTerminal((state) => state.bottomOpen)
  const [paletteOpen, setPaletteOpen] = useState(false)
  useApplyTheme()

  useEffect(() => {
    void useApp.getState().init()
    void useIde.getState().init()
  }, [])

  // IDE root 就绪后预热 Git 状态（状态栏分支显示）与 GitHub 仓库（CI 徽标）
  const ideRoot = useIde((state) => state.root)
  useEffect(() => {
    if (ideRoot) {
      void useGit.getState().refresh()
      void useCicd.getState().refreshGithub()
    }
  }, [ideRoot])

  // ⌘K 命令面板 / ⌘J 底部面板
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((v) => !v)
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'j') {
        event.preventDefault()
        useTerminal.getState().toggleBottom()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // 自建会话连接生命周期：服务运行 → 连；停止 → 断（切视图不断流）
  const serverUrl = server?.state === 'running' && server.url ? server.url : null
  useEffect(() => {
    const agent = useAgent.getState()
    if (serverUrl) agent.connect(serverUrl)
    else agent.disconnect()
  }, [serverUrl])

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
      <TitleBar onOpenPalette={() => setPaletteOpen(true)} />
      <div className="flex-1 flex min-h-0">
        <ActivityBar />
        <main className="flex-1 flex flex-col min-w-0">
          {needsSetup ? (
            <SetupView />
          ) : view === 'chat' ? (
            !running ? <Dashboard /> : <AgentPanel />
          ) : view === 'ide' ? (
            <IdePanel />
          ) : view === 'git' ? (
            <GitPanel />
          ) : view === 'servers' ? (
            <ServersPanel />
          ) : view === 'cicd' ? (
            <CicdPanel />
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
      {bottomOpen && <BottomPanel />}
      <StatusBar />
      <Toast />
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  )
}
