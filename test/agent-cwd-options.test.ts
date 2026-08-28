import { describe, expect, it } from 'vitest'
import { draftCwdFromInput, homeShorten, recentCwds } from '../src/renderer/src/modules/agent/cwdOptions'

describe('recentCwds（起始页最近目录）', () => {
  it('按清单顺序去重并截取', () => {
    const sessions = [
      { cwd: '/a' }, { cwd: '/b' }, { cwd: '/a' }, {}, { cwd: '/c' },
    ]
    expect(recentCwds(sessions)).toEqual(['/a', '/b', '/c'])
  })
  it('超过 limit 截断', () => {
    const sessions = Array.from({ length: 12 }, (_, i) => ({ cwd: `/d${i}` }))
    expect(recentCwds(sessions)).toHaveLength(8)
    expect(recentCwds(sessions, 3)).toEqual(['/d0', '/d1', '/d2'])
  })
  it('空清单 → 空数组', () => {
    expect(recentCwds([])).toEqual([])
  })
})

describe('homeShorten', () => {
  it('macOS/Linux home 缩写为 ~', () => {
    expect(homeShorten('/Users/eric/work/app')).toBe('~/work/app')
    expect(homeShorten('/home/eric/work')).toBe('~/work')
  })
  it('非 home 路径原样', () => {
    expect(homeShorten('/opt/AirCode')).toBe('/opt/AirCode')
    expect(homeShorten('')).toBe('')
  })
})

describe('draftCwdFromInput', () => {
  it('空白输入 → null（回落默认目录）', () => {
    expect(draftCwdFromInput('')).toBeNull()
    expect(draftCwdFromInput('   ')).toBeNull()
  })
  it('有效路径去空白', () => {
    expect(draftCwdFromInput('  /opt/AirCode  ')).toBe('/opt/AirCode')
  })
})
