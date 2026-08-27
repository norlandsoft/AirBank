import { create } from 'zustand'
import { bridge } from './bridge'
import type {
  AppInfo, AppSettings, InstallPlan, KernelStatus, LogEntry,
  RuntimeStatus, ServerStatus,
} from '../../shared/types'

export type View = 'chat' | 'ide' | 'git' | 'servers' | 'cicd' | 'profiles' | 'plugins' | 'cores' | 'logs' | 'settings' | 'about'

interface AppState {
  ready: boolean
  info: AppInfo | null
  settings: AppSettings | null
  runtime: RuntimeStatus | null
  kernel: KernelStatus | null
  server: ServerStatus | null
  installPlan: InstallPlan | null
  installRunning: boolean
  view: View
  logs: LogEntry[]
  toast: string | null
  nativeDark: boolean

  init(): Promise<void>
  setView(view: View): void
  showToast(message: string): void
  patchSettings(partial: Partial<AppSettings>): Promise<void>
  refreshKernel(): Promise<void>
  refreshRuntime(): Promise<void>
  startServer(): Promise<void>
  stopServer(): Promise<void>
  restartServer(): Promise<void>
  runSetup(): Promise<void>
  reportError(error: unknown): void
}

const MAX_LOGS = 800

export const useApp = create<AppState>((set, get) => ({
  ready: false,
  info: null,
  settings: null,
  runtime: null,
  kernel: null,
  server: null,
  installPlan: null,
  installRunning: false,
  view: 'chat',
  logs: [],
  toast: null,
  nativeDark: window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true,

  async init() {
    const [info, boot] = await Promise.all([bridge.info(), bridge.bootState()])
    set({ info, settings: boot.settings, runtime: boot.runtime, kernel: boot.kernel, server: boot.server, ready: true })
    bridge.onServerStatus((server) => set({ server }))
    bridge.onKernelChanged((kernel) => set({ kernel }))
    bridge.onRuntimeChanged((runtime) => set({ runtime }))
    bridge.onSettingsChanged((settings) => set({ settings }))
    bridge.onInstallPlan((installPlan) => set({ installPlan }))
    bridge.onNativeTheme((theme) => set({ nativeDark: theme === 'dark' }))
    bridge.onLog((entry) => set((state) => ({ logs: [...state.logs.slice(-MAX_LOGS), entry] })))
    const logs = await bridge.logs.get()
    set({ logs: logs.slice(-MAX_LOGS) })
  },

  setView(view) { set({ view }) },

  showToast(message) {
    set({ toast: message })
    setTimeout(() => { if (get().toast === message) set({ toast: null }) }, 2600)
  },

  async patchSettings(partial) {
    const settings = await bridge.patchSettings(partial)
    set({ settings })
  },

  async refreshKernel() { set({ kernel: await bridge.kernel.status() }) },
  async refreshRuntime() { set({ runtime: await bridge.runtime.status() }) },

  async startServer() {
    try {
      set({ server: await bridge.server.start() })
    } catch (error) { get().reportError(error) }
  },
  async stopServer() {
    try {
      set({ server: await bridge.server.stop() })
    } catch (error) { get().reportError(error) }
  },
  async restartServer() {
    try {
      set({ server: await bridge.server.restart() })
    } catch (error) { get().reportError(error) }
  },

  async runSetup() {
    if (get().installRunning) return
    set({ installRunning: true })
    try {
      const installPlan = await bridge.setupRun()
      set({ installPlan, kernel: await bridge.kernel.status(), runtime: await bridge.runtime.status() })
      if (installPlan.done) await get().startServer()
    } catch (error) {
      get().reportError(error)
    } finally {
      set({ installRunning: false })
    }
  },

  reportError(error) {
    const message = error instanceof Error ? error.message : String(error)
    // Electron IPC 会把 Error 包成 "Error invoking remote method ...: Error: ..."
    const cleaned = message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '')
    get().showToast(cleaned)
  },
}))

/** 生效主题：settings.theme=system 时跟随系统。 */
export function effectiveTheme(settings: AppSettings | null, nativeDark: boolean): 'dark' | 'light' {
  if (!settings || settings.theme === 'system') return nativeDark ? 'dark' : 'light'
  return settings.theme
}
