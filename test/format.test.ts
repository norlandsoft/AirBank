import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FormatService } from '../src/main/services/format'
import { WorkspaceService } from '../src/main/services/workspace'
import { Logger } from '../src/main/services/logger'

let rootDir: string
let format: FormatService

beforeEach(async () => {
  rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aircode-fmt-'))
  const workspace = new WorkspaceService(new Logger(null))
  await workspace.setRoot(rootDir)
  format = new FormatService(workspace, new Logger(null))
})

afterEach(() => {
  fs.rmSync(rootDir, { recursive: true, force: true })
})

describe('FormatService（内置 prettier 兜底）', () => {
  it('TS：空格/分号/引号规范化（prettier 默认双引号）', async () => {
    const result = await format.format('src/a.ts', "const  a   =    'x'\n")
    expect(result.formatted).toBe(true)
    expect(result.content).toBe('const a = "x";\n')
  })

  it('JSON：缩进规范化；已格式化内容 formatted=false', async () => {
    const result = await format.format('b.json', '{"a":1,"b":[2,3]}')
    expect(result.formatted).toBe(true)
    expect(result.content).toBe('{ "a": 1, "b": [2, 3] }\n')
    const again = await format.format('b.json', result.content)
    expect(again.formatted).toBe(false)
  })

  it('项目 .prettierrc 配置生效', async () => {
    fs.writeFileSync(path.join(rootDir, '.prettierrc.json'), JSON.stringify({ semi: false, singleQuote: false }))
    const result = await format.format('src/a.ts', "const a = 'x';\n")
    expect(result.formatted).toBe(true)
    expect(result.content).toBe('const a = "x"\n')
  })

  it('不支持的语言：原样返回 + reason', async () => {
    const result = await format.format('notes.xyz123', 'raw text\n')
    expect(result.formatted).toBe(false)
    expect(result.content).toBe('raw text\n')
    expect(result.reason).toBeTruthy()
  })

  it('语法错误不阻塞保存：原样返回', async () => {
    const result = await format.format('src/broken.ts', 'const = = =\n')
    expect(result.formatted).toBe(false)
    expect(result.content).toBe('const = = =\n')
  })

  it('未设 root 返回 no-workspace', async () => {
    const orphan = new FormatService(new WorkspaceService(new Logger(null)), new Logger(null))
    const result = await orphan.format('a.ts', 'x\n')
    expect(result.formatted).toBe(false)
    expect(result.reason).toBe('no-workspace')
  })
})
