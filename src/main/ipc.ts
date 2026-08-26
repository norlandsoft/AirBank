import { ipcMain, shell, BrowserWindow } from 'electron'
import fs from 'node:fs'
import type { Services } from './app'
import { Ipc } from '../shared/ipc'
import type { AppInfo, AppSettings, BootState } from '../shared/types'

export interface IpcContext {
  services: Services
  info(): AppInfo
  bootState(): BootState
  broadcast(channel: string, payload: unknown): void
  getWindow(): BrowserWindow | null
  quit(): void
}

type Handler = (...args: any[]) => unknown

/** 注册全部 invoke 通道；服务层抛出的 Error 消息原样返回渲染层展示。 */
export function registerIpc(ctx: IpcContext): void {
  const { services } = ctx
  const handle = (channel: string, fn: Handler): void => {
    ipcMain.handle(channel, async (_event, ...args) => fn(...args))
  }

  handle(Ipc.appInfo, () => ctx.info())
  handle(Ipc.bootState, () => ctx.bootState())
  handle(Ipc.settingsGet, () => services.settings.get())
  handle(Ipc.settingsPatch, (partial: Partial<AppSettings>) => services.settings.patch(partial))
  handle(Ipc.setupRun, () => services.setup.run())
  handle(Ipc.setupSnapshot, () => services.setup.snapshot())

  handle(Ipc.serverStatus, () => services.server.getStatus())
  handle(Ipc.serverStart, () => services.server.start())
  handle(Ipc.serverStop, () => services.server.stop())
  handle(Ipc.serverRestart, () => services.server.restart())

  handle(Ipc.runtimeStatus, () => services.runtime.status())
  handle(Ipc.runtimeInstall, async () => {
    const status = await services.runtime.install(() => undefined)
    ctx.broadcast('event:runtime-changed', status)
    return status
  })

  handle(Ipc.kernelStatus, () => services.kernel.status())
  handle(Ipc.kernelInstall, async () => {
    const status = await services.kernel.install(() => undefined)
    ctx.broadcast('event:kernel-changed', status)
    return status
  })
  handle(Ipc.kernelCores, () => services.kernel.cores())
  handle(Ipc.kernelActivateCore, (id: string) => {
    services.kernel.activateCore(id)
    ctx.broadcast('event:kernel-changed', services.kernel.status())
    return services.kernel.cores()
  })
  handle(Ipc.kernelRemoveCore, (id: string) => {
    services.kernel.removeCore(id)
    return services.kernel.cores()
  })
  handle(Ipc.kernelLatestVersion, () => services.kernel.latestVersion())

  handle(Ipc.profilesList, () => services.profiles.list())
  handle(Ipc.profilesCreate, (name: string) => services.profiles.create(name))
  handle(Ipc.profilesRemove, (name: string) => services.profiles.remove(name))
  handle(Ipc.profilesActivate, (name: string) => services.profiles.activate(name))

  handle(Ipc.pluginsList, (profile: string) => services.plugins.list(profile))
  handle(Ipc.pluginsAdd, (profile: string, spec: string) => services.plugins.add(profile, spec))
  handle(Ipc.pluginsRemove, (profile: string, name: string) => services.plugins.remove(profile, name))

  handle(Ipc.logsGet, () => services.logger.entries())
  handle(Ipc.logsClear, () => services.logger.clear())

  handle(Ipc.windowMinimize, () => ctx.getWindow()?.minimize())
  handle(Ipc.windowMaximize, () => {
    const win = ctx.getWindow()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  handle(Ipc.windowClose, () => ctx.getWindow()?.close())

  handle(Ipc.shellOpenExternal, async (url: string) => {
    if (!/^https?:\/\//i.test(url)) throw new Error('only http(s) URLs may be opened')
    await shell.openExternal(url)
  })
  handle(Ipc.shellShowItem, (target: string) => {
    if (!fs.existsSync(target)) throw new Error(`path does not exist: ${target}`)
    shell.showItemInFolder(target)
  })

  handle(Ipc.appQuit, () => ctx.quit())
}
