# 路线图 · Roadmap

> 欢迎在 [Discussions](https://github.com/xunguangzlj-cloud/danya-pet/discussions) 对条目投票或提需求。勾选表示已完成。

## 已完成

- [x] 三形态（原服装 / 缠布条 / 星空），共 83 条独立动作池
- [x] 拖拽、甩抛反弹、点击穿透、动作点播
- [x] 右键调整大小（160–1280 px）
- [x] Windows 离线安装包（自带 Electron 运行时）
- [x] MCP 桥（`pet_status` / `pet_action` / `pet_info`）
- [x] AI 工具一键接入脚本（`tools/ai-connect/`）
- [x] AI 编程助手 hook 状态联动（`tools/ai-hooks/`：Claude Code / Codex / ZCode，提交→思考、工具→工作、失败→出错、结束→待机）
- [x] 系统托盘（开机自启开关、干净退出）与开机自启

## 进行中 / 短期

### AI 编程助手：权限气泡与更多状态
hook 状态联动已上线；下一步是 clawd-on-desk 式的**权限批准气泡**（在桌宠头顶直接 Allow / Deny）和按任务粒度的完成庆祝。

### 说话气泡与碎碎念
头顶气泡显示短句（台词表本地配置，规则触发，不依赖任何模型）。技术路径：透明置顶子窗口 + 文本渲染，随桌宠移动。

### Lite 轻量安装包
当前素材约 3.9 GB（60fps 全画质）。提供 720p/30fps 转码版本（预计 < 1.5 GB），并合并为单文件安装器（NSIS 自解压），减少下载与安装步骤。

## 中期

### 行走与屏幕漫游
上游 dsh-pet 具备漫游系统，但缠布条 / 星空两个形态缺移动类原片。计划用现有 AI 视频管线补拍「原地行走」「侧向移动」素材后解锁。提示词清单已备（61 条未生成编号中含移动类）。

### macOS 版本
Chromium 支持播放 VP9 Alpha，Electron 侧跨平台成本低；Safari 需改用 `.mov` (HEVC) 素材（上游已有成熟方案）。主要工作量在打包、签名（Apple Developer 账号）与触控板交互适配。

## 远期 / 想法

- 多语言 UI（界面文本抽取为 locale 文件）
- 自定义形态导入（导入自己的 VP9 Alpha webm + 配置，复用上游 pet pack 思路）
- 桌宠间联动彩蛋
- 更多角色形态与季节 / 节日限定动作

## 版本节奏

不定期更新，动作素材优先。大功能随 minor 版本发布（0.4.x 起），素材更新走 patch 版本。
