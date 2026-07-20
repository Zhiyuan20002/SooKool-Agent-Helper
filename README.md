<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="SooKool Agent Helper icon" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>A local desktop workspace for discovering, organizing, previewing, transferring, and installing Agent Skills.</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <strong>English</strong> ·
  <a href="docs/readme/README.zh-CN.md">简体中文</a> ·
  <a href="docs/readme/README.zh-HK.md">繁體中文（香港）</a> ·
  <a href="docs/readme/README.ja.md">日本語</a> ·
  <a href="docs/readme/README.fr.md">Français</a> ·
  <a href="docs/readme/README.ko.md">한국어</a> ·
  <a href="docs/readme/README.es.md">Español</a> ·
  <a href="docs/readme/README.pt-BR.md">Português</a> ·
  <a href="docs/readme/README.ar.md">العربية</a>
</div>

## Overview

Agent applications store Skills in different system, shared, and project directories. SooKool Agent Helper turns those scattered locations into one coherent library and adds a unified marketplace, so you do not need to memorize directory conventions or copy packages by hand.

The app is focused on Agent Skill management. It runs locally, detects only relevant applications and directories, and lets you extend its built-in rules when your tool is not listed yet.

## Highlights

- **Unified Skill library** — browse system and project Skills by application or project without double-counting shared directories.
- **Rich previews** — inspect `SKILL.md`, Markdown, scripts, images, text files, and package metadata before acting.
- **Cross-application transfer** — add or remove a Skill across supported Agent applications at system or project scope.
- **Skill marketplace** — search, preview, and install from official, curated, and community sources in one place.
- **Flexible discovery** — register projects, add scan locations, and define custom application directory rules.
- **Local safeguards** — reveal paths, copy locations, flag risky package contents, and keep backups when deleting Skills.
- **Multilingual UI** — English, Simplified Chinese, Traditional Chinese (Hong Kong), Japanese, French, Korean, Spanish, Brazilian Portuguese, and Arabic.

## Screenshots

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="Skill Library" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="Skill Marketplace" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Skill Library</strong></td>
    <td align="center"><strong>Skill Marketplace</strong></td>
  </tr>
</table>

## Ecosystem support

Built-in directory rules cover common Agent tools including Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode, OpenClaw, Hermes Agent, Kilo Code, Qoder, Qwen Code, Trae, Windsurf, and many others. Only applications and valid Skill locations detected on your machine appear in the main library. Custom rules can connect additional tools.

The marketplace includes sources from Anthropic, OpenAI, OpenClaw, Hermes, Vercel Labs, Hugging Face, NVIDIA, Tencent SkillHub, Red Skill, ModelScope Skills, and ClawHub. Git repositories, local directories, and compatible custom sources can also be added.

## Getting started

### Prerequisites

- Node.js and npm
- Git

### Run from source

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## Development

| Command             | Description                                |
| ------------------- | ------------------------------------------ |
| `npm run dev`       | Start the Electron development environment |
| `npm run typecheck` | Type-check the main and renderer processes |
| `npm test`          | Run the automated test suite               |
| `npm run build`     | Type-check and create a production build   |
| `npm run dist:mac`  | Package the macOS application              |
| `npm run dist:win`  | Package the Windows application            |

The repository also contains Linux packaging configuration in `electron-builder.yml`.

## Project structure

```text
src/main/       Electron main process, Skill discovery, storage, and marketplaces
src/preload/    Typed bridge between the main and renderer processes
src/renderer/   React interface, state, localization, and previews
resources/      Application icons and packaged resources
scripts/        Build verification and marketplace benchmarks
```

## Security

SooKool Agent Helper manages only the Skill locations that it detects or that you explicitly configure. Network access is required when loading online marketplaces or remote repositories. Marketplace packages are maintained by their respective sources; always review warnings, scripts, binary files, and the source itself before installation.

Please report security-sensitive issues privately to the repository owner instead of publishing exploit details in a public issue.

## Contributing

Issues and pull requests are welcome. For code changes:

1. Fork the repository and create a focused branch.
2. Keep changes scoped and add tests where behavior changes.
3. Run `npm run typecheck` and `npm test`.
4. Open a pull request describing the problem, solution, and verification.

## License

SooKool Agent Helper is released under the [MIT License](LICENSE).
