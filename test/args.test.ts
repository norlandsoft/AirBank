import { describe, expect, it } from 'vitest'
import { buildServerArgs, buildServerEnv, isValidProfileName, parseVersionText } from '../src/main/core/args'

describe('buildServerArgs', () => {
  it('组装 profile/host/port/no-open 顺序', () => {
    expect(buildServerArgs({ binPath: '/k/bin.js', profile: 'web', host: '127.0.0.1', port: 3080, noOpen: true }))
      .toEqual(['/k/bin.js', '--profile', 'web', '--host', '127.0.0.1', '--port', '3080', '--no-open'])
  })
  it('noOpen=false 时不追加', () => {
    const args = buildServerArgs({ binPath: '/k/bin.js', profile: 'p', host: '127.0.0.1', port: 1, noOpen: false })
    expect(args).not.toContain('--no-open')
  })
})

describe('buildServerEnv', () => {
  it('覆写 DSH_HOME 且保留基础环境', () => {
    const env = buildServerEnv('/data/dsh', { PATH: '/usr/bin', HOME: '/home/x' })
    expect(env.DSH_HOME).toBe('/data/dsh')
    expect(env.HOME).toBe('/home/x')
  })
  it('PATH 前缀追加', () => {
    const env = buildServerEnv('/d', { PATH: '/usr/bin' }, ['/opt/node/bin'])
    expect(env.PATH).toBe(`/opt/node/bin${process.platform === 'win32' ? ';' : ':'}/usr/bin`)
  })
})

describe('isValidProfileName', () => {
  it('接受常见名称', () => {
    for (const ok of ['web', 'work-1', 'my_profile', '档案A', 'a.b']) expect(isValidProfileName(ok)).toBe(true)
  })
  it('拒绝路径逃逸与分隔符', () => {
    for (const bad of ['', '../x', 'a/b', 'a\\b', 'a..b', '.', ' x', 'node_modules']) expect(isValidProfileName(bad)).toBe(false)
  })
})

describe('parseVersionText', () => {
  it('解析版本号', () => {
    expect(parseVersionText('0.1.1-rc.2')).toBe('0.1.1-rc.2')
    expect(parseVersionText('dsh/0.1.1 darwin-arm64 node-22.0.0')).toBe('0.1.1')
    expect(parseVersionText('no version')).toBeNull()
  })
})