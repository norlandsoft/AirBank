import { describe, expect, it } from 'vitest'
import { compareVersions, nodeVersionSupported, parseVersion } from '../src/main/core/semver'
import { kernelPkg, nodeDist, npmRegistry, pnpmDist } from '../src/main/core/urls'

describe('semver', () => {
  it('parseVersion', () => {
    expect(parseVersion('22.19.0')).toEqual([22, 19, 0])
    expect(parseVersion('v24.18.0')).toEqual([24, 18, 0])
    expect(parseVersion('bad')).toEqual([0, 0, 0])
  })
  it('compareVersions', () => {
    expect(compareVersions('0.1.1', '0.1.2')).toBeLessThan(0)
    expect(compareVersions('1.0.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('2.2.2', '2.2.2')).toBe(0)
  })
  it('nodeVersionSupported: ^22.19 || >=24', () => {
    expect(nodeVersionSupported('22.19.0')).toBe(true)
    expect(nodeVersionSupported('22.18.9')).toBe(false)
    expect(nodeVersionSupported('24.0.0')).toBe(true)
    expect(nodeVersionSupported('23.9.0')).toBe(false)
    expect(nodeVersionSupported('20.11.0')).toBe(false)
  })
})

describe('urls', () => {
  it('nodeDist 官方与镜像', () => {
    expect(nodeDist('22.22.0', 'macos', 'arm64', false).url)
      .toBe('https://nodejs.org/dist/v22.22.0/node-v22.22.0-darwin-arm64.tar.gz')
    expect(nodeDist('22.22.0', 'win', 'x64', true).url)
      .toBe('https://npmmirror.com/mirrors/node/v22.22.0/node-v22.22.0-win-x64.zip')
  })
  it('kernelPkg 平台键', () => {
    expect(kernelPkg('macos', 'arm64', false).url).toContain('deepseek-harness-pkg-macos-arm64.zip')
    expect(kernelPkg('macos', 'x64', false).url).toContain('deepseek-harness-pkg-macos-x64.zip')
    expect(kernelPkg('win', 'x64', false).url).toContain('deepseek-harness-pkg-windows.zip')
    expect(kernelPkg('linux', 'x64', true).url).toContain('ghfast.top')
    expect(kernelPkg('linux', 'x64', true).url).toContain('deepseek-harness-pkg-linux.zip')
  })
  it('pnpmDist 与 npmRegistry', () => {
    expect(pnpmDist('10.14.0', false).url).toBe('https://registry.npmjs.org/pnpm/-/pnpm-10.14.0.tgz')
    expect(pnpmDist('10.14.0', true).url).toContain('registry.npmmirror.com')
    expect(npmRegistry(true)).toBe('https://registry.npmmirror.com')
  })
})
