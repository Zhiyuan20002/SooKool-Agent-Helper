<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="SooKool Agent Helper 图标" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>一个用于发现、整理、预览、转移和安装 Agent Skills 的本地桌面工作台。</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="README.md">English</a> ·
  <strong>简体中文</strong> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.ar.md">العربية</a>
</div>

## 项目简介

不同 Agent 应用会把 Skills 保存在不同的系统目录、共享目录和项目目录中。SooKool Agent Helper 将这些分散的位置整理为一个统一技能库，并提供聚合技能市场，让你不必记忆各应用的目录约定，也不必手动复制技能包。

软件专注于 Agent Skill 管理，在本地运行，只展示检测到的相关应用和有效目录；未内置的工具也可以通过自定义规则接入。

## 核心能力

- **统一技能库**：按应用或项目浏览系统级与项目级 Skills，共享目录不会重复计数。
- **完整预览**：操作前查看 `SKILL.md`、Markdown、脚本、图片、文本文件和技能元数据。
- **跨应用转移**：在支持的 Agent 应用之间添加或移除 Skill，可选择系统或项目范围。
- **聚合技能市场**：在一个界面中搜索、预览和安装官方、精选及社区来源的技能。
- **灵活发现**：登记项目、补充扫描位置，并添加自定义应用目录规则。
- **本地安全措施**：定位和复制路径、提示高风险内容，并在删除 Skill 时保留备份。
- **多语言界面**：英语、简体中文、繁体中文、日语、法语、韩语、西班牙语、巴西葡萄牙语和阿拉伯语。

## 软件截图

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="技能库" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="技能市场" /></td>
  </tr>
  <tr>
    <td align="center"><strong>技能库</strong></td>
    <td align="center"><strong>技能市场</strong></td>
  </tr>
</table>

## 生态支持

内置目录规则覆盖 Codex、Claude Code、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw、Hermes Agent、Kilo Code、Qoder、Qwen Code、Trae、Windsurf 等常见 Agent 工具。主技能库只展示本机已检测到的应用和有效技能位置，其他工具可通过自定义规则接入。

技能市场收录 Anthropic、OpenAI、OpenClaw、Hermes、Vercel Labs、Hugging Face、NVIDIA、腾讯 SkillHub、小红书 Red Skill、ModelScope Skills 和 ClawHub，并支持添加 Git 仓库、本地目录和兼容的自定义来源。

## 快速开始

### 环境要求

- Node.js 和 npm
- Git

### 从源码运行

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## 开发命令

| 命令                | 用途                       |
| ------------------- | -------------------------- |
| `npm run dev`       | 启动 Electron 开发环境     |
| `npm run typecheck` | 检查主进程和渲染进程的类型 |
| `npm test`          | 运行自动化测试             |
| `npm run build`     | 类型检查并创建生产构建     |
| `npm run dist:mac`  | 打包 macOS 应用            |
| `npm run dist:win`  | 打包 Windows 应用          |

仓库还在 `electron-builder.yml` 中提供了 Linux 打包配置。

## 项目结构

```text
src/main/       Electron 主进程、技能发现、存储和技能市场
src/preload/    主进程与渲染进程之间的类型安全桥接
src/renderer/   React 界面、状态、本地化和内容预览
resources/      应用图标和打包资源
scripts/        构建验证与市场性能基准
```

## 安全说明

SooKool Agent Helper 只管理自动检测到或由你明确配置的 Skill 位置。加载在线市场或远程仓库时需要网络连接。市场技能由各自来源维护，安装前请检查安全提示、脚本、二进制文件和来源可信度。

如需报告安全敏感问题，请私下联系仓库所有者，不要在公开 Issue 中披露利用细节。

## 参与贡献

欢迎提交 Issue 和 Pull Request。代码修改请遵循以下流程：

1. Fork 仓库并创建范围明确的分支。
2. 保持修改聚焦，行为变化应补充测试。
3. 运行 `npm run typecheck` 和 `npm test`。
4. 创建 Pull Request，说明问题、解决方案和验证结果。

## 许可证

SooKool Agent Helper 使用 [MIT License](LICENSE)。
