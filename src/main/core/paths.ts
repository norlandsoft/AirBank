import path from 'node:path'

/** 桌面端托管的全部本地状态位置；由 Electron userData 或测试临时目录派生。 */
export interface AppPaths {
  userData: string
  runtimeDir: string
  coresDir: string
  logsDir: string
  settingsFile: string
  coresFile: string
  dshHomeDefault: string
}

export function makePaths(userData: string): AppPaths {
  return {
    userData,
    runtimeDir: path.join(userData, 'runtime'),
    coresDir: path.join(userData, 'cores'),
    logsDir: path.join(userData, 'logs'),
    settingsFile: path.join(userData, 'settings.json'),
    coresFile: path.join(userData, 'cores.json'),
    dshHomeDefault: path.join(userData, 'dsh-home'),
  }
}
