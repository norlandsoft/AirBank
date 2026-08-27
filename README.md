<p align="center"><img src="resources/icon.png" width="96" alt="AirCode" /></p>

<h1 align="center">AirCode</h1>

<p align="center">
  以 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> 为内核的 AI 编程工作台 ——<br />
  <b>自建前端直连 DSH API</b>（无内嵌网页），统一承载 Agent 会话 / IDE / Git / SSH·SFTP / CI·CD。
</p>

## 模块

- 💬 **Agent 会话** — 自研会话前端：`dsh-client` 直连内核（会话列表/流式时间线/工具卡/权限审批/用户提问/斜杠命令/图片附件/子代理嵌套浏览/模型切换），Markdown + Shiki 渲染，长会话虚拟化。
- 📝 **IDE** — CodeMirror 6 编辑器（VS Code 键位/多光标/搜索）、保存时 prettier 格式化（项目配置优先）、`@codemirror/merge` Diff 审阅、**LSP**（内置 typescript-language-server：补全/悬停/诊断/重命名/⌘⇧O 整理 imports）、文件 watcher 自动重载与冲突提示。
- 🌿 **Git** — 变更分组暂存、统一 diff 视图、提交/分支/日志，状态栏分支显示，文件变更自动刷新。
- 🖥️ **服务器** — SSH 连接管理（密码/私钥/Agent，safeStorage 加密凭据）、远端终端（xterm）、SFTP 双栏文件管理与传输队列（进度/取消）。
- 🚀 **CI/CD** — `.aircode/pipelines/*.yaml` 本地流水线执行器（逐步日志流/超时/取消），GitHub Actions 只读集成 + 状态栏徽标。
- 🧰 **工作台** — Codex 风活动栏 + 状态栏、⌘K 命令面板（模块/命令/文件模糊打开）、⌘J 底部本地终端（python3 pty.spawn 伪终端，零原生依赖）、档案/内核/插件/日志/设置管理面板。

## 架构

```text
┌─ Electron Renderer (React 19 + Tailwind 4) ──────────────┐
│ dsh-client（协议层：wire 编解码 / 重连 / 事件总线）        │
│ modules/  agent · ide · git · servers · cicd · settings  │
└───────────────────────▲──────────────────────────────────┘
                        │ contextBridge IPC（类型三段式）
┌─ Electron Main (Node) ───────────────────────────────────┐
│ kernel-proxy ── 内核 HTTP RPC + WS 事件流代理              │
│   （渲染层 Origin 被内核信任围栏 403，故全流量经主进程）   │
│ services/  workspace(树/watch) · format(prettier) · git   │
│            lsp(ts-server) · ssh(safeStorage) · ci · term  │
│ 既有：runtime/kernel/server/profiles/plugins/setup/logs   │
└───────────────────────▲──────────────────────────────────┘
                        │ spawn（契约不变）
              node <bin> --profile <p> --host 127.0.0.1 --port <n> --no-open
                        ▼
              DSH 内核：POST /api/<method> · ws /api/events.{mux,host} · POST /api/respond
```

协议细节、能力映射与里程碑见 [`docs/frontend-rewrite-design.md`](docs/frontend-rewrite-design.md)（含实施进度与偏差记录）。

## 特性

- ⚡ **零环境一键运行** — 首次启动自动下载 Node 运行时、pnpm 与 Harness 内核（官方源 / 国内镜像可选），全部装在应用数据目录，不污染系统环境。
- 🗂️ **档案隔离** — 多档案（dsh profile）管理：会话与插件互不影响。
- 🧱 **核心管理** — 内核多版本下载、切换与卸载。
- 🔌 **插件管理** — 查看、安装、卸载当前档案插件（经 `dsh plugin` 转发 pnpm）。
- 🌐 **中英双语** — 界面语言与深色/浅色主题即时切换。

## 开发

```bash
pnpm install
pnpm dev              # Electron + HMR
```

## 验证

```bash
pnpm typecheck && pnpm test && pnpm build   # 类型 / 131+ 单测 / 构建
pnpm verify:protocol                        # 对运行中的内核做协议八步验证（只读）
DSH_VERIFY_LLM=1 pnpm verify:protocol       # 追加 LLM 流式/审批/中断/重连实测
DSH_DESKTOP_KERNEL_DIR=<内核目录> pnpm smoke # 无 GUI 集成冒烟
pnpm pack:dir                               # 打包冒烟（免安装器）
```

## 规则摘要（AGENTS.md）

- `services/` 与 `core/` 不得 import electron；electron 仅出现在 index/app/window/tray/menu/ipc/preload。
- 生产代码改动配同区测试；持久化结构变更需兼容旧数据。
- dsh 子进程命令行契约固定，勿擅自改动；不擅自 git commit / push。
