import net from 'node:net'
import { describe, expect, it } from 'vitest'
import { findAvailablePort, isPortInUse, waitForPortRelease } from '../src/main/core/ports'

function bind(port: number): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.once('error', reject)
    server.once('listening', () => resolve(server))
    server.listen(port, '127.0.0.1')
  })
}

describe('ports', () => {
  it('isPortInUse 检测占用与空闲', async () => {
    const server = await bind(0)
    const port = (server.address() as net.AddressInfo).port
    expect(await isPortInUse(port)).toBe(true)
    await new Promise<void>((resolve) => server.close(() => resolve()))
    expect(await isPortInUse(port)).toBe(false)
  })

  it('findAvailablePort 跳过被占端口', async () => {
    const server = await bind(0)
    const port = (server.address() as net.AddressInfo).port
    const found = await findAvailablePort(port)
    expect(found).toBeGreaterThan(port)
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  it('findAvailablePort 找到起点端口', async () => {
    const probe = net.createServer()
    const port: number = await new Promise((resolve) => {
      probe.listen(0, '127.0.0.1', () => {
        const p = (probe.address() as net.AddressInfo).port
        probe.close(() => resolve(p))
      })
    })
    expect(await findAvailablePort(port)).toBe(port)
  })

  it('waitForPortRelease 在关闭后返回 true', async () => {
    const server = await bind(0)
    const port = (server.address() as net.AddressInfo).port
    setTimeout(() => server.close(), 150)
    expect(await waitForPortRelease(port, 5_000)).toBe(true)
  })
})
