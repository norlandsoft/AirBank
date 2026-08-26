import { contextBridge, ipcRenderer } from 'electron'
import { Ipc, Events } from '../shared/ipc'
import type { DesktopApi } from '../shared/api'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<T> =>
  ipcRenderer.invoke(channel, ...args) as Promise<T>

const on = <T>(channel: string, listener: (payload: T) => void): (() => void) => {
  const wrapped = (_event: Electron.IpcRendererEvent, payload: T): void => listener(payload)
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: DesktopApi = {
  platform: process.platform,
  info: () => invoke(Ipc.appInfo),
  bootState: () => invoke(Ipc.bootState),
  getSettings: () => invoke(Ipc.settingsGet),
  patchSettings: (partial) => invoke(Ipc.settingsPatch, partial),
  setupRun: () => invoke(Ipc.setupRun),
  setupSnapshot: () => invoke(Ipc.setupSnapshot),
  server: {
    status: () => invoke(Ipc.serverStatus),
    start: () => invoke(Ipc.serverStart),
    stop: () => invoke(Ipc.serverStop),
    restart: () => invoke(Ipc.serverRestart),
  },
  runtime: {
    status: () => invoke(Ipc.runtimeStatus),
    install: () => invoke(Ipc.runtimeInstall),
  },
  kernel: {
    status: () => invoke(Ipc.kernelStatus),
    install: () => invoke(Ipc.kernelInstall),
    cores: () => invoke(Ipc.kernelCores),
    activateCore: (id) => invoke(Ipc.kernelActivateCore, id),
    removeCore: (id) => invoke(Ipc.kernelRemoveCore, id),
    latestVersion: () => invoke(Ipc.kernelLatestVersion),
  },
  profiles: {
    list: () => invoke(Ipc.profilesList),
    create: (name) => invoke(Ipc.profilesCreate, name),
    remove: (name) => invoke(Ipc.profilesRemove, name),
    activate: (name) => invoke(Ipc.profilesActivate, name),
  },
  plugins: {
    list: (profile) => invoke(Ipc.pluginsList, profile),
    add: (profile, spec) => invoke(Ipc.pluginsAdd, profile, spec),
    remove: (profile, name) => invoke(Ipc.pluginsRemove, profile, name),
  },
  logs: {
    get: () => invoke(Ipc.logsGet),
    clear: () => invoke(Ipc.logsClear),
  },
  window: {
    minimize: () => invoke(Ipc.windowMinimize),
    maximize: () => invoke(Ipc.windowMaximize),
    close: () => invoke(Ipc.windowClose),
  },
  shell: {
    openExternal: (url) => invoke(Ipc.shellOpenExternal, url),
    showItem: (target) => invoke(Ipc.shellShowItem, target),
  },
  quit: () => invoke(Ipc.appQuit),
  onServerStatus: (listener) => on(Events.serverStatus, listener),
  onLog: (listener) => on(Events.log, listener),
  onInstallPlan: (listener) => on(Events.installPlan, listener),
  onKernelChanged: (listener) => on(Events.kernelChanged, listener),
  onRuntimeChanged: (listener) => on(Events.runtimeChanged, listener),
  onSettingsChanged: (listener) => on(Events.settingsChanged, listener),
  onNativeTheme: (listener) => on(Events.nativeTheme, listener),
  onMenuReloadWebview: (listener) => on(Events.menuReloadWebview, listener),
}

contextBridge.exposeInMainWorld('dshDesktop', api)