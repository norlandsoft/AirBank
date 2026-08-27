import type {
  AppInfo, AppSettings, BootState, CiEvent, CiPipelineInfo, CiRunView, CoreInfo, FileRead, FormatResult, FsEntry,
  GhRun, GitBranchesView, GitCommitInfo,
  GitStatusView, InstallPlan, KernelStatus, LogEntry,
  PluginInfo, ProfileInfo, RuntimeStatus, ServerStatus, SftpEntry, SshConnection, SshConnState,
  SshStatusEvent, SshTransfer, WalkResult, WorkspaceChangeEvent,
} from './types'
import type { RpcId, RpcReceipt, RpcResult } from './dsh/wire'

/** 内核 RPC 代理回执（rpcId 回声供乐观回显对账）。 */
export interface DshRpcResponse {
  rpcId: RpcId
  result: RpcResult<unknown>
}

export type DshStreamKind = 'mux' | 'host'

/** 主进程转发的事件流消息（kernel-proxy StreamEvent 的渲染层镜像）。 */
export type DshStreamEvent =
  | { kind: DshStreamKind; type: 'open' }
  | { kind: DshStreamKind; type: 'frame'; rpcId: RpcId; payload: unknown }
  | { kind: DshStreamKind; type: 'closed' }

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
  /** 内核 RPC 代理（经主进程直连，绕开渲染层同源信任围栏）。 */
  dsh: {
    rpc(method: string, payload: unknown): Promise<DshRpcResponse>
    respond(rpcId: RpcId, result: RpcResult<unknown>): Promise<RpcReceipt>
    /** 事件流代理：渲染层 WS 带 Origin 被围栏 403，必须经主进程（实测 §2.1）。 */
    stream: {
      open(kind: DshStreamKind): Promise<void>
      close(kind: DshStreamKind): Promise<void>
    }
  }
  onDshStreamEvent(listener: (event: DshStreamEvent) => void): () => void
  /** IDE 工作区：文件树/读写/遍历（路径均相对 root，主进程强制 containment）。 */
  workspace: {
    root(): Promise<string | null>
    setRoot(dir: string | null): Promise<void>
    /** 系统目录选择器；取消返回 null。 */
    pickRoot(): Promise<string | null>
    list(rel?: string): Promise<FsEntry[]>
    read(rel: string): Promise<FileRead>
    write(rel: string, content: string): Promise<void>
    walk(): Promise<WalkResult>
    /** prettier 格式化（项目依赖优先，内置兜底；不支持的语言原样返回）。 */
    format(rel: string, content: string): Promise<FormatResult>
  }
  onWorkspaceChange(listener: (event: WorkspaceChangeEvent) => void): () => void
  /** Git 仓库（基于 IDE 工作区；非仓库时返回 null）。 */
  git: {
    status(): Promise<GitStatusView | null>
    diff(relPath: string | null, staged: boolean): Promise<string>
    stage(paths: string[]): Promise<void>
    unstage(paths: string[]): Promise<void>
    commit(message: string): Promise<{ hash: string }>
    log(limit?: number): Promise<GitCommitInfo[]>
    branches(): Promise<GitBranchesView | null>
    checkout(name: string): Promise<void>
    createBranch(name: string): Promise<void>
  }
  /** TypeScript 语言服务器（主进程托管；消息为无头 JSON 字符串）。 */
  lsp: {
    ensure(): Promise<{ running: boolean; root: string | null; pid: number | null }>
    send(message: string): Promise<void>
  }
  onLspMessage(listener: (message: string) => void): () => void
  /** SSH/SFTP（连接配置/凭据/连接池/shell 通道/文件传输）。 */
  ssh: {
    list(): Promise<SshConnection[]>
    add(input: Omit<SshConnection, 'id' | 'hasSecret'>, secret?: string): Promise<SshConnection[]>
    update(id: string, patch: Partial<Omit<SshConnection, 'id' | 'hasSecret'>>, secret?: string): Promise<SshConnection[]>
    remove(id: string): Promise<SshConnection[]>
    connect(id: string): Promise<void>
    disconnect(id: string): Promise<void>
    state(id: string): Promise<SshConnState>
    shell: {
      open(id: string, cols: number, rows: number): Promise<string>
      data(channelId: string, data: string): Promise<void>
      resize(channelId: string, cols: number, rows: number): Promise<void>
      close(channelId: string): Promise<void>
    }
    sftp: {
      list(id: string, path: string): Promise<SftpEntry[]>
      realpath(id: string, path: string): Promise<string>
      mkdir(id: string, path: string): Promise<void>
      delete(id: string, path: string, recursive: boolean): Promise<void>
      rename(id: string, from: string, to: string): Promise<void>
    }
    transfer(id: string, direction: 'up' | 'down', localPath: string, remotePath: string): Promise<string>
    cancelTransfer(transferId: string): Promise<void>
  }
  /** SSH 事件流（status/shell-data/shell-close/transfer）。 */
  onSshEvent(listener: (event:
    | { type: 'status'; event: SshStatusEvent }
    | { type: 'shell-data'; channelId: string; data: string }
    | { type: 'shell-close'; channelId: string }
    | { type: 'transfer'; transfer: SshTransfer }) => void): () => void
  /** CI/CD（本地流水线执行器 + GitHub Actions 只读）。 */
  cicd: {
    pipelines(): Promise<CiPipelineInfo[]>
    run(pipelineId: string): Promise<CiRunView>
    cancel(pipelineId: string): Promise<void>
    runs(): Promise<CiRunView[]>
    githubRepo(): Promise<string | null>
    githubRuns(): Promise<GhRun[]>
  }
  onCiEvent(listener: (event: CiEvent) => void): () => void
  /** 本地终端（script(1) 伪终端，cwd 默认工作区 root）。 */
  term: {
    open(cols: number, rows: number, cwd?: string): Promise<string>
    data(termId: string, data: string): Promise<void>
    resize(termId: string, cols: number, rows: number): Promise<void>
    close(termId: string): Promise<void>
  }
  onTermEvent(listener: (event:
    | { type: 'term-data'; termId: string; data: string }
    | { type: 'term-exit'; termId: string; code: number | null }) => void): () => void
  /** 通用目录选择器（原生对话框；取消返回 null）。 */
  dialogPickDirectory(): Promise<string | null>
  /** 会话管理（内核 API 之外的桌面端操作）。 */
  sessionAdmin: {
    /** 真删除：停内核 → 删存储 + 擦洗注册表 → 重启。 */
    delete(sessionId: string): Promise<{ removedDirs: number; scrubbed: boolean }>
  }
  quit(): Promise<void>
  onServerStatus(listener: (status: ServerStatus) => void): () => void
  onLog(listener: (entry: LogEntry) => void): () => void
  onInstallPlan(listener: (plan: InstallPlan) => void): () => void
  onKernelChanged(listener: (status: KernelStatus) => void): () => void
  onRuntimeChanged(listener: (status: RuntimeStatus) => void): () => void
  onSettingsChanged(listener: (settings: AppSettings) => void): () => void
  onNativeTheme(listener: (theme: 'dark' | 'light') => void): () => void
}