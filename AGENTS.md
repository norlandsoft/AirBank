# Repository Instructions

DeepSeek Harness 桌面端：Electron 外壳内嵌完整 DSH WebUI。先读后改；最小改动；中文沟通。

## 结构

- `src/main/`：Electron 主进程。`core/` 为纯函数（端口/参数/URL/版本），`services/` 为可独立测试的服务（设置/日志/下载/运行时/内核/服务/档案/插件/安装状态机），均不依赖 electron，可在 node 下直接测试。
- `src/preload/`：contextBridge，暴露 `window.dshDesktop`（类型见 `src/shared/api.ts`）。
- `src/renderer/`：React 19 + Tailwind 4 外壳（Codex 风格：标题栏 + 侧边栏 + 内容区），经 `<webview>` 内嵌 dsh web 界面。
- `src/shared/`：主/渲染进程共享类型与 IPC 通道常量。改 IPC 时三处（ipc.ts / preload / api.ts）同步。
- `scripts/smoke.ts`：无 GUI 集成冒烟（DSH_DESKTOP_KERNEL_DIR 指向内核目录）。`scripts/gen-icons.ts` 生成图标。
- `test/`：vitest 单测，仅导入 core/services（禁止导入 electron）。

## 规则

- 服务层（services/）与 core/ 不得 import electron；electron 仅出现在 index/app/window/tray/menu/ipc/preload。
- 生产代码改动需配同区测试；持久化结构（settings.json / cores.json / profile 目录）变更需兼容旧数据。
- dsh 子进程命令行契约：`node <bin> --profile <p> --host 127.0.0.1 --port <n> --no-open`，档案初始化形态见 profiles.ts（与 dsh-app-boot initProfile 一致），勿擅自改动。
- 不擅自 git commit / push；不提交 node_modules、dist、release。

## 验证

```bash
pnpm typecheck && pnpm test && pnpm build
DSH_DESKTOP_KERNEL_DIR=<内核目录> pnpm smoke
```
