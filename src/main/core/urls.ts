/** 下载源 URL 规划（纯函数）：官方源与国内镜像互换。 */

export const NODE_VERSION = '22.22.0'
export const KERNEL_NPM_SPEC = '@deepseek-ai/dsh'
export const PNPM_VERSION = '10.14.0'

const NODE_BASE = 'https://nodejs.org/dist/'
const NODE_MIRROR_BASE = 'https://npmmirror.com/mirrors/node/'
const PKG_RELEASE = 'https://github.com/dsh-tauri-desk/deepseek-harness-pkg/releases/latest/download/'
const PKG_RELEASE_MIRROR = 'https://ghfast.top/https://github.com/dsh-tauri-desk/deepseek-harness-pkg/releases/latest/download/'
export const PKG_LATEST_API = 'https://api.github.com/repos/dsh-tauri-desk/deepseek-harness-pkg/releases/latest'

export type NodePlatform = 'win' | 'macos' | 'linux'

export function nodePlatform(platform: NodeJS.Platform = process.platform): NodePlatform {
  if (platform === 'win32') return 'win'
  if (platform === 'darwin') return 'macos'
  return 'linux'
}

/** Node 官方发行包文件名与下载地址。 */
export function nodeDist(version: string, platform: NodePlatform, arch: string, mirror: boolean): { url: string; file: string } {
  const plat = platform === 'win' ? 'win' : platform === 'macos' ? 'darwin' : 'linux'
  const ext = platform === 'win' ? 'zip' : 'tar.gz'
  const file = `node-v${version}-${plat}-${arch}.${ext}`
  return { url: `${mirror ? NODE_MIRROR_BASE : NODE_BASE}v${version}/${file}`, file }
}

/** 预打包 dsh 内核（含 node_modules，解压即用）的平台键与地址。 */
export function kernelPkg(platform: NodePlatform, arch: string, mirror: boolean): { url: string; key: string } {
  const key = platform === 'win' ? 'windows' : platform === 'macos' ? `macos-${arch === 'arm64' ? 'arm64' : 'x64'}` : 'linux'
  return { url: `${mirror ? PKG_RELEASE_MIRROR : PKG_RELEASE}deepseek-harness-pkg-${key}.zip`, key }
}

/** pnpm 独立包（npm 协议 tar 包）。 */
export function pnpmDist(version: string, mirror: boolean): { url: string; file: string } {
  const registry = mirror ? 'https://registry.npmmirror.com' : 'https://registry.npmjs.org'
  return { url: `${registry}/pnpm/-/pnpm-${version}.tgz`, file: `pnpm-${version}.tgz` }
}

/** npm registry 基址（内核回退安装路径使用）。 */
export function npmRegistry(mirror: boolean): string {
  return mirror ? 'https://registry.npmmirror.com' : 'https://registry.npmjs.org'
}
