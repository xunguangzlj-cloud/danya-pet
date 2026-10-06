# 达妮娅桌宠 🐾 · Danya Pet

<div align="center">

<img src="assets/preview/demo-hero.gif" alt="达妮娅桌宠演示：安静待机，被点击后惊讶，随即开心庆祝" width="480">

**一只住在 Windows 桌面上的达妮娅** —— 透明 Q 版形象、83 个动作、三种形态，安静陪你干活，点一下就有回应。

[⬇️ 下载安装包](https://github.com/xunguangzlj-cloud/danya-pet/releases/latest) · [🇬🇧 English](README.en.md) · [💬 讨论区](https://github.com/xunguangzlj-cloud/danya-pet/discussions) · [🐞 问题反馈](https://github.com/xunguangzlj-cloud/danya-pet/issues)

![Release](https://img.shields.io/github/v/release/xunguangzlj-cloud/danya-pet?sort=semver&label=%E7%89%88%E6%9C%AC)
![Downloads](https://img.shields.io/github/downloads/xunguangzlj-cloud/danya-pet/total?label=%E4%B8%8B%E8%BD%BD)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-8A2BE2)
![Forms](https://img.shields.io/badge/%E5%BD%A2%E6%80%81-3-ff69b4)
![Animations](https://img.shields.io/badge/%E5%8A%A8%E4%BD%9C-83-success)
![License](https://img.shields.io/github/license/xunguangzlj-cloud/danya-pet)

</div>

> 基于 **dsh-pet 0.3.0** 的定制同人桌宠。角色为《鸣潮》达妮娅（Denia），同人创作，与 Kuro Games 无关。不需要 AI 账号也能完整使用；接入 MCP 后可让 AI 工具与她联动。

---

## ✨ 三种形态，各自独立的一整套动作

<p align="center">
  <img src="assets/preview/demo-forms.gif" alt="原服装、缠布条、星空三种形态对比" width="640">
</p>

- **三种形态**：右键「切换形态」依次轮换（原服装 71 个动作 / 缠布条 6 个 / 星空 6 个），切换后记住选择，重启仍在。
- **动作池独立**：待机、点击、随机、工作状态动作随形态一起更换，互不混播。
- **安静模式 / 随机模式**：默认安静待机，点击随机回应；关闭安静模式后每段播完按权重连续随机。
- **桌面互动**：拖拽移动、快速甩出抛物线反弹、空白区域点击穿透、动作分类点播、一键回到初始位置。
- **画质保留**：VP9 Alpha 无损转码，834×1112 / 1280×720 @60fps，透明通道完整。
- **右键调整大小**：160–1280 px 实时滑杆，等比缩放即时保存。
- **可选 AI 联动**：通过 MCP 让 Claude Code、Cursor 等 AI 工具感知她的状态、指挥她做动作（见下文），桌宠本身不调用任何模型。

## 🚀 快速开始

1. 到 [Latest Release](https://github.com/xunguangzlj-cloud/danya-pet/releases/latest) 下载 `DanyaPet-Setup.exe`、`MergeAssets.exe` 与三个 `danya-assets.dat.00*` 分卷，放进**同一个文件夹**。
2. 双击 `MergeAssets.exe` → 点「合并素材」→ 完成后点「启动安装」。默认装到当前用户的 `AppData\Local\Programs\DanyaPet`，**无需管理员权限**。
3. 安装完成页可直接启动；之后随时双击桌面上的「达妮娅桌宠」。

> 💡 **SmartScreen 提示**：安装程序未做代码签名，首次运行如弹出「Windows 已保护你的电脑」，点「更多信息 → 仍要运行」即可。安装包已附 `SHA256SUMS.txt` 可校验完整性。
>
> 💡 桌面版自带运行环境，**无需安装 Node/Python**，离线可播放全部本地动画，不需要 AI 账号、API 密钥或订阅。安装完成后可删除安装包，但请保留 `数据/` 目录（卸载时也会保留）。

## 🖱️ 操作一览

| 操作 | 结果 |
|---|---|
| 点击角色 | 随机播放当前形态的点击动作 |
| 右键 → 切换形态 | 轮换下一形态及整套动作 |
| 右键 → 安静模式 | 切换安静待机 / 连续随机动作 |
| 右键 → 调整大小 | 打开实时滑杆（160–1280 px） |
| 右键 → 动作 | 按分类点播动画 |
| 拖拽角色 | 移动；快速甩出时抛物线反弹 |
| 右键 → 回到初始位置 | 回到配置角落 |
| 右键 → 退出桌宠 | 退出程序 |

## 🤖 AI 联动（可选）

达妮娅内置 **stdio MCP** 服务，提供 `pet_status`（状态）、`pet_action`（动作）、`pet_info`（信息）三个工具。已验证可用于：**Claude Code、Claude Desktop、Cursor、ZCode** 及其他支持本地 MCP 进程的客户端。

- **一键接入**：下载仓库 `tools/ai-connect/接入AI工具.ps1`，右键「使用 PowerShell 运行」，自动检测已安装的 AI 工具并写入 MCP 配置（修改前自动备份）。详见 [tools/ai-connect](tools/ai-connect/README.md)。
- **手动配置**：见 [docs/AI-INTEGRATION.md](docs/AI-INTEGRATION.md)，把安装路径代入 JSON 即可。

```json
{
  "mcpServers": {
    "danya-pet": {
      "command": "C:\\Users\\你的用户名\\AppData\\Local\\Programs\\DanyaPet\\运行时\\达妮娅桌宠.exe",
      "args": ["C:\\Users\\你的用户名\\AppData\\Local\\Programs\\DanyaPet\\源码\\dsh-pet\\standalone\\mcp.mjs"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

接入后让 AI「看看达妮娅在干嘛」「让她跳个舞」试试。她不会读取你的聊天记录、账户或网页；AI 调用工具才会产生联动。

## ⚙️ 配置与目录

| 路径 | 内容 |
|---|---|
| `数据/设置.json` | 大小、安静模式、当前形态 |
| `数据/连接.json` | 本地服务地址（仅 127.0.0.1，非凭据） |
| `数据/运行日志.txt` | 排查启动或素材问题 |
| `源码/dsh-pet/assets/config.jsonc` | 形态、动作池、权重、画面定位 |
| `源码/dsh-pet/assets/webm/` | 83 条透明角色视频 |

```json
{ "size": 640, "quietMode": true, "formId": "original" }
```

`formId` 可取 `original`、`bandage`、`star`。退出程序后编辑设置文件再启动即可生效。

## 🛠️ 面向开发者

源码仓库不含大体积视频与 Electron 运行环境。开发流程：

```sh
npm install --ignore-scripts
# 从安装目录复制 源码/dsh-pet/assets/webm/ 到源码 assets/webm/
npm run typecheck && npm test
npm run build:desktop-core && npm run bundle && npm run types
```

共享逻辑在 `src/shared/`，浏览器与 Electron 共用形态选择和菜单组件；本地服务仅绑定 `127.0.0.1`，默认端口 18430。

## 🗺️ 路线图

- [ ] AI 编程助手深度联动：Claude Code / Codex hook 一键接入，思考、写码、等权限、完成时切换对应动作
- [ ] 说话气泡与本地碎碎念台词（无需 AI）
- [ ] 行走与屏幕漫游（补拍移动类素材后解锁）
- [ ] 开机自启、系统托盘
- [ ] macOS 版本
- [ ] Lite 轻量安装包（720p，体积减半）

细节与进展见 [docs/ROADMAP.md](docs/ROADMAP.md)。欢迎在 [Discussions](https://github.com/xunguangzlj-cloud/danya-pet/discussions) 提想法。

## ❓ FAQ

**不装 AI 可以用吗？** 可以，桌面安装版完全独立，AI 联动是可选功能。

**杀毒软件/SmartScreen 报警？** 安装程序未签名导致的误报，可用 `SHA256SUMS.txt` 校验后放行；也欢迎在 Issue 反馈误报情况。

**怎么卸载？** 先右键退出桌宠，再用开始菜单或「已安装的应用」卸载；需要彻底清除设置时，另行删除卸载后留下的 `数据/` 目录。

**macOS / Linux？** 暂未提供，在路线图中。

## ©️ 版权与许可

| 版权所有人 | 版权所有内容 |
|---|---|
| Kuro Games（库洛游戏） | 「鸣潮」游戏作品及达妮娅（Denia）角色形象原作 |

*角色视频及预览截图来自用户本地素材库；本桌宠为同人创作，与 Kuro Games 无关联。代码以 [MIT](LICENSE) 许可开源，但**许可不包含角色、视频及第三方素材的权利**；本项目不主张拥有原作角色版权或官方授权，角色素材的再分发范围以 [NOTICE](NOTICE.md) 为准。*

## 🤝 致谢

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) —— 桌宠基础实现（本项目基于 v0.3.0，commit `972f1cb9`，保留原作者 MIT 许可与版权声明）
- Kuro Games 的《鸣潮》原作，以及提供角色视频素材的用户

**如果达妮娅可爱到你了，点个 Star ⭐ 就是对同人作者最大的鼓励**，也欢迎 Watch 关注更新、到 Discussions 晒她的桌面照～

[更新记录](CHANGELOG.md) · [英文说明](README.en.md) · [参与贡献](CONTRIBUTING.md)
