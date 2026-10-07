# Danya Pet 🐾 · 达妮娅桌宠

<div align="center">

<img src="assets/preview/demo-hero.gif" alt="Danya Pet demo: quietly idling, startled when clicked, then celebrating" width="480">

**A transparent chibi Denia living on your Windows desktop** — 83 animations, three outfits, quiet company while you work, and a reaction every time you poke her.

[⬇️ Download installer](https://github.com/xunguangzlj-cloud/danya-pet/releases/latest) · [🇨🇳 中文说明](README.md) · [💬 Discussions](https://github.com/xunguangzlj-cloud/danya-pet/discussions) · [🐞 Issues](https://github.com/xunguangzlj-cloud/danya-pet/issues)

![Release](https://img.shields.io/github/v/release/xunguangzlj-cloud/danya-pet?sort=semver)
![Downloads](https://img.shields.io/github/downloads/xunguangzlj-cloud/danya-pet/total)
![Platform](https://img.shields.io/badge/platform-Windows%20x64-8A2BE2)
![Forms](https://img.shields.io/badge/forms-3-ff69b4)
![Animations](https://img.shields.io/badge/animations-83-success)
![License](https://img.shields.io/github/license/xunguangzlj-cloud/danya-pet)

</div>

> A fan-made desktop pet based on **dsh-pet 0.3.0**, featuring Denia from *Wuthering Waves*. Unofficial fan work, not affiliated with Kuro Games. Fully usable without any AI account; optionally connects to AI tools via MCP.

---

## ✨ Three outfits, three independent animation pools

<p align="center">
  <img src="assets/preview/demo-forms.gif" alt="Original outfit, bandage and starlight forms side by side" width="640">
</p>

- **Three forms**: right-click "Switch form" cycles Original (71 animations) / Bandage (6) / Starlight (6). Your choice is remembered across restarts.
- **Independent pools**: idle, click, random and work animations all switch together with the form — never mixed.
- **Quiet / random mode**: quiet idle by default, click for a random reaction; turn quiet mode off and she picks the next animation by weight continuously.
- **Desktop interaction**: drag her around, flick to throw with bounce, click-through on empty areas, play any animation on demand, snap back to her corner.
- **Quality preserved**: lossless VP9 Alpha transcode, 834×1112 / 1280×720 @ 60 fps with full transparency.
- **Resizable**: right-click slider from 160–1280 px, saved in real time.
- **Optional AI integration**: MCP tools let clients like Claude Code or Cursor sense her state and direct her animations (below). The pet itself never calls a model.
- **Tray & autostart**: the standalone build lives in the system tray — toggle "start with Windows" and quit cleanly from the tray menu.

## 🚀 Quick start

1. From [Latest Release](https://github.com/xunguangzlj-cloud/danya-pet/releases/latest), download `DanyaPet-Setup.exe`, `MergeAssets.exe` and the three `danya-assets.dat.00*` parts into **one folder**.
2. Double-click `MergeAssets.exe` → click “合并素材” (merge assets) → then “启动安装” (launch installer). Installs to your user's `AppData\Local\Programs\DanyaPet` — **no admin rights needed**.
3. Launch from the finish page, or any time from the “达妮娅桌宠” desktop shortcut.

> 💡 **SmartScreen**: the installer is unsigned. If Windows shows "protected your PC", click "More info → Run anyway". Verify integrity with the bundled `SHA256SUMS.txt`.
>
> 💡 Everything is bundled — no Node/Python, works offline, no AI account or API keys needed. You can delete the installer after setup; keep the `数据/` folder (it survives uninstall) if you want to keep settings.

## 🖱️ Controls

| Action | Result |
|---|---|
| Click the pet | Random click animation from current form |
| Right-click → 切换形态 | Cycle to next form and its animation pool |
| Right-click → 安静模式 | Toggle quiet idle / continuous random |
| Right-click → 调整大小 | Live size slider (160–1280 px) |
| Right-click → 动作 | Play animations by category |
| Drag | Move; quick flick throws her with a bounce |
| Right-click → 回到初始位置 | Return to the configured corner |
| Right-click → 退出桌宠 | Quit |

## 🤖 AI integration (optional)

Danya ships a **stdio MCP** server exposing three tools: `pet_status`, `pet_action` and `pet_info`. Verified with **Claude Code, Claude Desktop, Cursor, ZCode** and other clients that support local MCP processes.

- **One-click setup**: download `tools/ai-connect/接入AI工具.ps1` from this repo, run it with PowerShell, and it detects installed AI tools and writes the MCP config for you (with automatic backup). See [tools/ai-connect](tools/ai-connect/README.md).
- **Coding-agent hooks**: run `tools/ai-hooks/接入编程助手.ps1` to wire Claude Code / Codex / ZCode hook events straight to the pet — she thinks when you submit a prompt, works while tools run, waits for approvals and idles when the turn ends. No AI action needed.
- **Manual setup**: see [docs/AI-INTEGRATION.md](docs/AI-INTEGRATION.md) and substitute your install path.

```json
{
  "mcpServers": {
    "danya-pet": {
      "command": "C:\\Users\\YOUR-NAME\\AppData\\Local\\Programs\\DanyaPet\\运行时\\达妮娅桌宠.exe",
      "args": ["C:\\Users\\YOUR-NAME\\AppData\\Local\\Programs\\DanyaPet\\源码\\dsh-pet\\standalone\\mcp.mjs"],
      "env": { "ELECTRON_RUN_AS_NODE": "1" }
    }
  }
}
```

After connecting, try asking your AI "what is Danya doing?" or "make her dance". She never reads your chats, accounts or browser; integration only happens when the AI calls her tools.

## ⚙️ Configuration

| Path | Contents |
|---|---|
| `数据/设置.json` | Size, quiet mode, current form |
| `数据/连接.json` | Local service address (127.0.0.1 only, not credentials) |
| `数据/运行日志.txt` | Startup / asset troubleshooting log |
| `源码/dsh-pet/assets/config.jsonc` | Forms, animation pools, weights, positioning |
| `源码/dsh-pet/assets/webm/` | 83 transparent character videos |

```json
{ "size": 640, "quietMode": true, "formId": "original" }
```

`formId` accepts `original`, `bandage`, `star`. Edit the settings file while the pet is quit, then start her again.

## 🛠️ For developers

The source repo excludes large videos and the Electron runtime. To develop:

```sh
npm install --ignore-scripts
# copy 源码/dsh-pet/assets/webm/ from the install dir into ./assets/webm/
npm run typecheck && npm test
npm run build:desktop-core && npm run bundle && npm run types
```

Shared logic lives in `src/shared/`; browser and Electron share form-switching and menu components. The local service binds `127.0.0.1` only, default port 18430.

## 🗺️ Roadmap

- [ ] Deeper AI-coding-agent integration: one-click Claude Code / Codex hooks, switching animations while thinking, editing, waiting for permission, done
- [ ] Speech bubbles with local (non-AI) small talk
- [ ] Walking and screen roaming (after shooting movement clips)
- [ ] Autostart and system tray
- [ ] macOS build
- [ ] Lite installer (720p, half the size)

See [docs/ROADMAP.md](docs/ROADMAP.md). Ideas welcome in [Discussions](https://github.com/xunguangzlj-cloud/danya-pet/discussions).

## ❓ FAQ

**Can I use it without AI?** Yes — the desktop app is fully standalone; AI integration is optional.

**Antivirus / SmartScreen warning?** A false positive from the unsigned installer. Verify with `SHA256SUMS.txt`, then allow it. Reports via Issues are welcome.

**How to uninstall?** Quit the pet (right-click), then uninstall from the Start menu / installed apps. Delete the leftover `数据/` folder yourself if you want settings gone too.

**macOS / Linux?** Not yet — on the roadmap.

## ©️ Copyright & license

| Rights holder | Work |
|---|---|
| Kuro Games | *Wuthering Waves* and the Denia character design |

*Character videos and preview screenshots come from the author's local library. This pet is fan creation, not affiliated with Kuro Games. Code is open-sourced under the [MIT license](LICENSE), which **does not cover the character, videos or third-party assets**; no ownership or official endorsement is claimed. See [NOTICE](NOTICE.md).*

## 🤝 Acknowledgements

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) — the desktop-pet foundation (this project is based on v0.3.0, commit `972f1cb9`, with the original MIT license and copyright preserved)
- Kuro Games for *Wuthering Waves*, and the users who provided character video material

**If Danya makes your desktop a little happier, a Star ⭐ is the best encouragement for a fan author.** Watch for updates and share her screenshots in Discussions～

[Changelog](CHANGELOG.md) · [中文说明](README.md) · [Contributing](CONTRIBUTING.md)

## 支持作者

如果这些项目对你有帮助的话，给个star吧~也可以投喂作者一杯奶茶（比心）

<p>
  <a href="assets/donate/alipay.jpg"><img src="assets/donate/alipay.jpg" alt="支付宝收款码" width="300"></a>
  <a href="assets/donate/wechat.jpg"><img src="assets/donate/wechat.jpg" alt="微信收款码" width="300"></a>
</p>
