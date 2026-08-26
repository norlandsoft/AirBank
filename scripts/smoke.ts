/**
 * 无 GUI 集成冒烟：以临时 userData 组装服务层，用指定内核启动 dsh web，
 * 探测 HTTP 200 后停止。用法：
 *   DSH_DESKTOP_KERNEL_DIR=/opt/deepseek-harness/apps/cli tsx scripts/smoke.ts
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { makePaths } from '../src/main/core/paths'
import { Logger } from '../src/main/services/logger'
import { SettingsService } from '../src/main/services/settings'
import { RuntimeManager } from '../src/main/services/runtime'
import { KernelManager } from '../src/main/services/kernel'
import { DshServerManager } from '../src/main/services/server'
import { ProfileService } from '../src/main/services/profiles'

const kernelDir = process.env.DSH_DESKTOP_KERNEL_DIR
if (!kernelDir) {
  console.error('DSH_DESKTOP_KERNEL_DIR is required (a directory containing the dsh kernel)')
  process.exit(2)
}

const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-desktop-smoke-'))
const paths = makePaths(userData)
const logger = new Logger(null)
const settings = new SettingsService(paths)
settings.load()
settings.patch({ port: 39080, activeProfile: 'smoke' })
new ProfileService(settings).create('smoke')
const runtime = new RuntimeManager(paths, settings, logger)
const kernel = new KernelManager(paths, settings, runtime, logger)
const server = new DshServerManager(settings, runtime, kernel, logger)

const runtimeStatus = runtime.status()
console.log('[smoke] runtime:', JSON.stringify(runtimeStatus))
if (!runtimeStatus.available || !runtimeStatus.supported) {
  console.error('[smoke] FAIL: no supported node runtime on this machine')
  process.exit(1)
}
const kernelStatus = kernel.status()
console.log('[smoke] kernel:', JSON.stringify({ ...kernelStatus, dir: kernelStatus.dir }))
if (!kernelStatus.installed) {
  console.error('[smoke] FAIL: kernel not detected at', kernelDir)
  process.exit(1)
}

const status = await server.start()
console.log('[smoke] server after start:', JSON.stringify(status))
if (status.state !== 'running' || !status.url) {
  console.error('[smoke] FAIL: server did not become healthy; recent logs:')
  for (const entry of logger.entries().slice(-30)) console.error(`  [${entry.source}] ${entry.line}`)
  process.exit(1)
}
const response = await fetch(status.url)
const html = await response.text()
console.log(`[smoke] GET ${status.url} -> ${response.status}, ${html.length} bytes, has-root-div=${html.includes('id="root"') || html.includes('<div id="app"') || html.length > 1000}`)
const stopped = await server.stop()
console.log('[smoke] server after stop:', JSON.stringify(stopped))
fs.rmSync(userData, { recursive: true, force: true })
if (stopped.state !== 'stopped') {
  console.error('[smoke] FAIL: server did not stop cleanly')
  process.exit(1)
}
console.log('[smoke] PASS')