# 推广材料草稿（自用，不随安装包分发）

## 一、HelloGitHub 投稿

投稿入口：https://hellogithub.com/contribute （项目需开源、README 完整、能直接跑起来）

**项目名**：danya-pet（达妮娅桌宠）

**一句话介绍**（控制在 60 字内）：

> 基于 dsh-pet 的《鸣潮》达妮娅同人桌宠：83 个透明动画、三种形态，拖拽甩抛有物理反弹，离线可用，支持 MCP 接入 AI 工具联动。

**推荐理由**（给编辑看）：

1. 完整的 Windows 离线安装包，双击即用，无需任何开发环境；
2. 素材走 VP9 Alpha 无损管线，60fps 透明桌面动画，画质在同类项目中罕见；
3. 内置 stdio MCP 服务，能让 Claude Code / Cursor 等 AI 工具驱动桌宠，是「AI 编程伴侣」方向的完整可玩示例；
4. 基于开源项目 dsh-pet 的定制实践，保留了上游 MIT 许可与完整致谢，是上游「AI 视频自造桌宠」管线的落地案例。

**投稿截图**：assets/preview/demo-forms.gif（三形态）+ demo-hero.gif（动作演示）

## 二、短视频脚本（B站 / 抖音 / 小红书，15–30 秒）

**标题候选**：
- 「我把鸣潮达妮娅养在了桌面上」
- 「桌面多了个会撒娇的达妮娅，工作效率-50%」
- 「AI 一句话就能指挥的桌面达妮娅」

**分镜**：
1. （0–3s）空荡桌面 → 达妮娅泡泡坐姿浮现，配字幕「她住进了我桌面」
2. （3–8s）点击她：惊讶 → 挥手 → 比心；拖拽甩出去弹两下回来
3. （8–15s）右键切换三形态快切展示；调大小滑杆一闪而过
4. （15–25s）分屏：左边终端让 Claude Code「让达妮娅跳个舞」，她真的动了
5. （25–30s）结尾卡：仓库名 + 「_RELEASE 页直接下载安装包_」

**发布要点**：简介第一行放仓库链接；标签带 #鸣潮 #桌宠 #开源 #Claude；评论区置顶安装步骤（含 SmartScreen 提示）。

## 三、awesome 列表 PR 描述

**目标**：awesome-claude-code（AI 联动条目）、awesome-ai-companion、awesome-wuthering-waves（如有）

> **danya-pet** — A Wuthering Waves Denia desktop pet with 83 VP9-alpha animations. Ships a stdio MCP server (`pet_status` / `pet_action` / `pet_info`) so Claude Code / Cursor can sense and drive the pet. One-click config writer included. (fan-made, Windows)

## 四、winget 清单草稿

提交到 microsoft/winget-pkgs 前需先确定稳定的安装器直链与哈希。三个 YAML（manifests/x/xunguangzlj-cloud/DanyaPet/）：

`DanyaPet.yaml`（版本清单，以 0.3.1 为例）：

```yaml
PackageIdentifier: xunguangzlj-cloud.DanyaPet
PackageVersion: 0.3.1
Installers:
  - Architecture: x64
    InstallerType: nullsoft
    InstallerUrl: https://github.com/xunguangzlj-cloud/danya-pet/releases/download/v0.3.1/DanyaPet-Setup.exe
    InstallerSha256: <填 SHA256SUMS.txt 中的值>
    NestedInstallerFiles: []
```

> 注意：当前安装流程需要 `MergeAssets.exe` 合并素材分卷后才能安装，winget 静默安装要求单文件安装器——先完成 ROADMAP 中的「单文件安装器」再提交。

## 五、发布节奏建议

- 每批新动作素材 → patch 版本（0.3.x），Release notes 附新动作 GIF；
- 每个大功能（hook 联动、气泡、macOS）→ minor 版本（0.4 / 0.5），同步投稿一轮社区；
- 素材更新视频在 B站/小红书同步发，简介挂仓库。
