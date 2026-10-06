# 更新记录

## 未发布

- 新增 `tools/ai-hooks/`：AI 编程助手 hook 联动——`pet-hook.mjs` 事件桥把 Claude Code / Codex / ZCode 的 hook 事件映射为桌宠工作状态（提交→思考、工具→工作、批准→等待、失败→出错、结束→待机），`接入编程助手.ps1` 一键写入三处配置（自动备份，支持 `-Remove` 撤销）。已在本机 E2E 验证事件全链路。
- 独立桌面版新增系统托盘：开机自启开关（指向安装根目录启动器）与「退出桌宠」（写 `退出.flag`，由本地服务收尾整个进程组）。
- helper 冒烟分支改为不直接发网络请求（集成菜单验证交由冒烟发起方）。
- `lib/` 构建产物不再入库。

### README 改版（未发布）

- README 全新改版：动作演示 GIF（待机 → 惊讶 → 庆祝）与三形态对比图置顶，动态版本/下载徽章，新增路线图与 SmartScreen/杀软误报 FAQ。
- 新增 `tools/ai-connect/`：AI 工具一键接入助手，自动写入 Claude Desktop / Cursor / Claude Code 的 MCP 配置（修改前自动备份），其他工具复制片段手动粘贴。
- 新增 `docs/ROADMAP.md`（AI hook 深度联动、说话气泡、行走漫游、托盘自启、macOS、Lite 安装包）与 `docs/promotion/PROMOTION.md`（HelloGitHub 投稿、短视频脚本、awesome 列表 PR、winget 清单草稿）。
- 移除 README 中的第三方售卖链接；支持项目的方式改为 Star / Watch / Discussions。

## 0.3.1

三形态达妮娅桌宠首个公开版本，基于 dsh-pet 0.3.0。

- 单击右键菜单“切换形态”依次轮换三个形态，无需选择子菜单。
- 原服装71条、缠布条6条、星空6条，动作池相互独立。
- 默认安静待机，点击随机动作后恢复待机；安静模式可关闭。
- 实时大小滑杆、透明播放、待机首尾融合、可选 stdio MCP 接入。
- 动作名称与素材文件核对通过；工作状态分类只保留在原服装，菜单已去重。
- 中英文说明、版权所有人表与致谢齐备。

