# AI 工具一键接入

把达妮娅桌宠的 MCP 服务（`pet_status` / `pet_action` / `pet_info` 三个工具）写入常见 AI 工具的本地配置，免去手改 JSON。

## 使用方法

1. 下载本目录的 `接入AI工具.ps1` 和 `一键接入.bat`（放到任意文件夹）。
2. 双击 `一键接入.bat`（或右键 `接入AI工具.ps1` →「使用 PowerShell 运行」）。
3. 脚本会：
   - 自动定位桌宠安装目录（默认 `AppData\Local\Programs\DanyaPet`，可手动输入）；
   - 列出检测到的 AI 工具，确认后写入配置；**每次修改前自动备份**为 `原文件名.bak-danya-时间戳`；
   - 对未列出的工具，把配置片段复制到剪贴板，照其文档手动粘贴即可。

## 支持情况

| 工具 | 方式 | 配置文件 |
|---|---|---|
| Claude Desktop | 自动写入 | `%APPDATA%\Claude\claude_desktop_config.json` |
| Cursor | 自动写入 | `~/.cursor/mcp.json` |
| Claude Code | 自动写入 | `~/.claude.json`（用户级 `mcpServers`） |
| ZCode / Cline / Cherry Studio 等 | 复制片段，手动粘贴 | 各自的 MCP 服务器设置 |

写入的条目等价于：

```json
{
  "command": "<安装目录>\\运行时\\达妮娅桌宠.exe",
  "args": ["<安装目录>\\源码\\dsh-pet\\standalone\\mcp.mjs"],
  "env": { "ELECTRON_RUN_AS_NODE": "1" }
}
```

## 撤销

- 删除对应配置文件里 `mcpServers` 下的 `danya-pet` 键；或
- 恢复同目录下的 `.bak-danya-*` 备份文件。

## 说明

- 脚本只读写本地 JSON 配置，不发起网络请求，不执行其他程序。
- 修改生效需**重启对应的 AI 工具**。
- 更多联动玩法见仓库 [docs/AI-INTEGRATION.md](../../docs/AI-INTEGRATION.md)。
