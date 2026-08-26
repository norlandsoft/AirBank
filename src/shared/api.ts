import type {
  AppInfo, AppSettings, BootState, CoreInfo, InstallPlan, KernelStatus, LogEntry,
  PluginInfo, ProfileInfo, RuntimeStatus, ServerStatus,
} from './types'

/** preload 暴露到 window.dshDesktop 的完整 API 形状。 */
export interface DesktopApi {
  platform: NodeJS.Platform
  info(): Promise<AppInfo>
  bootState(): Promise<BootState>
  getSettings(): Promise<AppSettings>
  patchSettings(partial: Partial<AppSettings>): Promise<AppSettings>
  setupRun(): Promise<InstallPlan>
  setupSnapshot(): Promise<InstallPlan | null>
  server: {
    status(): Promise<ServerStatus>
    start(): Promise<ServerStatus>
    stop(): Promise<ServerStatus>
    restart(): Promise<ServerStatus>
  }
  runtime: {
    status(): Promise<RuntimeStatus>
    install(): Promise<RuntimeStatus>
  }
  kernel: {
    status(): Promise<KernelStatus>
    install(): Promise<KernelStatus>
    cores(): Promise<CoreInfo[]>
    activateCore(id: string): Promise<CoreInfo[]>
    removeCore(id: string): Promise<CoreInfo[]>
    latestVersion(): Promise<string | null>
  }
  profiles: {
    list(): Promise<ProfileInfo[]>
    create(name: string): Promise<ProfileInfo[]>
    remove(name: string): Promise<ProfileInfo[]>
    activate(name: string): Promise<ProfileInfo[]>
  }
  plugins: {
    list(profile: string): Promise<PluginInfo[]>
    add(profile: string, spec: string): Promise<PluginInfo[]>
    remove(profile: string, name: string): Promise<PluginInfo[]>
  }
  logs: {
    get(): Promise<LogEntry[]>
    clear(): Promise<void>
  }
  window: {
    minimize(): Promise<void>
    maximize(): Promise<void>
    close(): Promise<void>
  }
  shell: {
    openExternal(url: string): Promise<void>
    showItem(path: string): Promise<void>
  }
  quit(): Promise<void>
  onServerStatus(listener: (status: ServerStatus) => void): () => void
  onLog(listener: (entry: LogEntry) => void): () => void
  onInstallPlan(listener: (plan: InstallPlan) => void): () => void
  onKernelChanged(listener: (status: KernelStatus) => void): () => void
  onRuntimeChanged(listener: (status: RuntimeStatus) => void): () => void
  onSettingsChanged(listener: (settings: AppSettings) => void): () => void
  onNativeTheme(listener: (theme: 'dark' | 'light') => void): () => void
  onMenuReloadWebview(listener: () => void): () => void
}