/** 渲染进程 / 主进程共享的类型与 IPC 契约。 */

export type Locale = 'zh-CN' | 'en-US'
export type ThemeMode = 'light' | 'dark' | 'system'

/** 持久化应用设置。dshHome 为空串表示使用默认数据目录。 */
export interface AppSettings {
  locale: Locale
  theme: ThemeMode
  /** 首选端口；被占用时自动向上漂移。 */
  port: number
  dshHome: string
  /** 自定义内核目录（优先于内置/已安装内核）。 */
  kernelDir: string | null
  /** 自定义 Node 可执行文件路径。 */
  nodePath: string | null
  /** 使用国内镜像加速下载（npmmirror / ghfast）。 */
  useMirror: boolean
  autoStart: boolean
  closeToTray: boolean
  activeProfile: string
  /** IDE 模块的工作区根目录（空串 = 未设置，进入 IDE 时引导选择）。 */
  ideRoot: string
  /** 保存时格式化（prettier，项目配置优先）。 */
  formatOnSave: boolean
}

// ---- IDE 工作区（主进程 WorkspaceService 的共享契约） ----

export interface FsEntry {
  name: string
  /** 相对 root 的路径（POSIX 分隔，跨平台统一给渲染层）。 */
  rel: string
  kind: 'file' | 'dir'
  size: number
}

export interface FileRead {
  content: string
  size: number
  readonly: boolean
  binary: boolean
  tooLarge: boolean
}

export interface WalkResult {
  files: string[]
  truncated: boolean
}

/** 工作区文件变更事件（主进程 chokidar 广播）。 */
export interface WorkspaceChangeEvent {
  type: 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir'
  rel: string
}

/** 格式化结果（FormatService）。 */
export interface FormatResult {
  content: string
  formatted: boolean
  reason?: string
}

// ---- Git 模块（主进程 GitService 的共享契约） ----

export type GitFileState = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

export interface GitFileStatus {
  /** 相对仓库根的路径。 */
  path: string
  state: GitFileState
  /** true = 已暂存（index 侧）；false = 工作区侧。 */
  staged: boolean
}

export interface GitStatusView {
  repoRoot: string
  branch: string
  ahead: number
  behind: number
  files: GitFileStatus[]
}

export interface GitCommitInfo {
  hash: string
  date: number
  message: string
  author: string
}

export interface GitBranchesView {
  current: string
  branches: string[]
}

// ---- SSH/SFTP 模块（主进程 SshService 的共享契约） ----

export type SshAuthType = 'password' | 'key' | 'agent'

/** SSH 连接配置（secret 永不回传，仅 hasSecret 标记）。 */
export interface SshConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: SshAuthType
  /** authType=key 时的私钥路径。 */
  keyPath?: string
  hasSecret: boolean
}

export type SshConnState = 'disconnected' | 'connecting' | 'connected' | 'error'

export interface SshStatusEvent {
  id: string
  state: SshConnState
  detail?: string
}

export interface SftpEntry {
  name: string
  path: string
  kind: 'file' | 'dir' | 'link'
  size: number
  mtime: number
  mode: number
}

export interface SshTransfer {
  id: string
  connId: string
  direction: 'up' | 'down'
  localPath: string
  remotePath: string
  total: number
  done: number
  state: 'running' | 'done' | 'error' | 'cancelled'
  error?: string
}

// ---- CI/CD 模块（主进程 CiService 的共享契约） ----

/** 流水线定义（.aircode/pipelines/*.yaml 精简 schema）。 */
export interface CiStepDef {
  name: string
  run: string
  /** 单步超时（秒），默认 600。 */
  timeout?: number
  env?: Record<string, string>
}

export interface CiPipelineDef {
  name: string
  env?: Record<string, string>
  steps: CiStepDef[]
}

export interface CiPipelineInfo {
  /** 文件名（不含扩展名）即 id。 */
  id: string
  name: string
  file: string
  stepCount: number
}

export type CiRunState = 'running' | 'success' | 'failed' | 'cancelled'
export type CiStepState = 'pending' | 'running' | 'success' | 'failed' | 'cancelled' | 'skipped'

export interface CiStepView {
  name: string
  state: CiStepState
  durationMs?: number
  exitCode?: number
}

export interface CiRunView {
  runId: string
  pipelineId: string
  name: string
  state: CiRunState
  startedAt: number
  finishedAt?: number
  steps: CiStepView[]
}

export type CiEvent =
  | { type: 'run'; run: CiRunView }
  | { type: 'log'; runId: string; stepIndex: number; stream: 'out' | 'err'; text: string }

/** GitHub Actions 只读视图。 */
export interface GhRun {
  id: number
  name: string
  status: string
  conclusion: string | null
  branch: string
  url: string
  updatedAt: number
}

export type ServerState = 'stopped' | 'starting' | 'running' | 'unhealthy' | 'stopping' | 'error'
export interface ServerStatus {
  state: ServerState
  url: string | null
  port: number | null
  pid: number | null
  profile: string | null
  detail: string | null
}

export type RuntimeSource = 'custom' | 'bundled' | 'downloaded' | 'system'
export interface RuntimeStatus {
  available: boolean
  source: RuntimeSource | null
  path: string | null
  version: string | null
  /** 版本是否满足 dsh 引擎要求（^22.19 || >=24）。 */
  supported: boolean
}

export type KernelSource = 'custom' | 'env' | 'core' | 'system'
export interface KernelStatus {
  installed: boolean
  source: KernelSource | null
  dir: string | null
  binPath: string | null
  version: string | null
}

export interface CoreInfo { id: string; version: string; dir: string; active: boolean }
export interface ProfileInfo { name: string; dir: string; active: boolean }
export interface PluginInfo { name: string; version: string }
export interface LogEntry { ts: number; level: 'info' | 'warn' | 'error'; source: string; line: string }

export type InstallStatus = 'pending' | 'active' | 'done' | 'error'
export interface InstallStep { id: string; status: InstallStatus; progress: number; detail: string }
/** 首次启动安装状态机快照，经事件推送到渲染层。 */
export interface InstallPlan { steps: InstallStep[]; active: boolean; done: boolean; error: string | null }

export interface AppInfo {
  appVersion: string
  electron: string
  chrome: string
  node: string
  platform: string
  arch: string
  userData: string
  dshHome: string
  logsDir: string
}

/** 应用启动时渲染层一次性拉取的全量引导状态。 */
export interface BootState {
  settings: AppSettings
  runtime: RuntimeStatus
  kernel: KernelStatus
  server: ServerStatus
}
