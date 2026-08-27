import { app, BrowserWindow, safeStorage } from 'electron'
import path from 'node:path'
import { makePaths } from './core/paths'
import { Logger } from './services/logger'
import { SettingsService } from './services/settings'
import { RuntimeManager } from './services/runtime'
import { KernelManager } from './services/kernel'
import { DshServerManager } from './services/server'
import { KernelProxyService } from './services/kernel-proxy'
import { ProfileService } from './services/profiles'
import { PluginService } from './services/plugins'
import { SetupService } from './services/setup'
import { WorkspaceService } from './services/workspace'
import { FormatService } from './services/format'
import { GitService } from './services/git'
import { LspService } from './services/lsp'
import { SshService, type CryptoBox } from './services/ssh'
import { CiService } from './services/ci'
import { GithubService } from './services/github'
import { TerminalService } from './services/terminal'
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
  kernelProxy: KernelProxyService
  profiles: ProfileService
  plugins: PluginService
  setup: SetupService
  workspace: WorkspaceService
  format: FormatService
  git: GitService
  lsp: LspService
  ssh: SshService
  ci: CiService
  github: GithubService
  terminal: TerminalService
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
  const kernelProxy = new KernelProxyService(server, logger)
  const profiles = new ProfileService(settings)
  const plugins = new PluginService(settings, runtime, kernel, logger)
  const setup = new SetupService(runtime, kernel, logger)
  const workspace = new WorkspaceService(logger)
  const format = new FormatService(workspace, logger)
  const git = new GitService(workspace, logger)
  const lsp = new LspService(workspace, logger)
  // safeStorage 加密盒在此注入（electron 仅出现在 app/ipc 层，service 保持可测）
  const cryptoBox: CryptoBox = {
    encrypt: (plain) => safeStorage.encryptString(plain).toString('hex'),
    decrypt: (hex) => {
      try { return safeStorage.decryptString(Buffer.from(hex, 'hex')) } catch { return null }
    },
  }
  const ssh = new SshService(paths, cryptoBox, logger)
  const ci = new CiService(workspace, logger)
  const github = new GithubService(workspace, logger)
  const terminal = new TerminalService(workspace, logger)
  const services: Services = { logger, settings, runtime, kernel, server, kernelProxy, profiles, plugins, setup, workspace, format, git, lsp, ssh, ci, github, terminal }
  if (settings.get().ideRoot !== '') void workspace.setRoot(settings.get().ideRoot).catch(() => undefined)

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
      kernelProxy.onStreamEvent((event) => broadcast('event:dsh-stream', event))
      workspace.onDidChange((event) => broadcast('event:ws-change', event))
      lsp.onMessage((message) => broadcast('event:lsp-message', message))
      ssh.onEvent((event) => broadcast('event:ssh', event))
      ci.onEvent((event) => broadcast('event:ci', event))
      terminal.onEvent((event) => broadcast('event:term', event))
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
      await terminal.dispose()
      await ci.dispose()
      await ssh.dispose()
      await lsp.dispose()
      await workspace.dispose()
      await server.dispose()
      logger.close()
    },
  }
}
