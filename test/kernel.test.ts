import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { kernelVersion, locateBin } from '../src/main/services/kernel'

let dir: string
beforeEach(() => { dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsh-kernel-')) })
afterEach(() => fs.rmSync(dir, { recursive: true, force: true }))

function makeKernel(layout: 'npm' | 'flat' | 'nested'): string {
  const root = path.join(dir, 'core')
  const binDir = layout === 'npm'
    ? path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib')
    : layout === 'flat'
      ? path.join(root, 'lib')
      : path.join(root, 'deepseek-harness-pkg', 'node_modules', '@deepseek-ai', 'dsh', 'lib')
  fs.mkdirSync(binDir, { recursive: true })
  fs.writeFileSync(path.join(binDir, 'bin.js'), '#!/usr/bin/env node\n')
  const pkgDir = path.dirname(binDir)
  fs.writeFileSync(path.join(pkgDir, 'package.json'), JSON.stringify({ name: '@deepseek-ai/dsh', version: '0.1.1-rc.2' }))
  return root
}

describe('locateBin', () => {
  it('npm 布局', () => {
    const root = makeKernel('npm')
    expect(locateBin(root)).toBe(path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'))
  })
  it('扁平布局', () => {
    const root = makeKernel('flat')
    expect(locateBin(root)).toBe(path.join(root, 'lib', 'bin.js'))
  })
  it('嵌套预打包布局', () => {
    const root = makeKernel('nested')
    expect(locateBin(root)).toContain('bin.js')
  })
  it('空目录返回 null', () => {
    expect(locateBin(path.join(dir, 'nothing'))).toBeNull()
  })
})

describe('kernelVersion', () => {
  it('从 package.json 读版本', () => {
    const root = makeKernel('npm')
    const bin = locateBin(root)
    expect(kernelVersion(root, bin, null)).toBe('0.1.1-rc.2')
  })
})
