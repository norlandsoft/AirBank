import net from 'node:net'

/** 端口是否在指定主机上已被监听。 */
export function isPortInUse(port: number, host = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer()
    server.once('error', (error: NodeJS.ErrnoException) => {
      resolve(error.code === 'EADDRINUSE' || error.code === 'EACCES')
    })
    server.once('listening', () => {
      server.close(() => resolve(false))
    })
    server.listen(port, host)
  })
}

/** 从 start 起向上找第一个空闲端口，扫描 count 个后抛错（端口只增不减、有界漂移）。 */
export async function findAvailablePort(start: number, count = 50, host = '127.0.0.1'): Promise<number> {
  for (let offset = 0; offset < count; offset++) {
    const candidate = start + offset
    if (candidate > 65535) break
    if (!(await isPortInUse(candidate, host))) return candidate
  }
  throw new Error(`PORT_EXHAUSTED: no free TCP port in [${start}, ${start + count - 1}]`)
}

/** 等待端口释放（服务停止后），超时返回 false。 */
export async function waitForPortRelease(port: number, timeoutMs = 10_000, host = '127.0.0.1'): Promise<boolean> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (!(await isPortInUse(port, host))) return true
    await new Promise((resolve) => setTimeout(resolve, 120))
  }
  return !(await isPortInUse(port, host))
}
