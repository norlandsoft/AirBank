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
