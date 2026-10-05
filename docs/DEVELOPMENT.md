# 从源码运行

面向 Windows 开发者；普通用户下载 Release 安装包即可。

1. 安装桌面版，从安装目录把 `源码/dsh-pet/assets/webm/` 复制到本仓库的 `assets/webm/`。视频体积较大，未放入 Git 历史。
2. 安装 Node.js 24 或更新版本，在仓库根目录执行 `npm install --ignore-scripts`。
3. 运行 `npm run typecheck`、`npm test`、`npm run build:desktop-core`、`npm run bundle`、`npm run types`。
4. PowerShell 设置 `$env:DANYA_ELECTRON="你的安装目录\运行时\达妮娅桌宠.exe"`，再运行 `node standalone/server.mjs`。
5. 源码布局的数据保存到仓库 `数据/`；安装布局保存到安装根目录 `数据/`。

MCP 源码入口为 `standalone/mcp.mjs`，使用 Node 启动时也要在进程环境中配置 `DANYA_ELECTRON`。客户端具体配置见 AI-INTEGRATION.md。程序不自动读取其他应用的聊天或账户。

`tools/合并素材.cs` 是 Release 分卷合并工具源码；`tools/素材解包.cs` 是安装程序使用的校验解包器源码。两者可用 Windows .NET Framework C# 编译器编译。合并工具使用本版本素材包的固定 SHA256，不允许混用其他版本的分卷。
