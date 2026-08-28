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
  dsh: {
    rpc: (method, payload) => invoke(Ipc.dshRpc, method, payload),
    respond: (rpcId, result) => invoke(Ipc.dshRespond, rpcId, result),
    stream: {
      open: (kind) => invoke(Ipc.dshStreamOpen, kind),
      close: (kind) => invoke(Ipc.dshStreamClose, kind),
    },
  },
  onDshStreamEvent: (listener) => on(Events.dshStream, listener),
  workspace: {
    root: () => invoke(Ipc.wsRoot),
    setRoot: (dir) => invoke(Ipc.wsSetRoot, dir),
    pickRoot: () => invoke(Ipc.wsPickRoot),
    list: (rel) => invoke(Ipc.wsList, rel),
    read: (rel) => invoke(Ipc.wsRead, rel),
    write: (rel, content) => invoke(Ipc.wsWrite, rel, content),
    walk: () => invoke(Ipc.wsWalk),
    format: (rel, content) => invoke(Ipc.wsFormat, rel, content),
  },
  onWorkspaceChange: (listener) => on(Events.wsChange, listener),
  git: {
    status: () => invoke(Ipc.gitStatus),
    diff: (relPath, staged) => invoke(Ipc.gitDiff, relPath, staged),
    stage: (paths) => invoke(Ipc.gitStage, paths),
    unstage: (paths) => invoke(Ipc.gitUnstage, paths),
    commit: (message) => invoke(Ipc.gitCommit, message),
    log: (limit) => invoke(Ipc.gitLog, limit),
    branches: () => invoke(Ipc.gitBranches),
    checkout: (name) => invoke(Ipc.gitCheckout, name),
    createBranch: (name) => invoke(Ipc.gitCreateBranch, name),
    repos: () => invoke(Ipc.gitRepos),
    addRepo: (dir) => invoke(Ipc.gitAddRepo, dir),
    cloneRepo: (url, parentDir) => invoke(Ipc.gitCloneRepo, url, parentDir),
    removeRepo: (dir) => invoke(Ipc.gitRemoveRepo, dir),
    activateRepo: (dir) => invoke(Ipc.gitActivateRepo, dir),
    fetch: () => invoke(Ipc.gitFetch),
    pull: () => invoke(Ipc.gitPull),
    push: () => invoke(Ipc.gitPush),
    discard: (paths) => invoke(Ipc.gitDiscard, paths),
    commitFiles: (hash) => invoke(Ipc.gitCommitFiles, hash),
    commitDiff: (hash, relPath) => invoke(Ipc.gitCommitDiff, hash, relPath),
  },
  lsp: {
    ensure: () => invoke(Ipc.lspEnsure),
    send: (message) => invoke(Ipc.lspSend, message),
  },
  onLspMessage: (listener) => on(Events.lspMessage, listener),
  ssh: {
    list: () => invoke(Ipc.sshList),
    add: (input, secret) => invoke(Ipc.sshAdd, input, secret),
    update: (id, patch, secret) => invoke(Ipc.sshUpdate, id, patch, secret),
    remove: (id) => invoke(Ipc.sshRemove, id),
    connect: (id) => invoke(Ipc.sshConnect, id),
    disconnect: (id) => invoke(Ipc.sshDisconnect, id),
    state: (id) => invoke(Ipc.sshState, id),
    shell: {
      open: (id, cols, rows) => invoke(Ipc.sshShellOpen, id, cols, rows),
      data: (channelId, data) => invoke(Ipc.sshShellData, channelId, data),
      resize: (channelId, cols, rows) => invoke(Ipc.sshShellResize, channelId, cols, rows),
      close: (channelId) => invoke(Ipc.sshShellClose, channelId),
    },
    sftp: {
      list: (id, path) => invoke(Ipc.sshSftpList, id, path),
      realpath: (id, path) => invoke(Ipc.sshSftpRealpath, id, path),
      mkdir: (id, path) => invoke(Ipc.sshSftpMkdir, id, path),
      delete: (id, path, recursive) => invoke(Ipc.sshSftpDelete, id, path, recursive),
      rename: (id, from, to) => invoke(Ipc.sshSftpRename, id, from, to),
    },
    transfer: (id, direction, localPath, remotePath) => invoke(Ipc.sshTransfer, id, direction, localPath, remotePath),
    cancelTransfer: (transferId) => invoke(Ipc.sshTransferCancel, transferId),
  },
  onSshEvent: (listener) => on(Events.sshEvent, listener),
  cicd: {
    pipelines: () => invoke(Ipc.ciPipelines),
    run: (pipelineId) => invoke(Ipc.ciRun, pipelineId),
    cancel: (pipelineId) => invoke(Ipc.ciCancel, pipelineId),
    runs: () => invoke(Ipc.ciRuns),
    githubRepo: () => invoke(Ipc.ghRepo),
    githubRuns: () => invoke(Ipc.ghRuns),
  },
  onCiEvent: (listener) => on(Events.ciEvent, listener),
  term: {
    open: (cols, rows, cwd) => invoke(Ipc.termOpen, cols, rows, cwd),
    data: (termId, data) => invoke(Ipc.termData, termId, data),
    resize: (termId, cols, rows) => invoke(Ipc.termResize, termId, cols, rows),
    close: (termId) => invoke(Ipc.termClose, termId),
  },
  onTermEvent: (listener) => on(Events.termEvent, listener),
  quit: () => invoke(Ipc.appQuit),
  onServerStatus: (listener) => on(Events.serverStatus, listener),
  onLog: (listener) => on(Events.log, listener),
  onInstallPlan: (listener) => on(Events.installPlan, listener),
  onKernelChanged: (listener) => on(Events.kernelChanged, listener),
  onRuntimeChanged: (listener) => on(Events.runtimeChanged, listener),
  onSettingsChanged: (listener) => on(Events.settingsChanged, listener),
  onNativeTheme: (listener) => on(Events.nativeTheme, listener),
  dialogPickDirectory: () => invoke(Ipc.dialogPickDirectory),
  sessionAdmin: {
    delete: (sessionId) => invoke(Ipc.sessionAdminDelete, sessionId),
  },
}

contextBridge.exposeInMainWorld('dshDesktop', api)