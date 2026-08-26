import { Menu, Tray, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export interface TrayActions {
  onShow(): void
  onRestart(): void
  onQuit(): void
}

export interface TrayHandle { destroy(): void }

/** 系统托盘：显示窗口 / 重启服务 / 退出。图标缺失时静默跳过（不阻塞主流程）。 */
export function createTray(actions: TrayActions): TrayHandle | null {
  const candidates = [
    path.join(dirname, '../../resources/trayTemplate.png'),
    path.join(dirname, '../../resources/tray.png'),
  ]
  const iconPath = candidates.find((candidate) => fs.existsSync(candidate))
  if (!iconPath) return null
  const image = nativeImage.createFromPath(iconPath)
  if (process.platform === 'darwin') image.setTemplateImage(true)
  const tray = new Tray(image)
  tray.setToolTip('DeepSeek Harness Desktop')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '显示主窗口', click: actions.onShow },
    { label: '重启服务', click: actions.onRestart },
    { type: 'separator' },
    { label: '退出', click: actions.onQuit },
  ]))
  tray.on('click', actions.onShow)
  return { destroy: () => tray.destroy() }
}
