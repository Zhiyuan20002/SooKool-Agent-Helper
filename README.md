# SooKool Agent Helper

> 一个专注于 Agent Skills 的本地桌面管理工具：发现、整理、预览、转移和安装散落在不同 AI 应用与项目中的技能。

[![License: MIT](https://img.shields.io/badge/License-MIT-f4511e.svg)](LICENSE)

不同 Agent 应用使用不同的技能目录，同一个 Skill 也可能同时存在于系统目录、共享目录和多个项目中。SooKool Agent Helper 把这些位置整理成统一视图，并提供技能市场，让你不必反复查找目录、复制文件或记忆每个应用的约定。

## 技能库

![SooKool Agent Helper 技能库](docs/images/skill-library.png)

- 自动发现已安装 Agent 应用的系统级与项目级技能目录。
- 按应用或项目查看技能，识别多个应用共享的同一物理目录，避免重复计数。
- 搜索 Skill，并查看 `SKILL.md`、脚本、图片及其他随附文件。
- 在支持的 Agent 应用之间转移或移除 Skill，可选择系统范围或指定项目。
- 支持在文件管理器中定位、复制路径，以及删除前自动备份。
- 可登记项目、补充扫描位置，并为尚未内置的应用添加自定义目录规则。

## 技能市场

![SooKool Agent Helper 技能市场](docs/images/skill-market.png)

- 聚合 Anthropic、OpenAI、OpenClaw、Hermes、Vercel Labs、Hugging Face、NVIDIA 等官方或精选技能目录。
- 接入腾讯 SkillHub、小红书 Red Skill、ModelScope Skills 和 ClawHub。
- 支持跨市场搜索、分类与排序，并在安装前预览说明和文件内容。
- 可将一个 Skill 同时安装到多个应用，支持系统级和项目级目标。
- 支持添加 Git 仓库、本地目录及兼容的自定义市场源。
- 对脚本、二进制文件和异常 `SKILL.md` 元数据给出检查提示。

## 应用兼容

项目内置了常见 Agent 工具的目录规则，包括 Codex、Claude Code、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw、Hermes Agent、Kilo Code、Qoder、Qwen Code、Trae、Windsurf 等。只有本机检测到的应用和有效技能目录会进入主要视图；其他工具可以通过自定义规则接入。

应用基于 Electron、React 和 TypeScript 构建，提供 macOS、Windows 与 Linux 的打包配置，并支持简体中文、繁体中文、英语、日语、法语、韩语、西班牙语、葡萄牙语和阿拉伯语界面。

## 本地运行

请先安装 Node.js、npm 和 Git，然后执行：

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## 开发命令

| 命令                | 用途                                   |
| ------------------- | -------------------------------------- |
| `npm run dev`       | 启动 Electron 开发环境                 |
| `npm run typecheck` | 检查主进程与渲染进程的 TypeScript 类型 |
| `npm test`          | 运行自动化测试                         |
| `npm run build`     | 完成类型检查并生成应用构建             |
| `npm run dist:mac`  | 打包 macOS 安装产物                    |
| `npm run dist:win`  | 打包 Windows 安装产物                  |

## 数据与安全

SooKool Agent Helper 在本地读取和管理你明确配置或检测到的 Skill 目录；访问在线技能市场时才需要网络连接。市场中的 Skill 由各自来源维护，安装带有脚本或二进制文件的 Skill 前，请先检查预览内容和来源可信度。

## License

本项目使用 [MIT License](LICENSE)。
