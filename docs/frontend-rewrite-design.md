# AirCode 前端完全重写 · 技术选型与方案设计

> 状态：v1.0 —— DSH 协议调研已完成（连接协议 + API 编目均含源码行号依据）。
>
> 目标：抛弃 `<webview>` 内嵌官方 WebUI，自建前端直连 DSH 内核 API，
> 统一承载 Agent 会话、代码查看、SSH/SFTP、CI/CD、Git 仓库管理。
> 参考形态：Z Code（智谱轻量 AI 编辑器）、Codex（OpenAI 桌面/CLI）、Zed、Cursor。

---

## 0. 实施进度（2026-08-27 同步）

| 里程碑 | 状态 | 关键产物 |
|---|---|---|
| M0 协议验证 | ✅ 八步全绿（含 LLM 流式/中断/重连实测） | `src/shared/dsh/wire.ts`、`scripts/verify-protocol.ts`、主进程 `kernel-proxy` |
| M1 会话 | ✅ 端到端验证通过（待用户自用验收周） | `dsh-client`、`modules/agent/*`（fold 折叠器/时间线/Composer/审批提问卡）、`chatBackend` 开关 |
| M2 工作台 + IDE 一期 | ✅ | ActivityBar/StatusBar/⌘K 面板、`WorkspaceService`（containment+watcher）、CM6 编辑/格式化/Diff 审阅 |
| M3 Git + IDE 二期 | ✅（LSP E2E 握手实测） | `GitService`、`LspService`（typescript-language-server）+ @codemirror/lsp-client |
| M4 SSH/SFTP | ✅ | `SshService`（safeStorage 凭据/连接池/shell 通道/流传输泵）、xterm 远端终端、SFTP 双栏 |
| M5 CI/CD | ✅ | `CiService`（.aircode/pipelines 执行器）、`GithubService` 只读、状态栏徽标 |
| M6 打磨 | ✅ | 底部面板 + 本地终端（python3 pty.spawn 分级策略）、`pnpm pack:dir` 冒烟通过（npmRebuild:false + asarUnpack 验证）；会话增强：时间线虚拟化、斜杠命令面板（Typert `commands/list` 经 curl 实测载荷 `{args:{agentId}}`）、子代理会话嵌套浏览、图片附件（粘贴/拖放 + `session.attachment` 渲染） |
| 收口 | ✅ | webview 兜底全量移除（WebviewPane/menu 通道/chatBackend 设置/死代码），README 重写 |

**偏差记录**（与原方案的分歧，均已验证可行）：
1. `fzf-for-js` 在 npm registry 不存在 → 自研 30 行子序列匹配（`lib/fuzzy.ts`）。
2. **WS 直连被实测否决**（§2.1）：渲染层 WS 带 Origin 被围栏 403 → HTTP+WS 全流量经主进程 kernel-proxy。
3. biome 未纳入格式化（按平台二进制打包复杂度高）→ prettier 单轨（项目依赖优先、内置兜底）。
4. CI 执行器用 child_process 而非 node-pty（免原生依赖）；本地终端弃 node-pty → python3 `pty.spawn` → `script(1)` → 纯管道的分级策略。
5. SSH 跳板机 v1 未做；SFTP 断点续传 v1 未做；GitHub 集成免认证（`GITHUB_TOKEN` 环境变量可选）。
6. ssh2 的 cpu-features 可选原生依赖未构建（pnpm 跳过）→ 纯 JS 加密路径；打包 `npmRebuild:false` 规避可选原生包构建失败。
7. `typescript` 在打包物中的解析路径（ts-server 对无 typescript 项目的回退）待真实包体验证。

---

## 1. 参考产品形态分析

### 1.1 可借鉴的成熟设计

| 产品 | 核心形态 | 值得借鉴 | 不照搬 |
|---|---|---|---|
| **Codex 桌面/CLI** | 会话为中心：线程列表 + 流式时间线 + 审批卡片 + Diff 审阅 | 会话即第一公民；工具调用折叠卡片；权限审批内联于时间线；`/command` 斜杠命令；工作树（worktree）隔离任务 | Rust TUI 的信息密度；纯键盘流 |
| **Z Code（智谱）** | 轻量编辑器 + 内嵌 Agent：文件树 + 编辑器 + 右侧 Agent 面板 | 编辑器与 Agent 同窗口联动；选中代码即上下文；轻量（不做全 IDE） | 其封闭实现 |
| **Zed** | 高性能编辑器 + Agent Panel + 终端面板 | 三栏布局（活动栏/侧栏/主区）；底部面板（终端/诊断）；命令面板 ⌘K；Git 面板设计 | GPUI 自绘栈 |
| **Cursor** | Tab 式编辑 + 内联 Diff + Composer | Diff 内联接受/拒绝；@引用文件 | 重型 fork VS Code |
| **VS Code** | 活动栏 + 侧栏 + 编辑器组 + 底部面板 + 状态栏 | 布局骨架事实标准；面板可拖拽/折叠 | 扩展系统复杂度 |

### 1.2 AirCode 采纳的布局骨架

综合 Codex 的"会话中心"与 Z Code/VS Code 的"编辑器工作台"，采用**双模式工作台**：

```
┌──────────────────────────────────────────────────────────┐
│ TitleBar（现有：无边框 + 红绿灯 + 窗口控制）               │
├────┬──────────┬────────────────────────────┬─────────────┤
│活  │ 侧栏      │ 主区                        │ 右侧面板     │
│动  │          │                            │（可隐藏）    │
│栏  │ Agent=会话│ Agent 模式：会话时间线      │ 上下文/文件  │
│48px│ 列表      │ Editor 模式：标签页+编辑器  │ Diff 审阅   │
│    │ IDE=文件  │                            │             │
│    │ 树        │                            │             │
│    │ Git=变更  │                            │             │
│    │ 列表      │                            │             │
├────┴──────────┴────────────────────────────┴─────────────┤
│ 底部面板（可折叠）：终端(local/SSH) / CI 日志 / 问题        │
├──────────────────────────────────────────────────────────┤
│ StatusBar：档案·模型·Git 分支·内核状态·CI 状态              │
└──────────────────────────────────────────────────────────┘
```

- **活动栏**（左窄条图标）：Agent / 代码 / Git / 服务器(SSH·SFTP) / CI/CD / 插件 / 设置 —— 各模块统一入口，即"统一前端管理"。
- **Agent 优先**：默认落地在 Agent 模式（Codex 形态）；代码模块以"上下文提供者"身份服务于会话（@文件、选区、Diff 联动）。
- **命令面板 ⌘K**：切换会话/文件/命令/模型，全局统一交互。

---

## 2. DSH API 对接层设计（`dsh-client`）

### 2.0 内核对外协议事实（调研结论，含源码依据）

内核（`dsh web`，默认 `http://127.0.0.1:3080`，AirCode 动态端口由 ServerService 分配）对外只有三类端点：

| 端点 | 协议 | 说明 |
|---|---|---|
| `POST /api/<method>` | HTTP 一元 RPC | **两套并存体系共用此通道**：A. Legacy API Proxy **48 个方法**（注册表 `packages/host/apiproxy/src/api/rpc-map.ts:24-77`）；B. Typert Remote **7 个命名空间**（`/api/<ns>/<method>`，Gateway 拦截）。信封（非 JSON-RPC）：`ClientRequest{type,rpcId,method,payload}` → `ServerResponse{type,rpcId,result:{ok,value\|error}}`（`api/rpc.ts:144-177`）。POST 必须 `Content-Type: application/json` |
| `ws://<host>/api/events.mux` | WebSocket 只下行 | 会话复用流。帧=ServerRequest JSON，**MuxFrame 9 种**（`api/events.ts:69-108`，zod 校验 `events.schema.ts:43-67`）。客户端主动发消息会被 1008 关闭 |
| `ws://<host>/api/events.host` | WebSocket 只下行 | 宿主事件流，**HostFrame 9 种**（`events.ts:127-155`） |
| `POST /api/respond` | HTTP | 用被回答帧的 rpcId 回 `ClientResponse`——审批/提问都走这里 |
| `GET /api/session.export` | HTTP 下载 | 会话日志 ZIP（`?sessionId=…&includeDescendants=…`） |

**认证**：无 token/cookie。唯一闸门是 Host/Origin/Sec-Fetch-Site 信任围栏（`packages/client/connection/src/api-request-trust.ts:96-123`，源码注释明言 "not an auth layer"）；**回环地址免认证**；`settings.describe`、`agentPreset.*` 等标记 loopback-only（AirCode 恒为回环，不受限）。`packages/credentials` 是 LLM provider key 管理，与 HTTP 认证无关。

**`__DSH_BOOT__` 不需要**：它只是官方插件化 UI 的模块图（`packages/client/modules/src/client/manifest.ts:51-76`），第三方客户端无关。

**重连**：指数退避 500ms×2 至 10s 上限；**mux 无断点续传**（`since` 未实现），重连 = 重开流 + 重拉 `session.history`。实现参考（逐行对照）：`packages/host/apiproxy/src/fetch/client.ts`（协议不变量）、`packages/client/connection/src/client/web-api-client.ts`（WS 循环）、`connection.ts`（重连）。

### 2.1 连接拓扑（经实测修订：WS 也必须走主进程）

```
Renderer (React)
   │  全部流量（HTTP RPC + WS 事件流）经主进程 IPC 中转
   ▼
dsh-client（renderer 内 TS 包：协议编解码 + 类型 + 事件分发 + 重连节奏）
   │  IPC（dsh:rpc / dsh:respond / dsh:stream-open|close + event:dsh-stream 广播）
   ▼
Main: kernel-proxy service（fetch + Node WebSocket，均不带 Origin，天然过围栏）
   │
   ▼
dsh 内核子进程（主进程现有 ServerService 拉起，契约不变：
   node <bin> --profile <p> --host 127.0.0.1 --port <n> --no-open）
```

**为什么 HTTP RPC 必须经主进程代理**：内核信任围栏按 Origin/Host/Sec-Fetch-Site 判定，Electron renderer 在 dev（`http://localhost:5173`）与 prod（`file://`）下与内核均非同源，自定义 JSON POST 会触发 CORS 预检并被围栏 403。主进程是 Node fetch，无 CORS 概念，天然回环 Host。

**为什么 WS 也必须经主进程（curl 实测，非推测）**：对 `/api/events.mux` 手工升级探测——带 `Origin: http://localhost:5173` → **403**；带 `Origin: null`（prod file:// 形态）→ **403**；不带 Origin → **101 帧正常流动**。Chromium 的 WebSocket 必然携带 Origin（dev 为 dev-server 源、prod 为 null），因此渲染层直连 WS 在两种构建形态下都被围栏拦截。主进程用 Node 全局 WebSocket（不发送 Origin）→ 101 通过（verify-protocol 脚本全程实测）。事件经 `event:dsh-stream` 逐帧转发（量产后若需优化可 16ms 聚合，见 §4.3）。

### 2.2 dsh-client 分层

```
dsh-client/
├── transport/    # Transport 接口 + 两实现：RendererDirect(WS) / MainProxy(IPC 中转 HTTP+WS 兜底)
├── wire/         # 信封编解码：ClientRequest/ServerResponse、MuxFrame(9)、HostFrame(9)
├── rpc/          # Legacy 48 方法 + Typert 7 命名空间的类型化封装：client.session.prompt(...) → Promise
├── events/       # mux/host 流订阅 → 类型化 event bus（含 approval/requested → /api/respond 应答器）
├── reconnect/    # 指数退避 500ms×2→10s；重连后重拉 session.history
├── types/        # wire 类型抄录（随内核版本锁定，CI diff 校验）
└── index.ts      # DshClient 门面：connect/describe/session/...
```

关键设计：
- **最小对接路径**（M0 脚本验证顺序）：`host.describe` 探活 → 开两条 WS → `session.list/create/history/prompt` → 消费 mux 流 → `POST /api/respond` 答审批 → 断线重连 + 重拉 history。
- **类型对齐策略**：从内核包 `@deepseek-ai/dsh-*` 抄录 wire 类型到本仓 `dsh-client/types`，内核升级时 diff 校验（CI 脚本）。不直接依赖内核 npm 包（体积 + 耦合）。
- **多档案**：profile 切换 = 断开 → 主进程切 profile 重启内核 → 重连。
- **无 boot 步骤**：`__DSH_BOOT__` 是官方 UI 模块图，自建前端无需获取。

### 2.3 能力 → 内核 API 映射表（自建前端实现清单）

| 能力 | 内核 API / 事件 | 优先级 |
|---|---|---|
| 会话列表/搜索/新建 | `session.list`（全量，updatedAt 降序）/ `session.search{query}` / `session.create{workspaceId?,cwd?,agentPreset?}`；增量走 `host/session-added\|removed\|status` 帧 | P0 |
| 历史加载（分页） | `session.history{sessionId,beforeSeq?,maxMessages?}` → `{events:HistoryEntry[],hasMore,projections?}`（按消息边界分页，**尾页带投影基线 + 进行中 partial**）；参考页大小 50 | P0 |
| 发消息 | `session.prompt{sessionId,mode:'queue'\|'steer',content:PromptContentPart[](text/image base64),clientTimeZone?}`；prompt 的 rpcId 透传进 `user/message.source` → **乐观回显对账** | P0 |
| 流式渲染 | mux `session/event{sessionId,event,view?}` → 核心 SessionEvent 13 种（`packages/core/session/src/types.ts:236-337`）；`assistant/chunk` 内为 StreamChunk：`block-start\|text-delta\|reasoning-delta\|tool-call-delta\|block-end\|usage\|finish`；`assistant/message` 定稿；`tool/call\|result` 附 `view:ToolEventView` 渲染意图 | P0 |
| 权限审批 | mux `approval/requested{sessionId,approvalId,toolName,callId?,reason?}`（**rpcId 稳定、重连重放**）→ `POST /api/respond` `{sessionId,approvalId,outcome:'allowed-once'\|'rejected'}` → `approval/resolved` 收敛 | P0 |
| 用户提问（plan-review 等） | mux `question/requested{questions:AskUserQuestionItem[],intent?}` → `/api/respond` → `question/resolved` | P0 |
| 模型列表/切换 | `session.models{sessionId}` → `{current,routable,groups,failures}`；`session.selectModel{provider,model,reasoningEffort?}` | P0 |
| 中断 | `session.cancel{sessionId}` | P0 |
| 排队消息管理 | `session.updateQueue{itemId,action:edit\|remove\|steer}`；快照帧 `session/queue{items}` | P1 |
| 斜杠命令 | 纯文本以 `/` 开头经 `session.prompt` 发送；清单/执行：Typert `commands.list/execute` | P1 |
| @文件/@会话引用补全 | Typert `fileReferences.list(agent,query)` / `sessionReferenceResolver.candidates` | P1 |
| plan/todo/goal/权限/统计展示 | **投影机制**：`session.history` 尾页 `projections` 基线 + mux `session/projection{key,value,seq}` 增量（high-seq-wins）。键：`title/plan/todos/goal/permissions/sessionStats/tokenMeter` | P1 |
| plan/权限预设写入 | 无专用写 RPC，经 `/plan`、`/permission` 斜杠命令 | P1 |
| goal 操作 | `goal.create/edit/pause/resume/complete/clear`（CAS `{ref:{id,revision}}`；读侧走 `goal` 投影） | P2 |
| 附件读取 | `session.attachment{sessionId,attachmentId}` → `{attachment,data(base64)}` | P1 |
| 子代理浏览 | `subagent.list{parentSessionId}` / `subagent.history` / `subagent.prompt(mode:continuable)` / `subagent.interrupt`；**不可远程 spawn** | P1 |
| 工作流可视化 | 事件 `tool-workflow/*`、`subagent/descriptor`（插件合并后 SessionEvent 全集 47 种，见 `known-event-types.ts:19-67`） | P1 |
| jobs 展示 | mux `session/jobs{jobs:JobView[]}` 全量快照（**只读**，无 kill RPC） | P2 |
| 工作区管理 | `workspace.list/create{path}/rename/delete/insertBefore/insertSessionBefore/archiveSession` | P1 |
| 设置读写 | `settings.describe/openDocument/update/replace/mutate`（redacted 视图 + revision CAS + secret 槽位只写不读；loopback-only，AirCode 恒回环可用） | P1 |
| 凭证管理 | `credentials.describe/set/unset`（值永不回传） | P1 |
| 模型目录/提供商 | `llm.providers/models/discoverModels` | P1 |
| 技能列表 | `skill.list{sessionId}` | P2 |
| Agent 预设 | `agentPreset.list/select(仅 blank 会话)/read/copy/remove`（loopback-only） | P2 |
| 目录浏览（cwd 选择） | `host.listDirectory{path?}` / `host.createDirectory` / `host.pickDirectory` / `host.openPath`；`host.describe` → `{version,cwd,provider,model,home,…}` | P1 |
| 消息反馈 | Typert `messageFeedback.list/put/delete`（CAS） | P2 |
| 插件清单（内核侧） | Typert `pluginInventory.list` | P2 |
| 会话导出 | `GET /api/session.export?sessionId=…` ZIP | P2 |
| Host 转发事件 | host 帧 `host/remote-event{event,args}`：`settings/document-updated`、`llm/adapters-updated`、`agent-preset/selected`、`commands/change` 等（`remote-events.ts:17-28`） | P1 |
| 插件安装/卸载 | （现有桌面 `dsh plugin` 面板已覆盖，不经 API） | 已有 |

### 2.4 内核 API 未暴露的能力与对策

| 缺口 | 影响 | AirCode 对策 |
|---|---|---|
| **无工作区文件读取/文件树 API**（`packages/fs` 全 Host-only；`host.listDirectory` 仅列目录） | 官方前端看不了文件内容 | **对桌面端不构成缺口**：代码模块由主进程 `workspace/` service 直接读盘（比经内核更快更全），§5.2 |
| `session.list` 无分页（cursor 占位） | 超大档案列表全量拉取 | 客户端侧虚拟化即可，量级可接受 |
| mux 无 `since` 断点续传 | 重连丢实时段事件 | 重连流程：重开双流 → 重拉 `session.history`（尾页含 partial + 投影基线）→ 恢复订阅 |
| 不可远程 spawn subagent/workflow | 只能浏览 | UI 只提供浏览/continuable 对话入口，符合"代理自主"语义 |
| jobs 只读 | 无法杀后台任务 | 展示 + 提示用户在会话中要求 agent 处理 |
| plan/权限预设无写 RPC | — | Composer 内建 `/plan`、`/permission` 斜杠命令快捷项 |
| settings/agentPreset loopback-only | 非回环前端不可用 | AirCode 内核恒在 127.0.0.1，无影响 |
| 主题/语言无 Host API | — | 本地 persist（现状沿用） |

---

## 3. 总体架构

### 3.1 进程模型（保持现有三层，职责扩张）

```
┌─ Electron Main（Node）─────────────────────────────────┐
│ 现有：runtime/kernel/server/profiles/plugins/setup/logs │
│ 新增 services（均不依赖 electron，可 node 直测）：        │
│  ├─ workspace/   工作区目录树、文件读写、watch           │
│  ├─ lsp/         语言服务器管理（spawn/生命周期/能力路由）│
│  ├─ format/      prettier/biome 格式化（项目配置优先）    │
│  ├─ git/         simple-git 封装（status/diff/commit…） │
│  ├─ ssh/         ssh2 连接池、shell 通道、sftp 会话      │
│  ├─ terminal/    node-pty 本地终端                      │
│  ├─ cicd/        流水线解析/执行器/日志流               │
│  └─ secrets/     safeStorage 凭据保管（SSH 密码/密钥）   │
└───────────────────────▲────────────────────────────────┘
                        │ contextBridge IPC（类型三段式：
                        │ shared/ipc.ts → preload → shared/api.ts）
┌─ Electron Renderer（React 19）──────────────────────────┐
│ dsh-client（WS 直连内核）                                │
│ modules/（六大业务模块，见 §3.2）                        │
│ shared-ui/（设计系统：组件 + 令牌 + hooks）              │
└─────────────────────────────────────────────────────────┘
```

原则延续 AGENTS.md：services 不 import electron；生产改动配同区测试；持久化结构向后兼容。

### 3.2 渲染进程目录结构

```
src/renderer/src/
├── main.tsx / App.tsx
├── app/                    # 外壳：TitleBar/ActivityBar/StatusBar/命令面板
│   ├── ActivityBar.tsx
│   ├── StatusBar.tsx
│   ├── CommandPalette.tsx
│   └── layout.ts           # 面板显隐/尺寸（zustand persist）
├── dsh-client/             # §2.2 协议层（纯 TS，无 React）
├── modules/
│   ├── agent/              # 会话模块（P0 核心）
│   │   ├── components/     # Timeline/Message/ToolCard/ApprovalCard/Composer
│   │   ├── renderers/      # markdown/code/diff/terminal-output 渲染器
│   │   ├── store.ts        # 会话状态机（事件 → 不可变更新）
│   │   └── hooks.ts
│   ├── ide/                # IDE 模块：编辑 + 整理 + Diff 审阅（非全 IDE）
│   │   ├── FileTree.tsx / EditorTabs.tsx / DiffView.tsx / ProblemsPanel.tsx
│   │   ├── editor/         # CM6 装配：语言/键位/autocomplete/lint/search
│   │   ├── lsp.ts          # @codemirror/lsp-client ↔ IPC ↔ 主进程 lsp service
│   │   └── store.ts
│   ├── git/                # 变更列表/分支/diff/commit/日志
│   ├── servers/            # SSH 连接管理 + SFTP 双栏 + 远端终端
│   ├── cicd/               # 流水线列表/详情/日志流/触发
│   └── settings/           # 现有设置/档案/内核/插件面板迁移
├── shared-ui/
│   ├── components/         # Button/Input/Modal/Tooltip/Menu/Toast/Badge…
│   ├── icons/              # lucide-react 封装
│   └── tokens.css          # 现有 Codex 风语义色板扩展
├── stores/                 # 跨模块：appStore/sessionStore/connectionStore
└── lib/                    # 纯工具（时间格式化/路径/字节）
```

### 3.3 模块间联动（"统一"的核心价值）

| 联动 | 流向 | 实现 |
|---|---|---|
| 会话引用文件 | agent ← ide | @文件名补全 → Composer 附件；点击消息内文件路径 → IDE 模块打开 |
| 工具改动落盘可见 | agent → ide/git | 内核事件含文件写 → file watcher 刷新编辑器/Git 变更计数 |
| Diff 审阅 | agent → code | 会话中 tool diff 卡片"在编辑器中打开" → DiffView 标签页 |
| 终端即工具 | agent ↔ terminal | 会话中 shell 工具调用可"在终端中重放"；终端选区发送至会话 |
| CI 状态 | cicd → statusbar | 状态栏轮询/事件推送流水线状态 |
| Git 上下文 | git → agent | "总结当前变更"：git diff → 会话输入 |

---

## 4. 技术选型

### 4.1 决策总表

| 领域 | 选定 | 备选 | 决策理由 |
|---|---|---|---|
| 框架 | **React 19 + TS + electron-vite**（沿用） | — | 现状即此，团队已有积累 |
| 样式 | **Tailwind 4 + 语义令牌**（沿用扩展） | CSS-in-JS | 现有 tokens.css 已是 Codex 风暗/亮色板 |
| 组件基元 | **Radix UI Primitives**（无样式） | shadcn/ui 拷贝式 | Radix 行为完善（焦点圈定/键盘/Portal），样式自有令牌接管；shadcn 亦可但拷贝式会留大量死代码 |
| 图标 | **lucide-react** | 自绘 SVG | 全、轻、风格统一 |
| 状态 | **zustand**（沿用）+ 模块 store | Redux/Jotai | 现已在用；会话模块用"事件 reducer"模式写 zustand action |
| 长列表虚拟化 | **@tanstack/react-virtual** | react-window | 会话时间线/日志流必备；API 现代、维护活跃 |
| Markdown | **react-markdown + remark-gfm** | markdown-it 自渲染 | 生态成熟，组件级代码块替换 |
| 代码高亮 | **Shiki**（TextMate 级，VS Code 同 grammar） | highlight.js / Prism | 质量最高；消息内代码块用 shiki 预着色，避免运行时全量加载可用 fine-grained bundle |
| 编辑器 | **CodeMirror 6**（+ 官方扩展群） | Monaco | 见 §4.2 专项对比（含 IDE 模块需求修订） |
| Diff 视图 | **自研 split/unified 渲染 + diff 库（diff）** | monaco diff / react-diff-view | 见 §4.2 |
| 编辑器扩展 | **@codemirror/autocomplete / lint / search / commands + VS Code 键位（@replit/codemirror-vscode-keymap）** | — | 多光标、搜索替换、括号配对、折叠、注释切换等编辑基础全是官方包，补齐 Monaco 的"开箱手感" |
| LSP 客户端 | **@codemirror/lsp-client（官方）** | monaco-languageclient | 补全/悬停/诊断/重命名/organize imports——语言智能来自外挂语言服务器，两个编辑器在此平权（Monaco 仅 TS/JS 零配置占优） |
| 语言服务器托管 | **主进程 `lsp/` service**（spawn typescript-language-server 先行，pyright/rust-analyzer/gopls 后续；随应用捆绑或按项目检测） | 内核 packages/lsp | 内核 lsp 包面向 agent 工具，无 Remote API（§2.4），前端 IDE 模块需自持语言服务器生命周期 |
| 格式化 | **主进程运行 prettier / biome**（优先用项目自身依赖与配置；fallback 应用内置） | LSP formatting | "整理"的机械部分；保存时格式化 + 手动 ⌘⇧F |
| 终端 | **@xterm/xterm + addon-fit/addon-web-links/addon-search** | — | 事实标准（VS Code/Hyper 同） |
| 本地 PTY | **node-pty**（主进程） | child_process 裸管道 | 真 PTY 才能跑交互式 TUI |
| SSH/SFTP | **ssh2**（主进程） | node-ssh（ssh2 封装） | 底层可控（连接池/跳板/keepalive）；node-ssh 太薄 |
| Git | **simple-git**（主进程，spawn 系统 git） | isomorphic-git / dugite | isomorphic-git 对大仓库慢且无 LFS；dugite 需捆绑 git 二进制（增大包体 30MB+）。桌面端可检测系统 git，缺失时引导安装；后续可选 dugite 兜底 |
| 凭据存储 | **electron safeStorage + 本地加密文件** | keytar | safeStorage 零原生依赖（keytar 需预编译），SSH 密码/token 落 OS 钥匙串加密 |
| CI/CD 执行 | **自研 YAML 流水线执行器（主进程，pty 跑步骤）** | act | act 需 Docker，过重；自研执行器与终端/日志流复用同一套基础设施。远端 CI（GitHub Actions）走 REST API 只做状态/日志只读集成 |
| YAML | **yaml**（eemeli） | js-yaml | 维护活跃、TS 友好 |
| 文件监听 | **chokidar**（主进程） | fs.watch 裸用 | 跨平台稳定性 |
| 模糊匹配(⌘K/⌘P) | **fzf-for-js** | fuse.js | fzf 算法排序质量高、快 |
| 路由 | **zustand 视图状态**（沿用，无 react-router） | react-router | Electron 单窗口多模块，URL 语义无意义；视图状态 + persist 即可 |
| i18n | **沿用现有 i18n.ts** 轻扩展 | react-i18next | 现有字典式已够用，模块词条按命名空间拆 |
| 测试 | **vitest**（沿用）+ @testing-library/react | — | services/core 纯函数测试沿用现有分区规则 |
| 日期/字节等小件 | **date-fns / pretty-bytes** | — | — |

### 4.2 编辑器专项：CodeMirror 6 vs Monaco（含 IDE 模块需求）

> 需求基线（已按用户确认更新）：IDE 模块 ≠ 完整 IDE，但要能**真实地编辑与整理代码**——
> 多光标/搜索替换/格式化/补全/诊断/符号重命名/import 整理，弥补 AI coding 不擅长的
> 人工精修环节；不做调试器、不做扩展生态。

| | CodeMirror 6 | Monaco |
|---|---|---|
| 包体/内存 | ~0.5MB，标签页实例廉价 | ~4MB+，每标签页都重（web worker） |
| 编辑基础（多光标/搜索/折叠/键位） | 官方扩展群全有，VS Code 键位有社区包 | 开箱即用 |
| Diff | 官方 `@codemirror/merge`（unified/split + 逐块接受/回退） | 内置 DiffEditor 极成熟 |
| 语言智能（补全/诊断/重命名/整理） | `@codemirror/lsp-client` + 外挂语言服务器 | 仅 TS/JS 零配置内置；其余语言同样要外挂 monaco-languageclient |
| 嵌入 Electron | 纯 ESM 无负担 | worker/loader/asar 配置繁琐 |
| 嵌入会话时间线 | 轻量实例可多处挂载 | 不可行（太重） |
| 大文件 | 好（增量解析 + 视口虚拟化） | 好 |

**结论：IDE 模块需求不改选型，仍选 CodeMirror 6。** 关键论证：

1. **"编辑、整理"的语言智能来自外挂语言服务器，与编辑器选型无关。** 补全/诊断/重命名/organize imports 都是 LSP 能力；Monaco 唯一独占的是 TS/JS 零配置 IntelliSense，而 `typescript-language-server` 只是个几 MB 的 npm 包，捆绑或按项目检测即拉平这一差距。
2. **IDE 模块活在"会话为中心"的工作台里**：编辑器要同时出现在代码标签页、Diff 审阅页、（轻量形态的）会话 diff 卡片三处，实例成本直接决定多标签体验，CM6 的轻量是硬优势。
3. **Monaco 的杀手锏（调试器 UI、完整 VS Code 服务层）恰是用户明确不要的"完整 IDE"部分。**

"整理"能力的逐项落地路径：

| 整理动作 | 实现 |
|---|---|
| 格式化（保存时/手动） | 主进程 prettier / biome，优先项目自身依赖与配置 |
| import 整理/排序 | LSP code action（`source.organizeImports`，ts-server 原生支持） |
| 符号重命名、提取函数等重构 | LSP `rename` / code actions（`@codemirror/lsp-client`） |
| 文件移动/重命名联动改 import | LSP `willRenameFiles` + workspace edit（typescript-language-server 支持） |
| 机械整理（排序行/去重/大小写/去尾空白） | 本地 CM 命令，无需语言服务器 |
| 诊断（红线/问题面板） | LSP diagnostics → 底部"问题"页签（布局 §1.2 已预留） |

### 4.3 渲染性能预算

- 会话时间线：react-virtual 虚拟化；流式 delta 经 `requestAnimationFrame` 合帧提交 store（每帧一次，非每 token 一次）。
- Markdown 消息：渲染结果按 `messageId + version` memo；Shiki 高亮走异步 + 缓存，避免阻塞流式。
- 终端：xterm canvas 渲染器（`@xterm/addon-canvas`）；主进程 pty 数据经 IPC 批量转发（16ms 聚合）。
- 大日志（CI）：虚拟化 + 尾部跟随锁定。

---

## 5. 各模块设计要点

### 5.1 Agent 会话（P0，自研替代官方 UI）

**协议调用链**（对照官方实现逐环节对齐，括号内为官方参考源码）：

```
Composer.send(text, images?)
  → dshClient.session.prompt({sessionId, mode:'queue'|'steer', content, clientTimeZone})
    （rpcId 由 dsh-client 生成并记录 → 乐观回显，待 user/message.source 携带同 rpcId 对账）
  → mux 帧回流 → sessionStore.applyMuxFrame
    · session/event{event,view} → reducer：
      assistant/chunk(StreamChunk) 折叠为进行中消息（partial）
      assistant/message 定稿；tool/call|result 挂 view 渲染意图
      turn/start|end 驱动"运行中/可中断"状态
    · approval/requested → PendingApproval 卡片（rpcId 稳定，重连重放→幂等重建）
    · session/projection → title/todos/plan/permissions/tokenMeter 侧栏与状态栏
  → 用户点审批 → dshClient.respond(rpcId, {sessionId,approvalId,outcome}) → approval/resolved 收敛
```

（官方参考：`ui-conversation/src/client/service.ts:130`、`client/runtime/sessions/session.ts:190-264,471-519`、`sessions/manager.ts:696-789`、`sessions/partial.ts`、`conversation-assembler.ts`）

- **状态机**：`sessionStore.applyEvent(ev)` 纯函数 reducer（可单测）；时间线条目 = 不可变结构 + 版本号；按 `Map<sessionId, SessionSlice>` 分片。
- **消息渲染管线**：text delta → markdown（react-markdown，代码块 → Shiki）；tool call → ToolCard（按工具名注册渲染器：bash→终端样式块、edit→内联 diff、read→代码块…）；`ToolEventView`（Host 计算的渲染意图）优先于本地猜测；approval → ApprovalCard（允许一次/拒绝；策略类"总是允许"走 `/permission` 斜杠命令）。
- **Composer**：textarea 自适应、@文件引用（Typert `fileReferences.list` + fzf 排序）、/斜杠命令（`commands.list`）、图片粘贴/拖放（base64 → PromptContentPart）、模型选择器（`session.models`）、queue/steer 双模式（运行中发送入队，可 steer 插话）、⏹ 中断（`session.cancel`）。
- **历史**：会话列表侧栏（`session.list` + `session.search` + host 帧增量 + title 投影），向上翻页 `session.history{beforeSeq}`（页 50）。
- **断线恢复**：重连后重拉 `session.history` 尾页（含进行中 partial + 投影基线）→ 重建 partial；pending approval 由 `approval/requested` 重放幂等重建。

### 5.2 IDE 模块（P1，编辑 + 整理，弥补 AI coding 的人工精修环节）

定位：**会话做生成，IDE 模块做精修**。Agent 改完 → Diff 审阅 → 人工微调/整理 →（可选）让 Agent 继续。不做调试器与扩展生态。

- **根目录锚定内核工作区**：`workspace.list` → `WorkspaceView.path`（会话 cwd 同源），保证 IDE 与 Agent 上下文一致。
- **文件树**：主进程 `workspace/` service 懒加载 + chokidar 变更推送（**内核无文件读取 API**（§2.4），桌面端直读本地磁盘是天职）；支持重命名/移动/删除，TS 项目走 `willRenameFiles` 联动改 import。
- **编辑器**：标签页 + CM6。编辑基础全家桶：多光标/矩形选择、搜索替换面板、括号配对、折叠、注释切换、缩进单位、VS Code 键位（降低肌肉记忆迁移成本）。保存时格式化（主进程 prettier/biome，项目配置优先）+ 手动 ⌘⇧F。
- **语言智能（二期）**：`@codemirror/lsp-client` ↔ IPC ↔ 主进程 `lsp/` service（spawn typescript-language-server 先行）。能力：补全、悬停文档、诊断（→ 底部"问题"页签）、跳转定义/引用、符号重命名、`source.organizeImports` code action。服务器注册表按项目文件自动检测（pyright/rust-analyzer/gopls 后续）。
- **机械整理**：排序行/去重/去尾空白/大小写转换等本地命令，进命令面板。
- **Diff 审阅**：@codemirror/merge（split/unified、逐块接受/回退），与会话/Git 共用。
- ⌘P 快速打开（fzf）、⌘⇧O 符号跳转（LSP documentSymbol，二期）。

### 5.3 Git 仓库管理（P1）

- 主进程 `git/` service：simple-git 封装 status/log/diff/branch/add/commit/push/pull/stash；仓库发现（工作区根 `.git`）。
- UI：变更列表（按文件分组、行内 stage）、Diff 视图、分支选择器、commit 框（可选 AI 生成 commit message —— 复用 dsh-client 发会话）、提交图（轻量列表先行，图形化 P2）。
- 状态栏分支显示 + 变更计数轮询（事件驱动：watcher 触发）。

### 5.4 服务器 SSH/SFTP（P2）

- 主进程 `ssh/`：ssh2 连接池（多服务器并存）、密码/密钥/agent 认证、keepalive、跳板机（ProxyCommand 等价实现）；凭据走 safeStorage。
- 终端：renderer xterm ↔ IPC ↔ ssh2 shell 通道（与本地 pty 终端共用组件，传输层抽象）。
- SFTP：双栏文件管理器（本地树/远端树）、传输队列（进度/取消/续传）、右键（重命名/删除/权限）。

### 5.5 CI/CD（P2）

- 流水线定义：`.aircode/pipelines/*.yaml`（自家精简 schema：steps/env/timeout/cache），主进程执行器经 node-pty 逐步执行，日志实时推 renderer。
- 远端集成（只读优先）：GitHub Actions REST（workflow runs/logs）轮询 + 状态栏徽标。
- UI：流水线列表（状态徽标）、详情（步骤树 + 日志流，虚拟化）、手动触发/取消。

### 5.6 设置/档案/内核/插件（已有，迁移）

现有面板全部保留平移至新外壳，改动仅是导航从 Sidebar 项变为 ActivityBar 项。

---

## 6. UI/UX 规范

- **设计令牌**：沿用现有 `--bg-* / --text* / --accent / --ok/--warn/--err` 语义色板（Codex 暗色基调），扩展：编辑器语法色（Shiki 主题与令牌对齐）、终端 16 色、Diff 增删色（`--diff-add/--diff-del` 半透明绿/红）。
- **字体**：UI `-apple-system…`（现有）；代码/终端 `ui-monospace, SF Mono, JetBrains Mono, Consolas`。
- **快捷键**（Electron 菜单 + renderer keydown 双轨）：
  - ⌘K 命令面板 / ⌘P 快速打开 / ⌘B 侧栏 / ⌘J 底部面板 / ⌘1..6 模块切换
  - 会话内：⌘Enter 发送（可选 Enter）、Esc 中断、⌘L 新会话
- **动效**：克制，仅面板显隐/Toast 用 120ms ease（与现有一致）。
- **空态/加载/错误**：每模块三态组件统一（现有 connecting/retry 模式推广）。

---

## 7. 数据流与状态管理

```
内核事件 ──WS──▶ dsh-client.events ──▶ sessionStore.applyEvent ──▶ React
用户操作 ──▶ dsh-client.rpc ──▶ 内核
主进程事件（pty/sftp/git/ci）──IPC──▶ 各模块 store ──▶ React
```

- **connectionStore**：连接状态机（connecting/ready/degraded/reconnecting），全局横幅 + 自动重连（500ms×2→10s）；重连后自动重拉 `session.history` 尾页恢复 partial 与投影基线。
- **sessionStore**：每会话一个切片（Map<sessionId, SessionSlice>），事件 reducer 纯函数 + 单元测试；投影合并按 high-seq-wins。
- **乐观回显对账**：发送时以本地 rpcId 先行上屏，`user/message.source` 回带同 rpcId 后确认，避免重复气泡。
- **审批幂等**：`approval/requested` 重连会重放，ApprovalCard 以 approvalId 去重，断线期间审批不丢。
- **跨模块事件总线**：轻量 emitter（自研 30 行）用于"打开文件/Diff"类模块间命令，避免 store 互相 import。

---

## 8. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| **M0 协议验证**（1 周） | dsh-client transport/wire/rpc/events 骨架 + 主进程 kernel-proxy；**CLI 脚本**跑通全链路：① `host.describe` 探活 ② 开 mux/host 双 WS（实测 WS upgrade 的 Origin 判定，定直连/兜底）③ `session.list` → `session.create` → `session.prompt('hello')` ④ 消费 mux 至 `turn/end`（验证 StreamChunk 折叠）⑤ 触发一次审批并 `/api/respond` 应答 ⑥ `session.cancel` ⑦ `session.models`/`selectModel` ⑧ 断线重连 + 重拉 history 恢复 | CLI 脚本全链路日志（不经 UI）；8 步全绿 |
| **M1 会话 P0**（2–3 周） | agent 模块完整替代 webview：时间线/Composer/审批/模型切换/中断/历史 | 日常开发自用一周，官方 UI 不再打开 |
| **M2 工作台骨架 + IDE 一期**（2–3 周） | ActivityBar/状态栏/⌘K/底部面板；文件树 + CM6 编辑（VS Code 键位/搜索/多光标）+ 保存时格式化（prettier/biome）+ @codemirror/merge Diff 审阅 | 会话文件引用可跳转编辑器；人工精修一处 Agent 改动并保存 |
| **M3 Git 模块 + IDE 二期**（2 周） | Git：status/diff/commit/分支；IDE：LSP 接入（typescript-language-server 先行）——补全/诊断→问题面板/重命名/organize imports | 完整提交工作流；TS 项目内完成一次符号重命名 + import 整理 |
| **M4 SSH/SFTP**（2 周） | 连接管理/远端终端/双栏传输 | 管理一台真实服务器 |
| **M5 CI/CD**（2 周） | 本地流水线执行器 + GitHub Actions 只读 | 一条流水线跑通并推状态栏 |
| **M6 打磨**（持续） | 子代理/工作流可视化、主题精修、性能 | — |

策略：M1 完成前保留 webview 作为 fallback 视图（ActivityBar 隐藏入口），会话模块达标后移除。

---

## 9. 风险与对策

| 风险 | 影响 | 对策 |
|---|---|---|
| DSH 流式协议是内部演进态，无稳定承诺 | 内核升级打破前端 | wire 类型随内核版本锁定 + CI 协议 diff 校验；fallback：临时切回 webview 视图 |
| ~~HTTP 路由存在 CORS 限制~~ **已确认：Origin/Host 信任围栏拦非同源 HTTP 与 WS** | renderer 无法直连内核任何端点（curl 实测：WS 带 Origin → 403） | **已纳入架构**：HTTP RPC 与事件流一律经主进程 kernel-proxy（§2.1，M0 已实现并实测通过） |
| 权限审批等交互语义复杂 | 审批漏实现导致 agent 卡死 | M0 用脚本穷举 permission 事件流；对照官方 ui-permission-presets 源码逐条对齐；`approval/requested` 帧与 `/api/respond` 应答配对由 dsh-client 应答器统一处理 |
| 会话功能长尾（附件/语音/feedback…） | 体验缺口 | 能力覆盖矩阵（§2.3）按优先级排期；webview fallback 兜底至 M1 验收 |
| node-pty 原生模块打包 | asar/重建问题 | electron-builder 原生依赖 unpack 配置（成熟方案）；CI 提前验证 pack |
| Shiki 全量 grammar 体积 | 首屏变慢 | fine-grained bundle + 懒加载 + 常用语言预置 |

---

## 10. 不做的事（本阶段）

- 不做完整 IDE：无调试器、无扩展市场、不做 Monaco 级开箱 IntelliSense（语言智能按需经 LSP 接入，§4.2/§5.2）。
- 不做协作/多人。
- 不 fork 内核与官方前端；内核保持官方二进制一键安装。
