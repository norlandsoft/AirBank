import { app, Menu, shell } from 'electron'

export interface MenuActions {
  onReloadWebview(): void
  onOpenLogs(): void
}

/** 原生应用菜单（中文）。macOS 带应用菜单项，其余平台精简。 */
export function installAppMenu(actions: MenuActions): void {
  const isMac = process.platform === 'darwin'
  const template: Electron.MenuItemConstructorOptions[] = []
  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about', label: '关于 DeepSeek Harness Desktop' },
        { type: 'separator' },
        { role: 'hide', label: '隐藏' },
        { role: 'hideOthers', label: '隐藏其他' },
        { role: 'unhide', label: '全部显示' },
        { type: 'separator' },
        { role: 'quit', label: '退出' },
      ],
    })
  }
  template.push(
    {
      label: '文件',
      submenu: [isMac ? { role: 'close', label: '关闭窗口' } : { role: 'quit', label: '退出' }],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' }, { role: 'redo', label: '重做' }, { type: 'separator' },
        { role: 'cut', label: '剪切' }, { role: 'copy', label: '拷贝' },
        { role: 'paste', label: '粘贴' }, { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { label: '刷新对话界面', accelerator: 'CmdOrCtrl+R', click: actions.onReloadWebview },
        { label: '打开日志目录', click: actions.onOpenLogs },
        { type: 'separator' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '实际大小' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        ...(isMac ? [{ role: 'zoom' as const, label: '缩放' }] : []),
        { type: 'separator' },
        { label: '项目主页', click: () => { void shell.openExternal('https://github.com/deepseek-ai/deepseek-harness') } },
      ],
    },
  )
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
