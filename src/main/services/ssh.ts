import fs from 'node:fs'
import path from 'node:path'
import { Client as SshClient, type SFTPWrapper, type Stats } from 'ssh2'
import type { AppPaths } from '../core/paths'
import type { Logger } from './logger'
import type {
  SftpEntry, SshAuthType, SshConnection, SshConnState, SshStatusEvent, SshTransfer,
} from '../../shared/types'

/** 凭据加解密盒（electron safeStorage 在 app 层注入；测试用 fake）。 */
export interface CryptoBox {
  encrypt(plain: string): string
  decrypt(hex: string): string | null
}

type ConnectionConfig = Omit<SshConnection, 'hasSecret'>

interface StoredSecrets {
  [connId: string]: string
}

type SshEvent =
  | { type: 'status'; event: SshStatusEvent }
  | { type: 'shell-data'; channelId: string; data: string }
  | { type: 'shell-close'; channelId: string }
  | { type: 'transfer'; transfer: SshTransfer }

interface ShellHandle {
  channelId: string
  stream: {
    write(data: string): void
    close(): void
    /** ssh2 Channel.setWindow(rows, cols, height, width)。 */
    setWindow(rows: number, cols: number, height: number, width: number): void
    on(event: string, fn: (data: Buffer) => void): void
  }
}

interface TransferHandle {
  id: string
  cancel(): void
}

const readJson = <T>(file: string, fallback: T): T => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) as T } catch { return fallback }
}

const writeJsonAtomic = (file: string, value: unknown): void => {
  const tmp = `${file}.tmp-${process.pid}`
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8')
  fs.renameSync(tmp, file)
}

/**
 * SSH/SFTP 服务：连接配置（ssh.json）+ 凭据（safeStorage 加密的 ssh-secrets.json）+
 * ssh2 连接池（keepalive）+ shell 通道 + SFTP 列表/传输（进度/取消）。
 * 不依赖 electron，可 node 直测；跳板机 v1 不做（设计文档偏差记录）。
 */
export class SshService {
  private readonly configFile: string
  private readonly secretsFile: string
  private configs: ConnectionConfig[]
  private secrets: StoredSecrets
  private readonly clients = new Map<string, SshClient>()
  private readonly states = new Map<string, SshConnState>()
  private readonly shells = new Map<string, ShellHandle & { connId: string }>()
  private readonly transfers = new Map<string, TransferHandle>()
  private readonly listeners = new Set<(event: SshEvent) => void>()
  private nextChannel = 1
  private nextTransfer = 1

  constructor(
    paths: AppPaths,
    private readonly crypto: CryptoBox,
    private readonly logger: Logger,
  ) {
    this.configFile = path.join(paths.userData, 'ssh.json')
    this.secretsFile = path.join(paths.userData, 'ssh-secrets.json')
    this.configs = readJson<ConnectionConfig[]>(this.configFile, [])
    this.secrets = readJson<StoredSecrets>(this.secretsFile, {})
  }

  onEvent(listener: (event: SshEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: SshEvent): void {
    for (const listener of this.listeners) {
      try { listener(event) } catch (error) { this.logger.warn('ssh', `listener error: ${String(error)}`) }
    }
  }

  // ---- 连接配置 CRUD ----

  list(): SshConnection[] {
    return this.configs.map((config) => ({ ...config, hasSecret: Boolean(this.secrets[config.id]) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  add(input: Omit<SshConnection, 'id' | 'hasSecret'>, secret?: string): SshConnection[] {
    const config: ConnectionConfig = { ...input, id: `ssh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}` }
    this.configs.push(config)
    if (secret) this.secrets[config.id] = this.crypto.encrypt(secret)
    this.persist()
    return this.list()
  }

  update(id: string, patch: Partial<Omit<SshConnection, 'id' | 'hasSecret'>>, secret?: string): SshConnection[] {
    const index = this.configs.findIndex((config) => config.id === id)
    if (index === -1) throw new Error(`ssh connection not found: ${id}`)
    this.configs[index] = { ...this.configs[index], ...patch, id }
    if (secret !== undefined) {
      if (secret === '') delete this.secrets[id]
      else this.secrets[id] = this.crypto.encrypt(secret)
    }
    this.persist()
    return this.list()
  }

  remove(id: string): SshConnection[] {
    void this.disconnect(id)
    this.configs = this.configs.filter((config) => config.id !== id)
    delete this.secrets[id]
    for (const [channelId, shell] of this.shells) {
      if (shell.connId === id) {
        shell.stream.close()
        this.shells.delete(channelId)
      }
    }
    this.persist()
    return this.list()
  }

  private persist(): void {
    writeJsonAtomic(this.configFile, this.configs)
    writeJsonAtomic(this.secretsFile, this.secrets)
  }

  // ---- 连接生命周期 ----

  stateOf(id: string): SshConnState {
    return this.states.get(id) ?? 'disconnected'
  }

  private setState(id: string, state: SshConnState, detail?: string): void {
    this.states.set(id, state)
    this.emit({ type: 'status', event: { id, state, detail } })
  }

  async connect(id: string): Promise<void> {
    const config = this.configs.find((item) => item.id === id)
    if (!config) throw new Error(`ssh connection not found: ${id}`)
    if (this.clients.has(id)) return
    this.setState(id, 'connecting')
    const client = new SshClient()
    this.clients.set(id, client)
    const auth = this.buildAuth(config)
    await new Promise<void>((resolve, reject) => {
      client.once('ready', () => {
        this.logger.info('ssh', `connected ${config.username}@${config.host}:${config.port}`)
        this.setState(id, 'connected')
        resolve()
      })
      client.once('error', (error) => {
        this.clients.delete(id)
        this.setState(id, 'error', error.message)
        reject(new Error(`ssh connect failed: ${error.message}`))
      })
      client.on('close', () => {
        if (this.clients.get(id) === client) {
          this.clients.delete(id)
          this.setState(id, 'disconnected')
        }
      })
      client.connect({
        host: config.host,
        port: config.port,
        username: config.username,
        keepaliveInterval: 15_000,
        keepaliveCountMax: 4,
        readyTimeout: 20_000,
        ...auth,
      })
    })
  }

  private buildAuth(config: ConnectionConfig): Record<string, unknown> {
    const secretHex = this.secrets[config.id]
    const secret = secretHex ? this.crypto.decrypt(secretHex) : null
    switch (config.authType as SshAuthType) {
      case 'password':
        if (!secret) throw new Error('no password stored for this connection')
        return { password: secret }
      case 'key': {
        if (!config.keyPath) throw new Error('no keyPath configured')
        const privateKey = fs.readFileSync(config.keyPath, 'utf8')
        return secret ? { privateKey, passphrase: secret } : { privateKey }
      }
      case 'agent':
        return { agent: process.env.SSH_AUTH_SOCK }
      default:
        throw new Error(`unknown auth type: ${String(config.authType)}`)
    }
  }

  async disconnect(id: string): Promise<void> {
    const client = this.clients.get(id)
    this.clients.delete(id)
    if (client) {
      client.end()
    }
    if (this.stateOf(id) !== 'disconnected') this.setState(id, 'disconnected')
  }

  private requireClient(id: string): SshClient {
    const client = this.clients.get(id)
    if (!client) throw new Error('ssh not connected')
    return client
  }

  // ---- Shell 通道 ----

  async openShell(id: string, cols: number, rows: number): Promise<string> {
    const client = this.requireClient(id)
    const stream = await new Promise<ShellHandle['stream']>((resolve, reject) => {
      client.shell({ term: 'xterm-256color', cols, rows }, (error, channel) => {
        if (error) reject(error)
        else resolve(channel as unknown as ShellHandle['stream'])
      })
    })
    const channelId = `ch-${this.nextChannel++}`
    stream.on('data', (data: Buffer) => {
      this.emit({ type: 'shell-data', channelId, data: data.toString('utf8') })
    })
    stream.on('close', () => {
      this.shells.delete(channelId)
      this.emit({ type: 'shell-close', channelId })
    })
    this.shells.set(channelId, { channelId, stream, connId: id })
    return channelId
  }

  shellData(channelId: string, data: string): void {
    this.shells.get(channelId)?.stream.write(data)
  }

  shellResize(channelId: string, cols: number, rows: number): void {
    this.shells.get(channelId)?.stream.setWindow(rows, cols, 0, 0)
  }

  closeShell(channelId: string): void {
    const shell = this.shells.get(channelId)
    if (shell) {
      this.shells.delete(channelId)
      shell.stream.close()
    }
  }

  // ---- SFTP ----

  private async sftp(id: string): Promise<SFTPWrapper> {
    const client = this.requireClient(id)
    return new Promise<SFTPWrapper>((resolve, reject) => {
      client.sftp((error, sftp) => { if (error) reject(error); else resolve(sftp) })
    })
  }

  /** 远端路径规范化（~ 展开、. .. 解析）。 */
  async sftpRealpath(id: string, remotePath: string): Promise<string> {
    const sftp = await this.sftp(id)
    return new Promise<string>((resolve, reject) => {
      sftp.realpath(remotePath, (error, resolved) => { if (error) reject(error); else resolve(resolved) })
    })
  }

  async sftpList(id: string, remotePath: string): Promise<SftpEntry[]> {
    const sftp = await this.sftp(id)
    const list = await new Promise<Array<{ filename: string; longname: string; attrs: Stats }>>((resolve, reject) => {
      sftp.readdir(remotePath, (error, list) => { if (error) reject(error); else resolve(list) })
    })
    return list
      .filter((item) => item.filename !== '.' && item.filename !== '..')
      .map((item) => ({
        name: item.filename,
        path: remotePath === '/' ? `/${item.filename}` : `${remotePath}/${item.filename}`,
        kind: item.attrs.isDirectory() ? 'dir' as const : item.attrs.isSymbolicLink() ? 'link' as const : 'file' as const,
        size: item.attrs.size,
        mtime: item.attrs.mtime * 1000,
        mode: item.attrs.mode,
      }))
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1))
  }

  async sftpMkdir(id: string, remotePath: string): Promise<void> {
    const sftp = await this.sftp(id)
    await new Promise<void>((resolve, reject) => {
      sftp.mkdir(remotePath, (error) => { if (error) reject(error); else resolve() })
    })
  }

  async sftpDelete(id: string, remotePath: string, recursive: boolean): Promise<void> {
    const sftp = await this.sftp(id)
    if (!recursive) {
      await new Promise<void>((resolve, reject) => {
        sftp.unlink(remotePath, (error) => { if (error) reject(error); else resolve() })
      })
      return
    }
    // 递归删除：先列后删（目录自底向上）
    const entries = await this.sftpList(id, remotePath)
    for (const entry of entries) {
      if (entry.kind === 'dir') await this.sftpDelete(id, entry.path, true)
      else await this.sftpDelete(id, entry.path, false)
    }
    await new Promise<void>((resolve, reject) => {
      sftp.rmdir(remotePath, (error) => { if (error) reject(error); else resolve() })
    })
  }

  async sftpRename(id: string, from: string, to: string): Promise<void> {
    const sftp = await this.sftp(id)
    await new Promise<void>((resolve, reject) => {
      sftp.rename(from, to, (error) => { if (error) reject(error); else resolve() })
    })
  }

  /** 流式传输（进度 + 可取消）：direction=up 本地→远端；down 远端→本地。 */
  async transfer(id: string, direction: 'up' | 'down', localPath: string, remotePath: string): Promise<string> {
    const sftp = await this.sftp(id)
    const transferId = `tr-${this.nextTransfer++}`
    const stat = direction === 'down'
      ? await new Promise<Stats>((resolve, reject) => { sftp.stat(remotePath, (e, s) => { if (e) reject(e); else resolve(s) }) })
      : await fs.promises.stat(localPath)
    const total = stat.size
    const transfer: SshTransfer = { id: transferId, connId: id, direction, localPath, remotePath, total, done: 0, state: 'running' }
    this.emitTransfer(transfer)
    const source = direction === 'down'
      ? sftp.createReadStream(remotePath)
      : fs.createReadStream(localPath)
    const sink = direction === 'down'
      ? fs.createWriteStream(localPath)
      : sftp.createWriteStream(remotePath)
    let cancelled = false
    this.transfers.set(transferId, {
      id: transferId,
      cancel: () => {
        cancelled = true
        ;(source as { destroy(): void }).destroy()
        ;(sink as { destroy(): void }).destroy()
      },
    })
    await new Promise<void>((resolve, reject) => {
      ;(source as NodeJS.ReadableStream).on('data', (chunk: Buffer) => {
        transfer.done += chunk.length
        this.emitTransfer(transfer)
      })
      ;(source as { on(e: string, fn: (err?: Error) => void): void }).on('error', (error?: Error) => reject(error ?? new Error('read error')))
      ;(sink as { on(e: string, fn: (err?: Error) => void): void }).on('error', (error?: Error) => reject(error ?? new Error('write error')))
      ;(sink as { on(e: string, fn: () => void): void }).on('close', () => {
        if (cancelled) reject(new Error('cancelled'))
        else resolve()
      })
      ;(source as NodeJS.ReadableStream).pipe(sink as NodeJS.WritableStream)
    }).then(() => {
      transfer.state = 'done'
      transfer.done = total
    }).catch((error: Error) => {
      transfer.state = cancelled ? 'cancelled' : 'error'
      transfer.error = error.message
      throw error
    }).finally(() => {
      this.transfers.delete(transferId)
      this.emitTransfer(transfer)
    })
    return transferId
  }

  cancelTransfer(transferId: string): void {
    this.transfers.get(transferId)?.cancel()
  }

  private emitTransfer(transfer: SshTransfer): void {
    this.emit({ type: 'transfer', transfer: { ...transfer } })
  }

  async dispose(): Promise<void> {
    for (const client of this.clients.values()) client.end()
    this.clients.clear()
    for (const shell of this.shells.values()) shell.stream.close()
    this.shells.clear()
    for (const transfer of this.transfers.values()) transfer.cancel()
    this.transfers.clear()
  }
}
