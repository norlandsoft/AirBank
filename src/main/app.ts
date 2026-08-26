import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { makePaths } from './core/paths'
import { Logger } from './services/logger'
import { SettingsService } from './services/settings'
import { RuntimeManager } from './services/runtime'
import { KernelManager } from './services/kernel'
import { DshServerManager } from './services/server'
import { ProfileService } from './services/profiles'
import { PluginService } from './services/plugins'
import { SetupService } from './services/setup'
import { registerIpc } from './ipc'
import { createMainWindow } from './window'
import { createTray, type TrayHandle } from './tray'
import { installAppMenu } from './menu'
import type { AppInfo, BootState } from '../shared/types'

export interface Services {
  logger: Logger
  settings: SettingsService
  runtime: RuntimeManager
  kernel: KernelManager
  server: DshServerManager
  profiles: ProfileService
  plugins: PluginService
  setup: SetupService
}

export interface DesktopApp {
  services: Services
  start(): Promise<void>
  focusMainWindow(): void
  wantsTrayStay(): boolean
  dispose(): Promise<void>
}

export function createDesktopApp(): DesktopApp {
  const paths = makePaths(app.getPath('userData'))
  const logger = new Logger(paths.logsDir)
  const settings = new SettingsService(paths)
  settings.load()
  const bundledRuntime = app.isPackaged ? path.join(process.resourcesPath, 'runtime') : null
  const runtime = new RuntimeManager(paths, settings, logger, bundledRuntime)
  const kernel = new KernelManager(paths, settings, runtime, logger)
  const server = new DshServerManager(settings, runtime, kernel, logger)
  const profiles = new ProfileService(settings)
  const plugins = new PluginService(settings, runtime, kernel, logger)
  const setup = new SetupService(runtime, kernel, logger)
  const services: Services = { logger, settings, runtime, kernel, server, profiles, plugins, setup }

  let mainWindow: BrowserWindow | null = null
  let tray: TrayHandle | null = null
  let quitting = false

  const info = (): AppInfo => ({
    appVersion: app.getVersion(),
    electron: process.versions.electron ?? '',
    chrome: process.versions.chrome ?? '',
    node: process.versions.node ?? '',
    platform: process.platform,
    arch: process.arch,
    userData: paths.userData,
    dshHome: settings.effectiveDshHome(),
    logsDir: paths.logsDir,
  })

  const bootState = (): BootState => ({
    settings: settings.get(),
    runtime: runtime.status(),
    kernel: kernel.status(),
    server: server.getStatus(),
  })

  const broadcast = (channel: string, payload: unknown): void => {
    mainWindow?.webContents.send(channel, payload)
  }

  return {
    services,
    async start() {
      installAppMenu({
        onReloadWebview: () => broadcast('menu:reload-webview', null),
        onOpenLogs: () => { void import('electron').then(({ shell }) => shell.openPath(paths.logsDir)) },
      })
      registerIpc({
        services, info, bootState, broadcast,
        getWindow: () => mainWindow,
        quit: () => { quitting = true; app.quit() },
      })
      mainWindow = createMainWindow({
        shouldCloseToTray: () => settings.get().closeToTray && !quitting,
        onClosed: () => { mainWindow = null },
      })
      server.onStatus((status) => broadcast('event:server-status', status))
      logger.onAppend((entry) => broadcast('event:log', entry))
      setup.onPlan((plan) => broadcast('event:install-plan', plan))
      settings.onChange((next) => {
        broadcast('event:settings-changed', next)
        app.setLoginItemSettings({ openAtLogin: next.autoStart })
      })
      tray = createTray({
        onShow: () => { mainWindow?.show(); mainWindow?.focus() },
        onRestart: () => { void server.restart() },
        onQuit: () => { quitting = true; app.quit() },
      })
      app.setLoginItemSettings({ openAtLogin: settings.get().autoStart })
      // 就绪后自动启动服务；未就绪（缺运行时/内核）交给渲染层安装引导驱动。
      const state = bootState()
      if (state.runtime.available && state.runtime.supported && state.kernel.installed) {
        void server.start().catch((error: unknown) => logger.error('server', String(error)))
      }
    },
    focusMainWindow() {
      if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore()
        mainWindow.show()
        mainWindow.focus()
      }
    },
    wantsTrayStay() {
      return settings.get().closeToTray && !quitting
    },
    async dispose() {
      quitting = true
      tray?.destroy()
      await server.dispose()
      logger.close()
    },
  }
}
