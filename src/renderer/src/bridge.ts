import type { DesktopApi } from '../../shared/api'
import type {
  AppInfo, AppSettings, BootState, CoreInfo, InstallPlan, KernelStatus,
  LogEntry, PluginInfo, ProfileInfo, RuntimeStatus, ServerStatus,
} from '../../shared/types'

declare global {
  interface Window {
    dshDesktop?: DesktopApi
  }
}

/** 浏览器纯 vite dev 兜底：无 preload 时返回空态 mock，保证页面可渲染。 */
function mockApi(): DesktopApi {
  const server: ServerStatus = { state: 'stopped', url: null, port: null, pid: null, profile: null, detail: null }
  const runtime: RuntimeStatus = { available: false, source: null, path: null, version: null, supported: false }
  const kernel: KernelStatus = { installed: false, source: null, dir: null, binPath: null, version: null }
  const settings: AppSettings = {
    locale: 'zh-CN', theme: 'dark', port: 3080, dshHome: '', kernelDir: null, nodePath: null,
    useMirror: false, autoStart: false, closeToTray: true, activeProfile: 'web',
  }
  const info: AppInfo = {
    appVersion: 'dev', electron: '', chrome: '', node: '', platform: 'darwin', arch: 'arm64',
    userData: '', dshHome: '', logsDir: '',
  }
  const noop = () => undefined
  const boot: BootState = { settings, runtime, kernel, server }
  return {
    platform: 'darwin',
    info: async () => info,
    bootState: async () => boot,
    getSettings: async () => settings,
    patchSettings: async (partial) => ({ ...settings, ...partial }),
    setupRun: async (): Promise<InstallPlan> => ({ steps: [], active: false, done: true, error: null }),
    setupSnapshot: async () => null,
    server: { status: async () => server, start: async () => server, stop: async () => server, restart: async () => server },
    runtime: { status: async () => runtime, install: async () => runtime },
    kernel: {
      status: async () => kernel, install: async () => kernel,
      cores: async (): Promise<CoreInfo[]> => [],
      activateCore: async (): Promise<CoreInfo[]> => [],
      removeCore: async (): Promise<CoreInfo[]> => [],
      latestVersion: async () => null,
    },
    profiles: {
      list: async (): Promise<ProfileInfo[]> => [],
      create: async (): Promise<ProfileInfo[]> => [],
      remove: async (): Promise<ProfileInfo[]> => [],
      activate: async (): Promise<ProfileInfo[]> => [],
    },
    plugins: {
      list: async (): Promise<PluginInfo[]> => [],
      add: async (): Promise<PluginInfo[]> => [],
      remove: async (): Promise<PluginInfo[]> => [],
    },
    logs: { get: async (): Promise<LogEntry[]> => [], clear: async () => undefined },
    window: { minimize: async () => undefined, maximize: async () => undefined, close: async () => undefined },
    shell: { openExternal: async () => undefined, showItem: async () => undefined },
    quit: async () => undefined,
    onServerStatus: () => noop,
    onLog: () => noop,
    onInstallPlan: () => noop,
    onKernelChanged: () => noop,
    onRuntimeChanged: () => noop,
    onSettingsChanged: () => noop,
    onNativeTheme: () => noop,
    onMenuReloadWebview: () => noop,
  }
}

export const bridge: DesktopApi = window.dshDesktop ?? mockApi()
export const inElectron = window.dshDesktop !== undefined