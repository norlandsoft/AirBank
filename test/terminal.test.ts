import { describe, expect, it } from 'vitest'
import { TerminalService } from '../src/main/services/terminal'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'

/** script(1) 伪终端在 macOS/Linux 可用；Windows 预期退化（跳过交互断言）。 */
describe('TerminalService', () => {
  it('open → shell 输出到达；写入命令有回显；close 静默', async () => {
    const service = new TerminalService(new WorkspaceService(new Logger(null)), new Logger(null))
    let output = ''
    service.onEvent((event) => {
      if (event.type === 'term-data') output += event.data
    })
    const termId = service.open(80, 24)
    const deadline = Date.now() + 8000
    const marker = `aircode-term-${Date.now()}`
    await new Promise((resolve) => setTimeout(resolve, 700))
    service.data(termId, `echo ${marker}\n`)
    while (Date.now() < deadline && !output.includes(marker)) {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    service.close(termId)
    await service.dispose()
    expect(output).toContain(marker)
  }, 12_000)

  it('exit 事件在 shell 退出时触发', async () => {
    const service = new TerminalService(new WorkspaceService(new Logger(null)), new Logger(null))
    const exited: string[] = []
    service.onEvent((event) => {
      if (event.type === 'term-exit') exited.push(event.termId)
    })
    const termId = service.open(80, 24)
    await new Promise((resolve) => setTimeout(resolve, 700))
    service.data(termId, 'exit\n')
    const deadline = Date.now() + 8000
    while (Date.now() < deadline && exited.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 120))
    }
    await service.dispose()
    expect(exited).toContain(termId)
  }, 12_000)
})
