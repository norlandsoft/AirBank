<p align="center"><img src="resources/icon.png" width="96" alt="AirCode" /></p>

<h1 align="center">AirCode</h1>

<p align="center">
  <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 的桌面端（Electron）——<br />
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
```

### 无 GUI 冒烟

不打开窗口，直接验证「解析运行时 → 定位内核 → 启动 dsh web → 健康检查 → 停止」全链路：

```bash
# 指向任意包含 dsh 内核的目录（本地 checkout 或已安装内核）
DSH_DESKTOP_KERNEL_DIR=/path/to/deepseek-harness/apps/cli pnpm smoke
```

### 使用本地内核 / 系统 dsh

内核解析顺序：设置里的自定义内核目录 → `DSH_DESKTOP_KERNEL_DIR` 环境变量 → 应用托管核心 → 系统 PATH 中的 `dsh`。Node 运行时解析顺序：自定义路径 → 随包内置 → 已下载 → 系统 `node`（需 ^22.19 或 >=24）。

## 构建可执行文件

```bash
pnpm run pack       # 完整安装包（输出到 release/）
pnpm run pack:dir   # 快速模式：只生成未压缩应用目录，调试用
```

> ⚠️ 必须带 `run`：`pnpm pack` 是 pnpm 内置命令（打 npm tarball），会遮蔽 package.json 里的 `pack` 脚本。

### 构建产物（以 macOS arm64 为例）

| 文件 | 用途 |
| --- | --- |
| `release/AirCode-0.1.0-arm64.dmg` | 拖拽安装镜像 |
| `release/AirCode-0.1.0-arm64-mac.zip` | 免安装压缩包 |
| `release/mac-arm64/AirCode.app` | 未压缩应用目录（`pack:dir` 产物） |
| `release/latest-mac.yml` + `*.blockmap` | 自动更新元数据 |

### 平台说明

- **macOS**：默认构建当前架构（arm64）。追加 `-- --x64` 出 Intel 包，`-- --universal` 出通用包。
- **Windows / Linux**：无法从 macOS 交叉构建全部目标形态，请在对应系统或 CI（GitHub Actions 矩阵）上执行同一条 `pnpm run pack`；目标已在 `electron-builder.yml` 备好（win: nsis + zip；linux: AppImage + deb）。

### 代码签名

未配置有效签名证书时 electron-builder 自动跳过签名（本地自用无碍；首次打开需右键 → 打开绕过 Gatekeeper）。对外分发需有效的 **Developer ID Application** 证书并配置公证（notarization），参见 electron-builder 官方文档。

### 已知依赖问题（仓库已内置修复）

electron-builder 26.15.x 依赖 `@electron/get` 的 `ElectronDownloadCacheMode` 枚举，但其声明的范围 `^3.0.0` 允许解析到不含该导出的 3.0.0，打包会报 `Cannot read properties of undefined (reading 'ReadWrite')`。仓库已在 `pnpm-workspace.yaml` 中用 override 锁定：

```yaml
overrides:
  '@electron/get': ^3.1.0
```

同时 `allowBuilds` 白名单（electron / esbuild / electron-winstaller）也已内置——没有它 pnpm 会因供应链策略静默跳过这些依赖的安装脚本，导致 Electron 二进制缺失。

## 数据位置

应用数据目录（macOS 为 `~/Library/Application Support/AirCode`）：

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
