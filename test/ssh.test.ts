import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SshService, type CryptoBox } from '../src/main/services/ssh'
import { makePaths } from '../src/main/core/paths'
import { Logger } from '../src/main/services/logger'

/** 可逆 fake 加密盒（base64 充数）。 */
const fakeCrypto: CryptoBox = {
  encrypt: (plain) => Buffer.from(plain, 'utf8').toString('base64'),
  decrypt: (hex) => Buffer.from(hex, 'base64').toString('utf8'),
}

let userData: string
let service: SshService

beforeEach(() => {
  userData = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-ssh-'))
  service = new SshService(makePaths(userData), fakeCrypto, new Logger(null))
})

afterEach(async () => {
  await service.dispose()
  fs.rmSync(userData, { recursive: true, force: true })
})

const sample = { name: 'prod-1', host: '192.0.2.1', port: 22, username: 'deploy', authType: 'password' as const }

describe('SshService 配置与凭据', () => {
  it('add：返回带 hasSecret 的列表；secret 落盘为密文', () => {
    const list = service.add(sample, 's3cret')
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ name: 'prod-1', hasSecret: true })
    const secretsRaw = fs.readFileSync(path.join(userData, 'ssh-secrets.json'), 'utf8')
    expect(secretsRaw).not.toContain('s3cret')
    const configRaw = fs.readFileSync(path.join(userData, 'ssh.json'), 'utf8')
    expect(configRaw).toContain('prod-1')
  })

  it('持久化：新实例读回配置与凭据', () => {
    service.add(sample, 's3cret')
    const revived = new SshService(makePaths(userData), fakeCrypto, new Logger(null))
    expect(revived.list()[0]).toMatchObject({ name: 'prod-1', hasSecret: true })
  })

  it('update：改字段与清除 secret（空串）', () => {
    const [created] = service.add(sample, 's3cret')
    let list = service.update(created.id, { port: 2222 })
    expect(list[0]).toMatchObject({ port: 2222, hasSecret: true })
    list = service.update(created.id, {}, '')
    expect(list[0].hasSecret).toBe(false)
  })

  it('remove：配置与凭据一并清除', () => {
    const [created] = service.add(sample, 's3cret')
    const list = service.remove(created.id)
    expect(list).toEqual([])
    const secrets = JSON.parse(fs.readFileSync(path.join(userData, 'ssh-secrets.json'), 'utf8')) as Record<string, string>
    expect(secrets[created.id]).toBeUndefined()
  })

  it('无凭据连接 password 认证 → buildAuth 抛错', async () => {
    const [created] = service.add(sample)
    await expect(service.connect(created.id)).rejects.toThrow()
    expect(service.stateOf(created.id)).not.toBe('connected')
  })

  it('key 认证缺 keyPath 抛错', async () => {
    const [created] = service.add({ ...sample, authType: 'key' })
    await expect(service.connect(created.id)).rejects.toThrow('keyPath')
  })

  it('不存在的连接 id 抛错', async () => {
    await expect(service.connect('ssh-nope')).rejects.toThrow('not found')
  })

  it('未连接时 openShell/sftpList 抛错', async () => {
    const [created] = service.add(sample)
    await expect(service.openShell(created.id, 80, 24)).rejects.toThrow('not connected')
    await expect(service.sftpList(created.id, '/')).rejects.toThrow('not connected')
  })
})
