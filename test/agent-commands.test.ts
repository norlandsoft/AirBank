import { describe, expect, it } from 'vitest'
import { isSlashCommand, permissionDraft } from '../src/renderer/src/modules/agent/commands'

describe('isSlashCommand', () => {
  it('/ 开头的非空行按命令裁决', () => {
    expect(isSlashCommand('/permission danger-full-access')).toBe(true)
    expect(isSlashCommand('/model')).toBe(true)
  })

  it('普通文本与裸 / 不裁决', () => {
    expect(isSlashCommand('hello')).toBe(false)
    expect(isSlashCommand('/')).toBe(false)
    expect(isSlashCommand('路径 /tmp 说明')).toBe(false)
  })
})

describe('permissionDraft（起始页 /permission 草稿）', () => {
  it('完整命令解析出预设名', () => {
    expect(permissionDraft('/permission danger-full-access')).toBe('danger-full-access')
    expect(permissionDraft('/permission workspace-write')).toBe('workspace-write')
    expect(permissionDraft('/permission  read-only  ')).toBe('read-only')
  })

  it('裸命令与其它输入不消费', () => {
    expect(permissionDraft('/permission')).toBeNull()
    expect(permissionDraft('/model gpt')).toBeNull()
    expect(permissionDraft('hello')).toBeNull()
    expect(permissionDraft('/permission a b')).toBeNull()
  })
})
