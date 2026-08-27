import { app, BrowserWindow, nativeTheme } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

interface WindowState { width: number; height: number; x?: number; y?: number; maximized?: boolean }

function stateFile(): string {
  return path.join(app.getPath('userData'), 'window-state.json')
}

function loadState(): WindowState {
  try {
    const raw = JSON.parse(fs.readFileSync(stateFile(), 'utf8')) as WindowState
    if (raw.width >= 640 && raw.height >= 480) return raw
  } catch { /* 首启或文件损坏时用默认几何 */ }
  return { width: 1280, height: 800 }
}

export interface MainWindowOptions {
  shouldCloseToTray(): boolean
  onClosed(): void
}

/** 主窗口：Codex 风格（macOS 内嵌红绿灯、其他平台无边框自绘控制），记忆几何。 */
export function createMainWindow(options: MainWindowOptions): BrowserWindow {
  const state = loadState()
  const isMac = process.platform === 'darwin'
  const win = new BrowserWindow({
    width: state.width,
    height: state.height,
    x: state.x,
    y: state.y,
    minWidth: 960,
    minHeight: 640,
    show: false,
    backgroundColor: '#101012',
    titleBarStyle: isMac ? 'hiddenInset' : undefined,
    trafficLightPosition: { x: 14, y: 14 },
    frame: isMac ? true : false,
    webPreferences: {
      preload: path.join(dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  })

  if (state.maximized) win.maximize()
  win.once('ready-to-show', () => win.show())

  const persist = (): void => {
    try {
      const bounds = win.getNormalBounds()
      fs.mkdirSync(path.dirname(stateFile()), { recursive: true })
      fs.writeFileSync(stateFile(), JSON.stringify({ ...bounds, maximized: win.isMaximized() }))
    } catch { /* 忽略持久化失败 */ }
  }
  win.on('close', (event) => {
    persist()
    if (options.shouldCloseToTray()) {
      event.preventDefault()
      win.hide()
    }
  })
  win.on('closed', () => options.onClosed())

  nativeTheme.on('updated', () => {
    win.webContents.send('event:native-theme', nativeTheme.shouldUseDarkColors ? 'dark' : 'light')
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL
  if (devUrl) {
    void win.loadURL(devUrl)
  } else {
    void win.loadFile(path.join(dirname, '../renderer/index.html'))
  }
  return win
}
