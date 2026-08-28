import { ipcMain, shell, BrowserWindow, dialog } from 'electron'
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

  handle(Ipc.dshRpc, (method: string, payload: unknown) => services.kernelProxy.rpc(method, payload))
  handle(Ipc.dshRespond, (rpcId: string, result: Parameters<typeof services.kernelProxy.respond>[1]) =>
    services.kernelProxy.respond(rpcId, result))
  handle(Ipc.dshStreamOpen, (kind: 'mux' | 'host') => services.kernelProxy.openStream(kind))
  handle(Ipc.dshStreamClose, (kind: 'mux' | 'host') => services.kernelProxy.closeStream(kind))

  handle(Ipc.wsRoot, () => services.workspace.getRoot())
  handle(Ipc.wsSetRoot, async (dir: string | null) => {
    await services.workspace.setRoot(dir)
    await services.settings.patch({ ideRoot: dir ?? '' })
  })
  handle(Ipc.wsPickRoot, async () => {
    const win = ctx.getWindow()
    const options = { properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    const dir = result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
    if (dir !== null) {
      await services.workspace.setRoot(dir)
      await services.settings.patch({ ideRoot: dir })
    }
    return dir
  })
  handle(Ipc.wsList, (rel?: string) => services.workspace.list(rel))
  handle(Ipc.wsRead, (rel: string) => services.workspace.readFile(rel))
  handle(Ipc.wsWrite, (rel: string, content: string) => services.workspace.writeFile(rel, content))
  handle(Ipc.wsWalk, () => services.workspace.walk())
  handle(Ipc.wsFormat, (rel: string, content: string) => services.format.format(rel, content))

  handle(Ipc.gitStatus, () => services.git.status())
  handle(Ipc.gitDiff, (relPath: string | null, staged: boolean) => services.git.diff(relPath, staged))
  handle(Ipc.gitStage, (paths: string[]) => services.git.stage(paths))
  handle(Ipc.gitUnstage, (paths: string[]) => services.git.unstage(paths))
  handle(Ipc.gitCommit, (message: string) => services.git.commit(message))
  handle(Ipc.gitLog, (limit?: number) => services.git.log(limit ?? 10))
  handle(Ipc.gitBranches, () => services.git.branches())
  handle(Ipc.gitCheckout, (name: string) => services.git.checkout(name))
  handle(Ipc.gitCreateBranch, (name: string) => services.git.createBranch(name))
  handle(Ipc.gitRepos, () => services.git.repos())
  handle(Ipc.gitAddRepo, (dir: string) => services.git.addRepo(dir))
  handle(Ipc.gitCloneRepo, (url: string, parentDir: string) => services.git.cloneRepo(url, parentDir))
  handle(Ipc.gitRemoveRepo, (dir: string) => services.git.removeRepo(dir))
  handle(Ipc.gitActivateRepo, (dir: string | null) => services.git.activateRepo(dir))
  handle(Ipc.gitFetch, () => services.git.fetch())
  handle(Ipc.gitPull, () => services.git.pull())
  handle(Ipc.gitPush, () => services.git.push())
  handle(Ipc.gitDiscard, (paths: string[]) => services.git.discard(paths))
  handle(Ipc.gitCommitFiles, (hash: string) => services.git.commitFiles(hash))
  handle(Ipc.gitCommitDiff, (hash: string, relPath?: string) => services.git.commitDiff(hash, relPath))

  handle(Ipc.lspEnsure, () => services.lsp.ensure())
  handle(Ipc.lspSend, (message: string) => services.lsp.send(message))

  handle(Ipc.sshList, () => services.ssh.list())
  handle(Ipc.sshAdd, (input: Parameters<typeof services.ssh.add>[0], secret?: string) => services.ssh.add(input, secret))
  handle(Ipc.sshUpdate, (id: string, patch: Parameters<typeof services.ssh.update>[1], secret?: string) => services.ssh.update(id, patch, secret))
  handle(Ipc.sshRemove, (id: string) => services.ssh.remove(id))
  handle(Ipc.sshConnect, (id: string) => services.ssh.connect(id))
  handle(Ipc.sshDisconnect, (id: string) => services.ssh.disconnect(id))
  handle(Ipc.sshState, (id: string) => services.ssh.stateOf(id))
  handle(Ipc.sshShellOpen, (id: string, cols: number, rows: number) => services.ssh.openShell(id, cols, rows))
  handle(Ipc.sshShellData, (channelId: string, data: string) => services.ssh.shellData(channelId, data))
  handle(Ipc.sshShellResize, (channelId: string, cols: number, rows: number) => services.ssh.shellResize(channelId, cols, rows))
  handle(Ipc.sshShellClose, (channelId: string) => services.ssh.closeShell(channelId))
  handle(Ipc.sshSftpList, (id: string, path: string) => services.ssh.sftpList(id, path))
  handle(Ipc.sshSftpRealpath, (id: string, path: string) => services.ssh.sftpRealpath(id, path))
  handle(Ipc.sshSftpMkdir, (id: string, path: string) => services.ssh.sftpMkdir(id, path))
  handle(Ipc.sshSftpDelete, (id: string, path: string, recursive: boolean) => services.ssh.sftpDelete(id, path, recursive))
  handle(Ipc.sshSftpRename, (id: string, from: string, to: string) => services.ssh.sftpRename(id, from, to))
  handle(Ipc.sshTransfer, (id: string, direction: 'up' | 'down', localPath: string, remotePath: string) =>
    services.ssh.transfer(id, direction, localPath, remotePath))
  handle(Ipc.sshTransferCancel, (transferId: string) => services.ssh.cancelTransfer(transferId))

  handle(Ipc.ciPipelines, () => services.ci.listPipelines())
  handle(Ipc.ciRun, (pipelineId: string) => services.ci.run(pipelineId))
  handle(Ipc.ciCancel, (pipelineId: string) => services.ci.cancel(pipelineId))
  handle(Ipc.ciRuns, () => services.ci.listRuns())
  handle(Ipc.ghRepo, () => services.github.detectRepo())
  handle(Ipc.ghRuns, () => services.github.listRuns())

  handle(Ipc.termOpen, (cols: number, rows: number, cwd?: string) => services.terminal.open(cols, rows, cwd))
  handle(Ipc.termData, (termId: string, data: string) => services.terminal.data(termId, data))
  handle(Ipc.termResize, (termId: string, cols: number, rows: number) => services.terminal.resize(termId, cols, rows))
  handle(Ipc.termClose, (termId: string) => services.terminal.close(termId))

  handle(Ipc.sessionAdminDelete, (sessionId: string) => services.sessionAdmin.deleteSession(sessionId))

  handle(Ipc.dialogPickDirectory, async () => {
    const win = ctx.getWindow()
    const options = { properties: ['openDirectory', 'createDirectory'] as Array<'openDirectory' | 'createDirectory'> }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled || result.filePaths.length === 0 ? null : result.filePaths[0]
  })

  handle(Ipc.appQuit, () => ctx.quit())
}
