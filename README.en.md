# Danya Pet 🐾

> A transparent companion based on dsh-pet 0.3.0: three outfits, independent animation pools, quiet idle and click reactions, optional MCP integration, and a standalone Windows installer. [中文说明](README.md)

**[Source](https://github.com/xunguangzlj-cloud/danya-pet) · [Windows downloads](https://github.com/xunguangzlj-cloud/danya-pet/releases/latest).** A customized fan derivative of dsh-pet v0.3.0.

---

## 🚀 Quick start

Download `DanyaPet-Setup.exe`, `合并素材.exe`, and all three `danya-assets.dat.00*` parts from Releases into one folder. Run `合并素材.exe`, click “合并素材” to join and verify the payload, then “启动安装” to start the installer. For a complete local package, keep the installer and `角色素材.dat` together. Then follow the Chinese wizard, and start the pet from the desktop shortcut. The default destination is the current user's `AppData\Local\Programs\DanyaPet` directory. Administrator privileges are not required.

The installer bundles Electron. Desktop playback works offline without Node, Python, DSH, an AI account, API keys, or a subscription. This distribution targets Windows x64; macOS, mobile and Linux installers are not supplied.

Payload extraction, checksums and isolated app startup passed. Automatic approval blocked executing the installer; the installation/uninstallation wizard has not been tested end to end.

## ✨ Features

![Three outfits captured in the desktop app](assets/preview/三形态.png)

- **One-click outfit cycling:** Right-click “切换形态” cycles Original → Bandage → Starry → Original, without an additional selection.
- **Three outfits:** Original (71 clips), Bandage (6), and Starry (6), totaling 83 transparent videos.
- **Independent pools:** Switching outfits replaces idle, click, random and work-state animations together.
- **Quiet mode:** Original bubble sitting, Bandage standing, or Starry knee-hug sitting. Click to play another animation from the current outfit, then return to idle.
- **Random mode:** Disable quiet mode to select subsequent clips by weight. New outfits have no walking source clips and therefore do not invent walking animations.
- **Smoother idle:** Stable segments omit introductory pose changes; approximately 0.4 seconds of premultiplied-alpha blending joins the end to the start. Finite clips still repeat.
- **Transparent video:** Green backgrounds, corner labels, green spill and detached remnants are cleaned. Outfit details and action props are retained.
- **Source quality:** New clips retain their source dimensions (834×1112 or 1280×720) and 60 fps, using lossless-mode VP9 Alpha encoding after processing. Matting and seam blending modify affected pixels; enlarging does not add detail.
- **Right-click controls:** One-click outfit cycling, quiet mode, a live size slider (160–1280 px canvas width), action selection, reset position and exit.
- **Action categories:** Ordinary actions are listed once; the work-status category is shown only for the Original outfit.
- **Optional AI integration:** A stdio MCP bridge exposes `pet_status`, `pet_action` and `pet_info`. Integration can add a website link to the menu. The pet itself makes no model calls.

## 🔌 AI configuration

See [AI integration](docs/AI-INTEGRATION.md). Replace paths with your installation directory. The runtime executable needs `ELECTRON_RUN_AS_NODE=1` when launching `standalone/mcp.mjs`.

The client must support local stdio MCP processes. No automatic chat reading, account access or balance querying is implemented. State changes require client tool calls. DSH, Codex, Doubao and GLM client-specific installation has not been verified in this delivery; do not interpret a generic MCP example as universal native compatibility.

The original DSH/Cordis host and web entries remain in the source package. Installing the published npm package named `dsh-pet` installs the upstream pet, not this customization (published on GitHub, not npm). Follow your DSH version's local plugin-loading requirements, or use the bundled desktop/MCP path.

## ⚙️ Configuration

User settings live under the installation's `数据/` directory. `size` is canvas width, `quietMode` is a Boolean, and `formId` is `original`, `bandage`, or `star`. Each form has its own `animations`, `animationWeights`, and `animationGeometry` in `assets/config.jsonc`.

The local service listens on loopback, normally port 18430. `数据/连接.json` records the actual address. The uninstaller retains user settings. Exit the pet before uninstalling.

## 🛠️ Development

Large videos and the Electron runtime are distributed through Releases. Install development dependencies with `npm install --ignore-scripts` before building, and copy `assets/webm/` from the installed package into the source tree.

```sh
npm run typecheck
npm test
npm run build:desktop-core
npm run bundle
npm run types
```

Shared selection/menu logic lives in `src/shared/`; Electron and the web renderer consume the same form configuration. Build dependencies are needed for source development, not for the installed desktop app.

## ❓ FAQ

**Can I use it without AI?** Yes, use the desktop installer.

**Does it speak or show balances?** Current playback is muted, with no speech/chat boxes or balance UI.

**Will idle never repeat?** No. Stable trims and short blends improve continuity; more source clips would be needed for additional natural variation.

**What does working with AI mean?** A client calls a tool to express a work state through animation. The pet does not run tasks or monitor other applications.

## ©️ Copyright holders

| Copyright holder | Copyrighted content |
|---|---|
| Kuro Games | Wuthering Waves and the original Denia character design |

*Character videos and preview material originate from the user's local asset library. Preview screenshots were captured from this app. This is a fan project, unaffiliated with Kuro Games. The code license does not grant character, video or third-party asset rights, and this project claims no ownership of the original character or official endorsement.*

## 🤝 Acknowledgements

Thanks to [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet) for the desktop pet foundation, Kuro Games for Wuthering Waves, and the user who supplied the videos. The code baseline is **v0.3.0**, commit `972f1cb9437dc256bdcb0707f7a6812069dd93db`; original MIT notices remain in [LICENSE](LICENSE) and [NOTICE](NOTICE.md).

Public redistribution and commercial asset permissions have not been verified; the MIT code license does not substitute for asset permission. [Changelog](CHANGELOG.md)
