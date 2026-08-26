import fs from 'node:fs'
import path from 'node:path'
import { RingBuffer } from '../core/ring'
import type { LogEntry } from '../../shared/types'

/** 进程内日志：环形缓冲供渲染层回放，同时落盘 JSON Lines。 */
export class Logger {
  private readonly ring = new RingBuffer<LogEntry>(2000)
  private listeners = new Set<(entry: LogEntry) => void>()
  private stream: fs.WriteStream | null = null

  constructor(private readonly logsDir: string | null) {}

  private ensureStream(): fs.WriteStream | null {
    if (this.stream || !this.logsDir) return this.stream
    try {
      fs.mkdirSync(this.logsDir, { recursive: true })
      this.stream = fs.createWriteStream(path.join(this.logsDir, 'app.log'), { flags: 'a' })
      this.stream.on('error', () => { this.stream = null })
    } catch {
      this.stream = null
    }
    return this.stream
  }

  log(level: LogEntry['level'], source: string, line: string): void {
    const entry: LogEntry = { ts: Date.now(), level, source, line: line.replace(/\n+$/, '') }
    this.ring.push(entry)
    this.ensureStream()?.write(JSON.stringify(entry) + '\n')
    for (const listener of this.listeners) listener(entry)
  }

  info(source: string, line: string): void { this.log('info', source, line) }
  warn(source: string, line: string): void { this.log('warn', source, line) }
  error(source: string, line: string): void { this.log('error', source, line) }

  entries(): LogEntry[] { return this.ring.toArray() }
  clear(): void { this.ring.clear() }

  onAppend(listener: (entry: LogEntry) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  close(): void {
    this.stream?.end()
    this.stream = null
  }
}
