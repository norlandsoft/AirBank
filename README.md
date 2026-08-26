<p align="center"><img src="resources/icon.png" width="96" alt="DeepSeek Harness Desktop" /></p>

<h1 align="center">DeepSeek Harness 桌面端</h1>

<p align="center">
  基于 Electron 的 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 桌面应用 ——<br />
  内嵌完整 WebUI，功能与浏览器端完全一致；一键安装内核，独立运行。
</p>

## 功能

- 🖥️ **Codex 风格桌面壳** — 无边框窗口（macOS 内嵌红绿灯）、深色/浅色主题、可折叠侧边栏、原生菜单与系统托盘。
- ⚡ **零环境一键运行** — 首次启动自动下载 Node 运行时、pnpm 与 Harness 内核（官方源 / 国内镜像可选），全部装在应用数据目录，不污染系统环境。
- 🧩 **完整 WebUI** — 通过 `<webview>` 内嵌 `dsh web` 服务界面（`http://127.0.0.1:<port>`），会话、工具、权限、插件等能力与浏览器端**完全一致**。
- 🗂️ **档案隔离** — 多档案（dsh profile）管理：新建 / 切换 / 删除，会话与插件互不影响。
- 🧱 **核心管理** — 内核多版本下载、切换与卸载；支持自定义内核目录与系统已安装的 `dsh`。
- 🔌 **插件管理** — 查看、安装、卸载当前档案插件（经 `dsh plugin` 转发 pnpm）。
- 🛰️ **服务生命周期** — 启动 / 停止 / 重启、健康检查、端口占用自动漂移、运行日志面板。
- 🌐 **中英双语** — 界面语言与主题即时切换。

## 架构

```text
┌──────────────────────────────────────────────┐
│ Electron Renderer (React 19 + Tailwind 4)    │
│   安装状态机 → Codex 风格外壳 → <webview>     │
│   内嵌 dsh Web 界面（功能与浏览器端一致）      │
└──────────────────────┬───────────────────────┘
                       │ IPC（contextBridge 类型安全 API）
┌──────────────────────┴───────────────────────┐
│ Electron Main (TypeScript)                   │
│   services/runtime   Node 运行时解析与下载    │
│   services/kernel    内核多版本管理           │
│   services/server    dsh 进程生命周期+健康检查 │
│   services/profiles  档案管理                │
│   services/plugins   插件管理                │
│   services/setup     首次启动安装状态机        │
└──────┬───────────────────────────┬───────────┘
       │                           │
 runtime/node-v22.22.0        cores/<版本>/ (内核)
       └─────────────┬─────────────┘
                     ▼
   node bin.js --profile <档案> --host 127.0.0.1 --port <port> --no-open
                     │  DSH_HOME=<应用数据目录>/dsh-home（与系统 ~/.dsh 隔离）
                     ▼
        http://127.0.0.1:<port>/  ← <webview> 内嵌
```

架构参考 [dsh-tauri-desk/deepseek-harness-desktop](https://github.com/dsh-tauri-desk/deepseek-harness-desktop)（Tauri 实现），本项目以 Electron 实现同等能力。

## 开发

```bash
pnpm install        # 安装依赖（含 Electron 二进制）
pnpm dev            # 开发模式（HMR + Electron 窗口）
pnpm build          # 构建 main/preload/renderer 到 dist/
pnpm typecheck      # TypeScript 检查
pnpm test           # 单元测试（vitest）
pnpm pack           # electron-builder 打包安装包
```

### 无 GUI 冒烟

不打开窗口，直接验证「解析运行时 → 定位内核 → 启动 dsh web → 健康检查 → 停止」全链路：

```bash
# 指向任意包含 dsh 内核的目录（本地 checkout 或已安装内核）
DSH_DESKTOP_KERNEL_DIR=/opt/deepseek-harness/apps/cli pnpm smoke
```

### 使用本地内核 / 系统 dsh

内核解析顺序：设置里的自定义内核目录 → `DSH_DESKTOP_KERNEL_DIR` 环境变量 → 应用托管核心 → 系统 PATH 中的 `dsh`。Node 运行时解析顺序：自定义路径 → 随包内置 → 已下载 → 系统 `node`（需 ^22.19 或 >=24）。

## 数据位置

应用数据目录（`app.getPath('userData')`）：

| 路径 | 内容 |
| --- | --- |
| `settings.json` | 应用设置（语言/主题/端口/镜像…） |
| `window-state.json` | 窗口几何 |
| `runtime/` | 下载的 Node 与 pnpm |
| `cores/` | 多版本 Harness 内核 |
| `dsh-home/` | 默认 DSH_HOME（档案、会话、插件） |
| `logs/app.log` | JSON Lines 运行日志 |

## 许可

MIT
