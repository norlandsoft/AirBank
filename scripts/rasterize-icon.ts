/**
 * 将 resources/icon.svg 栅格化为 icon.png（512）/ tray.png（32）/ trayTemplate.png（22）。
 * 使用 @resvg/resvg-js（napi 预编译，devDependency 不进包）。用法：pnpm icons
 */
import fs from 'node:fs'
import path from 'node:path'
import { Resvg } from '@resvg/resvg-js'

const svg = fs.readFileSync(path.resolve('resources/icon.svg'), 'utf8')

function render(size: number): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: size },
    background: 'rgba(0,0,0,0)',
  })
  return resvg.render().asPng()
}

fs.writeFileSync(path.resolve('resources/icon.png'), render(512))
fs.writeFileSync(path.resolve('resources/tray.png'), render(32))
fs.writeFileSync(path.resolve('resources/trayTemplate.png'), render(22))
console.log('rasterized icon.png(512) tray.png(32) trayTemplate.png(22)')
