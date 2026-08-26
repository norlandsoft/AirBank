import { app } from 'electron'
import { createDesktopApp } from './app'

// 单实例锁：第二个实例聚焦既有窗口后退出。
const acquired = app.requestSingleInstanceLock()
if (!acquired) {
  app.quit()
} else {
  const desktop = createDesktopApp()
  app.on('second-instance', () => desktop.focusMainWindow())
  app.whenReady().then(() => desktop.start())
  app.on('window-all-closed', () => {
    // 托盘常驻：macOS 与 closeToTray 语义下不因窗口关闭退出
    if (process.platform !== 'darwin' && !desktop.wantsTrayStay()) app.quit()
  })
  app.on('before-quit', () => { void desktop.dispose() })
  app.on('activate', () => desktop.focusMainWindow())
}
