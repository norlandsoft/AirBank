import { create } from 'zustand'
import { bridge } from '../../bridge'
import type { SftpEntry, SshConnection, SshConnState, SshTransfer } from '../../../../shared/types'

interface ServersState {
  connections: SshConnection[]
  states: Record<string, SshConnState>
  activeId: string | null
  /** 活动连接的 shell channelId（一个连接一个终端标签）。 */
  shells: Record<string, string>
  remoteCwd: string
  remoteEntries: SftpEntry[]
  transfers: SshTransfer[]
  error: string | null

  refresh(): Promise<void>
  select(id: string): Promise<void>
  add(input: Omit<SshConnection, 'id' | 'hasSecret'>, secret?: string): Promise<void>
  remove(id: string): Promise<void>
  connect(id: string): Promise<void>
  disconnect(id: string): Promise<void>
  ensureShell(id: string, cols: number, rows: number): Promise<string>
  cdRemote(path: string): Promise<void>
  upload(localPath: string): Promise<void>
  download(entry: SftpEntry): Promise<void>
  cancelTransfer(transferId: string): Promise<void>
}

export const useServers = create<ServersState>((set, get) => {
  let wired = false

  const wire = (): void => {
    if (wired) return
    wired = true
    bridge.onSshEvent((event) => {
      switch (event.type) {
        case 'status':
          set((state) => ({ states: { ...state.states, [event.event.id]: event.event.state } }))
          break
        case 'transfer':
          set((state) => {
            const index = state.transfers.findIndex((item) => item.id === event.transfer.id)
            const transfers = index === -1
              ? [...state.transfers, event.transfer]
              : state.transfers.map((item) => (item.id === event.transfer.id ? event.transfer : item))
            return { transfers }
          })
          break
        default:
          break // shell-data/shell-close 由 TerminalView 直接订阅
      }
    })
  }

  return {
    connections: [],
    states: {},
    activeId: null,
    shells: {},
    remoteCwd: '/',
    remoteEntries: [],
    transfers: [],
    error: null,

    async refresh() {
      wire()
      try {
        const connections = await bridge.ssh.list()
        const states: Record<string, SshConnState> = {}
        await Promise.all(connections.map(async (conn) => { states[conn.id] = await bridge.ssh.state(conn.id) }))
        set({ connections, states, error: null })
      } catch (error) { set({ error: String(error) }) }
    },

    async select(id) {
      set({ activeId: id, error: null })
      if (get().states[id] === 'connected') await get().cdRemote('~')
    },

    async add(input, secret) {
      try {
        set({ connections: await bridge.ssh.add(input, secret), error: null })
      } catch (error) { set({ error: String(error) }) }
    },

    async remove(id) {
      try {
        set({ connections: await bridge.ssh.remove(id), activeId: get().activeId === id ? null : get().activeId, error: null })
      } catch (error) { set({ error: String(error) }) }
    },

    async connect(id) {
      try {
        await bridge.ssh.connect(id)
        set((state) => ({ states: { ...state.states, [id]: 'connected' }, error: null }))
        await get().cdRemote('~')
      } catch (error) {
        set((state) => ({ states: { ...state.states, [id]: 'error' }, error: String(error) }))
      }
    },

    async disconnect(id) {
      try {
        await bridge.ssh.disconnect(id)
        set((state) => ({ states: { ...state.states, [id]: 'disconnected' } }))
      } catch (error) { set({ error: String(error) }) }
    },

    async ensureShell(id, cols, rows) {
      const existing = get().shells[id]
      if (existing) return existing
      const channelId = await bridge.ssh.shell.open(id, cols, rows)
      set((state) => ({ shells: { ...state.shells, [id]: channelId } }))
      return channelId
    },

    async cdRemote(path) {
      const { activeId } = get()
      if (!activeId) return
      try {
        const cwd = await bridge.ssh.sftp.realpath(activeId, path)
        const entries = await bridge.ssh.sftp.list(activeId, cwd)
        set({ remoteCwd: cwd, remoteEntries: entries, error: null })
      } catch (error) { set({ error: String(error) }) }
    },

    async upload(localPath) {
      const { activeId, remoteCwd } = get()
      if (!activeId) return
      const name = localPath.split('/').pop() ?? 'upload'
      try {
        await bridge.ssh.transfer(activeId, 'up', localPath, `${remoteCwd === '/' ? '' : remoteCwd}/${name}`)
        await get().cdRemote(remoteCwd)
      } catch (error) { set({ error: String(error) }) }
    },

    async download(entry) {
      const { activeId } = get()
      if (!activeId) return
      try {
        const root = await bridge.workspace.root()
        if (!root) throw new Error('workspace root is not set')
        await bridge.ssh.transfer(activeId, 'down', `${root}/${entry.name}`, entry.path)
      } catch (error) { set({ error: String(error) }) }
    },

    async cancelTransfer(transferId) {
      try {
        await bridge.ssh.cancelTransfer(transferId)
      } catch (error) { set({ error: String(error) }) }
    },
  }
})
