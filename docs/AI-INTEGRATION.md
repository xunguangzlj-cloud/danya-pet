# AI 接入说明 · AI integration

## 已验证范围

本地 Windows 桌面启动、stdio MCP 初始化、工具列表、动作与工作状态接口已验证。DSH 源码入口继承自 0.3.0；未在 DSH、豆包、Codex、GLM 四个客户端逐一完成真实安装验收。

「支持 MCP」是接口能力，不代表任意客户端或网页聊天版本都允许本地 MCP。特别是网页型工具，若没有本地工具扩展入口，不能直接挂载此程序。

## 配置原则

1. 先安装桌面版，确认双击快捷方式可运行。
2. 进入 AI 工具的本地 MCP 配置处，添加 README 中的通用配置。
3. `command` 指向安装版 `运行时/达妮娅桌宠.exe`；`args` 指向 `源码/dsh-pet/standalone/mcp.mjs`；必须设置 `ELECTRON_RUN_AS_NODE=1`。
4. `DANYA_AI_NAME` 用作右键网站菜单的显示名；`DANYA_SITE_URL` 填自己实际使用的网站地址。它不是 API endpoint 或密钥。
5. 初始化后先调用 `pet_info`，读取当前形态的动作清单，再调用 `pet_action`。

不同 AI 客户端的配置格式应以该客户端当前文档为准。以下只给名称映射，不虚构客户端专用命令或“已实测兼容”：

| 用户工具 | 显示名可填 | 使用前提 |
|---|---|---|
| DSH | DSH | 其版本支持 MCP 或本地 Cordis 插件加载；后者需单独验收 |
| 豆包 | 豆包 | 所用客户端具备本地 MCP 进程入口；普通网页不能据此保证挂载 |
| Codex | Codex | 其 MCP 配置接受本地 stdio server |
| GLM | GLM | 所用客户端具备本地 MCP 或外部工具扩展 |

## 工具

| 工具 | 参数 / 返回 |
|---|---|
| `pet_info` | 无参数；返回当前 formId、可用动作、连接状态 |
| `pet_action` | `name`：当前形态内的动作名；跨形态或不存在的动作会拒绝 |
| `pet_status` | `state`：thinking / working / result / waiting / success / error / idle；可选 text/source |

可以在 AI 的项目指令中写：「开始处理任务时调用 pet_status working；需要用户确认时 waiting；结束时 success，恢复 idle。点播动作前先读 pet_info。」客户端是否调用仍由其工具机制决定。

`text` 仅作状态记录，不显示说话框。桌宠不调用模型、不读取账户、不查询余额。关闭 AI 后，已启动的独立桌宠继续运行；右键退出才结束桌面服务。

## 编程助手 Hook 联动（事件驱动，无需 AI 主动调用）

除了 MCP 主动调用，编程助手还可以通过 **hook 事件**驱动桌宠：AI 一提交提示词她就进入思考、跑工具时进入工作、等批准时等待、结束时回待机——全程零交互。事件桥是零依赖脚本 `tools/ai-hooks/pet-hook.mjs`，把事件映射为 `POST /api/event` 到本机桌宠服务，失败静默、绝不阻塞助手。

**一键安装**：运行 `tools/ai-hooks/接入编程助手.ps1`（撤销加 `-Remove`），自动写入并备份以下三处配置：

| 工具 | 配置位置 | 机制 |
|---|---|---|
| Claude Code | `~/.claude/settings.json` 的 `hooks` | stdin 事件 JSON → 状态 |
| Codex CLI | `~/.codex/config.toml` 的 `notify` | 事件 JSON 作为参数 → 状态 |
| ZCode | `~/.zcode/cli/config.json` 的 `hooks.events` | 事件名参数 + stdin JSON → 状态 |

事件映射：提交提示词 → `thinking`；工具执行 → `working`；需要批准/通知 → `waiting`；工具失败 → `error`（ZCode）；回合结束/会话结束 → `idle`。

**手动接入**：任意支持进程 hook 的工具，执行 `node <路径>/tools/ai-hooks/pet-hook.mjs <claude|codex|zcode>`，事件 JSON 走 stdin（Codex 走最后一个参数）即可。端口默认 18430，可用环境变量 `DANYA_PET_PORT` 覆盖。

## English

Configure a local stdio MCP server using the bundled runtime executable, `standalone/mcp.mjs`, and `ELECTRON_RUN_AS_NODE=1`. Optional `DANYA_AI_NAME` and `DANYA_SITE_URL` provide a menu label and website address. Call `pet_info` before choosing an animation. `pet_status` expresses a client-supplied work state; the pet does not observe conversations automatically. Client-specific DSH/Doubao/Codex/GLM setup remains unverified.

**Coding-agent hooks (event-driven)**: run `tools/ai-hooks/接入编程助手.ps1` to register a zero-dependency bridge (`tools/ai-hooks/pet-hook.mjs`) into Claude Code hooks, Codex `notify`, or ZCode `hooks.events`. Agent events map to work states (prompt → thinking, tools → working, approval → waiting, failure → error, turn end → idle) via a local `POST /api/event`; failures are silent and never block the agent. Override the port with `DANYA_PET_PORT`.
