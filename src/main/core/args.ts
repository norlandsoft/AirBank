/** dsh 子进程的 argv 与环境构造（纯函数，便于测试）。 */

export interface ServerArgsInput {
  binPath: string
  profile: string
  host: string
  port: number
  noOpen: boolean
}

/**
 * 组装 `node <bin> --profile <p> --host <h> --port <n> --no-open`。
 * --profile 是启动器旗标，其余按序透传给 Web 应用自身。
 */
export function buildServerArgs(input: ServerArgsInput): string[] {
  const args = [input.binPath, '--profile', input.profile, '--host', input.host, '--port', String(input.port)]
  if (input.noOpen) args.push('--no-open')
  return args
}

/** 组装的 dsh 环境：继承当前进程环境，覆写 DSH_HOME 指向桌面端数据目录。 */
export function buildServerEnv(dshHome: string, baseEnv: NodeJS.ProcessEnv = process.env, extraPath: string[] = []): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...baseEnv, DSH_HOME: dshHome }
  if (extraPath.length > 0) {
    const pathKey = Object.keys(env).find((key) => key.toLowerCase() === 'path') ?? 'PATH'
    env[pathKey] = [...extraPath, env[pathKey] ?? ''].filter(Boolean).join(process.platform === 'win32' ? ';' : ':')
  }
  return env
}

/** 档案名合法性：禁止路径分隔符、父目录逃逸与保留名。 */
export function isValidProfileName(name: string): boolean {
  if (!/^[\p{L}\p{N}_.\-][\p{L}\p{N}_ .\-]{0,62}$/u.test(name)) return false
  if (name === '.' || name === '..' || name === 'node_modules' || name.endsWith('.')) return false
  return !name.includes('..')
}

/** 解析 `dsh --version` / package.json 版本文本。 */
export function parseVersionText(text: string): string | null {
  const match = /(\d+\.\d+\.\d+(?:-[\w.]+)?)/.exec(text)
  return match ? match[1] : null
}