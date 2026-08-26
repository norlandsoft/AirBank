/**
 * 生成应用图标：纯 Node（zlib 手工 PNG 编码），无第三方依赖。
 * 输出 resources/icon.png（512）与 resources/trayTemplate.png（22，macOS 模板图）。
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

function crc32(buf: Buffer): number {
  let table = (crc32 as unknown as { table?: Int32Array }).table
  if (!table) {
    table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
    ;(crc32 as unknown as { table: Int32Array }).table = table
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

/** 以 RGBA 像素缓冲编码 PNG。 */
function encodePng(width: number, height: number, rgba: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8-bit RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/** 圆角矩形 + 居中字母 D 的品牌图标（DeepSeek 蓝）。 */
function renderIcon(size: number, monochrome: boolean): Buffer {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = size * 0.22
  const accent = [0x4d, 0x6b, 0xfe]
  const fg = [255, 255, 255]
  // “D” 字形：竖干 + 半圆，用参数方程近似
  const inGlyph = (x: number, y: number): boolean => {
    const u = x / size, v = y / size
    // 竖干
    if (u >= 0.30 && u <= 0.40 && v >= 0.26 && v <= 0.74) return true
    // 右侧半环：圆心 (0.40, 0.50)，外径 0.24 内径 0.135
    const dx = u - 0.40, dy = v - 0.50
    const r = Math.hypot(dx * (size / size), dy)
    if (dx >= -0.001 && r <= 0.24 && r >= 0.135) return true
    return false
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const inside = x >= radius || x < size - radius || y >= radius || y < size - radius
        ? true
        : Math.hypot(
            Math.max(radius - x, x - (size - 1 - radius), 0),
            Math.max(radius - y, y - (size - 1 - radius), 0),
          ) <= radius
      if (!inside) { rgba[i + 3] = 0; continue }
      const base = monochrome ? [0, 0, 0] : accent
      rgba[i] = base[0]; rgba[i + 1] = base[1]; rgba[i + 2] = base[2]; rgba[i + 3] = monochrome ? 0 : 255
      if (inGlyph(x, y)) {
        rgba[i] = fg[0]; rgba[i + 1] = fg[1]; rgba[i + 2] = fg[2]; rgba[i + 3] = 255
      }
    }
  }
  return rgba
}

const outDir = path.resolve('resources')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.png'), encodePng(512, 512, renderIcon(512, false)))
fs.writeFileSync(path.join(outDir, 'trayTemplate.png'), encodePng(22, 22, renderIcon(22, false)))
fs.writeFileSync(path.join(outDir, 'tray.png'), encodePng(32, 32, renderIcon(32, false)))
console.log('icons written to resources/')
