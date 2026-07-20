<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="SooKool Agent Helper 圖示" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>用於探索、整理、預覽、轉移與安裝 Agent Skills 的本機桌面工作臺。</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <strong>繁體中文</strong> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.ar.md">العربية</a>
</div>

## 專案簡介

不同 Agent 應用會將 Skills 儲存在不同的系統、共用與專案目錄中。SooKool Agent Helper 把這些分散位置整理成統一技能庫，並提供聚合技能市場，讓你不必記住各應用的目錄慣例或手動複製技能套件。

軟體專注於 Agent Skill 管理，在本機執行，只顯示偵測到的相關應用與有效目錄；尚未內建的工具也能透過自訂規則接入。

## 核心能力

- **統一技能庫**：依應用或專案瀏覽系統級與專案級 Skills，共用目錄不會重複計數。
- **完整預覽**：操作前檢視 `SKILL.md`、Markdown、腳本、圖片、文字檔與技能中繼資料。
- **跨應用轉移**：在支援的 Agent 應用之間加入或移除 Skill，可選擇系統或專案範圍。
- **聚合技能市場**：在同一介面搜尋、預覽及安裝官方、精選與社群來源的技能。
- **彈性探索**：登錄專案、加入掃描位置，並定義自訂應用目錄規則。
- **本機安全措施**：定位和複製路徑、提示高風險內容，並在刪除 Skill 時保留備份。
- **多語言介面**：英文、簡體中文、繁體中文、日文、法文、韓文、西班牙文、巴西葡萄牙文與阿拉伯文。

## 軟體截圖

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="技能庫" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="技能市場" /></td>
  </tr>
  <tr>
    <td align="center"><strong>技能庫</strong></td>
    <td align="center"><strong>技能市場</strong></td>
  </tr>
</table>

## 生態支援

內建目錄規則涵蓋 Codex、Claude Code、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw、Hermes Agent、Kilo Code、Qoder、Qwen Code、Trae、Windsurf 等常見 Agent 工具。主技能庫只顯示本機已偵測到的應用與有效技能位置，其他工具可透過自訂規則接入。

技能市場收錄 Anthropic、OpenAI、OpenClaw、Hermes、Vercel Labs、Hugging Face、NVIDIA、騰訊 SkillHub、小紅書 Red Skill、ModelScope Skills 與 ClawHub，並支援加入 Git 儲存庫、本機目錄和相容的自訂來源。

## 快速開始

### 環境需求

- Node.js 和 npm
- Git

### 從原始碼執行

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## 開發命令

| 命令                | 用途                       |
| ------------------- | -------------------------- |
| `npm run dev`       | 啟動 Electron 開發環境     |
| `npm run typecheck` | 檢查主程序與渲染程序的型別 |
| `npm test`          | 執行自動化測試             |
| `npm run build`     | 型別檢查並建立正式版本     |
| `npm run dist:mac`  | 封裝 macOS 應用程式        |
| `npm run dist:win`  | 封裝 Windows 應用程式      |

儲存庫也在 `electron-builder.yml` 中提供 Linux 封裝設定。

## 專案結構

```text
src/main/       Electron 主程序、技能探索、儲存與技能市場
src/preload/    主程序和渲染程序之間的型別安全橋接
src/renderer/   React 介面、狀態、本地化與內容預覽
resources/      應用程式圖示與封裝資源
scripts/        建置驗證與市場效能基準
```

## 安全說明

SooKool Agent Helper 只管理自動偵測到或由你明確設定的 Skill 位置。載入線上市場或遠端儲存庫時需要網路連線。市場技能由各自來源維護，安裝前請檢查安全提示、腳本、二進位檔案與來源可信度。

若要回報安全敏感問題，請私下聯絡儲存庫擁有者，不要在公開 Issue 中揭露利用細節。

## 參與貢獻

歡迎提交 Issue 與 Pull Request。程式碼修改請遵循以下流程：

1. Fork 儲存庫並建立範圍明確的分支。
2. 保持修改聚焦，行為變更應補上測試。
3. 執行 `npm run typecheck` 和 `npm test`。
4. 建立 Pull Request，說明問題、解決方案與驗證結果。

## 授權條款

SooKool Agent Helper 採用 [MIT License](LICENSE)。
