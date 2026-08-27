import fs from 'node:fs'
import { spawn } from 'node:child_process'
import http from 'node:http'
import https from 'node:https'
import path from 'node:path'

export interface DownloadProgress { received: number; total: number | null; percent: number | null }

/** 带重定向与进度回调的 HTTPS 下载；写入临时文件后原子改名。 */
export function downloadFile(url: string, dest: string, onProgress?: (progress: DownloadProgress) => void, redirects = 5): Promise<DownloadProgress> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('http:') ? http : https
    const request = client.get(url, { headers: { 'User-Agent': 'aircode/0.1' } }, (response) => {
      const status = response.statusCode ?? 0
      if (status >= 300 && status < 400 && response.headers.location) {
        response.resume()
        if (redirects <= 0) return reject(new Error(`too many redirects downloading ${url}`))
        const next = new URL(response.headers.location, url).toString()
        return resolve(downloadFile(next, dest, onProgress, redirects - 1))
      }
      if (status !== 200) {
        response.resume()
        return reject(new Error(`download failed: HTTP ${status} for ${url}`))
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      const tmp = dest + '.part'
      const total = response.headers['content-length'] ? Number(response.headers['content-length']) : null
      let received = 0
      const file = fs.createWriteStream(tmp)
      response.on('data', (chunk: Buffer) => {
        received += chunk.length
        onProgress?.({ received, total, percent: total ? Math.min(99, Math.round((received / total) * 100)) : null })
      })
      response.pipe(file)
      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(tmp, dest)
          const result = { received, total, percent: 100 }
          onProgress?.(result)
          resolve(result)
        })
      })
      file.on('error', (error) => { fs.rmSync(tmp, { force: true }); reject(error) })
    })
    request.setTimeout(60_000, () => request.destroy(new Error('download timed out')))
    request.on('error', reject)
  })
}

function run(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''
    child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString() })
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited ${code}: ${stderr.slice(-400)}`))
    })
  })
}

/** 解包 .tar.gz/.tgz 与 .zip：优先系统 tar（bsdtar 兼容 zip），Windows zip 走 PowerShell。 */
export async function extractArchive(archive: string, destDir: string): Promise<void> {
  fs.mkdirSync(destDir, { recursive: true })
  if (/\.zip$/i.test(archive) && process.platform === 'win32') {
    await run('powershell.exe', ['-NoProfile', '-Command', `Expand-Archive -LiteralPath '${archive.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`])
    return
  }
  if (/\.zip$/i.test(archive)) {
    try {
      await run('tar', ['-xf', archive, '-C', destDir])
      return
    } catch {
      await run('unzip', ['-o', '-q', archive, '-d', destDir])
      return
    }
  }
  await run('tar', ['-xzf', archive, '-C', destDir])
}