<div align="center">
  <img src="../../resources/sookool-app-icon-preview.png" width="112" alt="SooKool Agent Helper アイコン" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>Agent Skills の検出、整理、プレビュー、転送、インストールを行うローカルデスクトップワークスペース。</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="../../LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="../../README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-HK.md">繁體中文（香港）</a> ·
  <strong>日本語</strong> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.ar.md">العربية</a>
</div>

## 概要

Agent アプリケーションは、Skills をそれぞれ異なるシステム、共有、プロジェクトディレクトリに保存します。SooKool Agent Helper は分散した場所を一つのライブラリにまとめ、統合マーケットプレイスを提供します。ディレクトリ規約を覚えたり、パッケージを手動でコピーしたりする必要はありません。

本アプリは Agent Skill の管理に特化したローカルアプリです。検出された関連アプリと有効なディレクトリだけを表示し、未登録のツールはカスタムルールで追加できます。

## 主な機能

- **統合 Skill ライブラリ**：共有ディレクトリを重複計上せず、アプリ別またはプロジェクト別に閲覧できます。
- **詳細プレビュー**：操作前に `SKILL.md`、Markdown、スクリプト、画像、テキスト、メタデータを確認できます。
- **アプリ間転送**：システムまたはプロジェクト単位で、対応 Agent アプリへ Skill を追加・削除できます。
- **Skill マーケットプレイス**：公式、厳選、コミュニティのソースを横断して検索、確認、インストールできます。
- **柔軟な検出**：プロジェクト、スキャン場所、カスタムアプリディレクトリ規則を追加できます。
- **ローカル保護**：パスの表示とコピー、危険な内容の警告、削除時のバックアップに対応します。
- **多言語 UI**：英語、簡体字中国語、繁体字中国語（香港）、日本語、フランス語、韓国語、スペイン語、ブラジルポルトガル語、アラビア語。

## スクリーンショット

<table>
  <tr>
    <td width="50%"><img src="../images/skill-library.png" alt="Skill ライブラリ" /></td>
    <td width="50%"><img src="../images/skill-market.png" alt="Skill マーケットプレイス" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Skill ライブラリ</strong></td>
    <td align="center"><strong>Skill マーケットプレイス</strong></td>
  </tr>
</table>

## エコシステム対応

Codex、DeepSeek Harness、Claude Code、Cursor、Gemini CLI、GitHub Copilot、OpenCode、OpenClaw、Hermes Agent、Kilo Code、Qoder、Qwen Code、Trae、Windsurf など、多数の Agent ツール向けディレクトリ規則を内蔵しています。メインライブラリには、ローカルで検出されたアプリと有効な Skill の場所だけが表示されます。その他のツールはカスタムルールで接続できます。

マーケットプレイスには Anthropic、OpenAI、OpenClaw、Hermes、Vercel Labs、Hugging Face、NVIDIA、Tencent SkillHub、Red Skill、ModelScope Skills、ClawHub が含まれます。Git リポジトリ、ローカルディレクトリ、互換性のあるカスタムソースも追加できます。

## はじめに

### 必要な環境

- Node.js と npm
- Git

### ソースから実行

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## 開発コマンド

| コマンド            | 説明                                 |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Electron 開発環境を起動              |
| `npm run typecheck` | メイン・レンダラープロセスの型を検査 |
| `npm test`          | 自動テストを実行                     |
| `npm run build`     | 型検査後に本番ビルドを作成           |
| `npm run dist:mac`  | macOS アプリをパッケージ化           |
| `npm run dist:win`  | Windows アプリをパッケージ化         |

Linux のパッケージ設定は `electron-builder.yml` に含まれています。

## プロジェクト構成

```text
src/main/       Electron メインプロセス、Skill 検出、保存、マーケット
src/preload/    メインとレンダラー間の型付きブリッジ
src/renderer/   React UI、状態管理、ローカライズ、プレビュー
resources/      アプリアイコンとパッケージ用リソース
scripts/        ビルド検証とマーケット性能ベンチマーク
```

## セキュリティ

SooKool Agent Helper は、自動検出または明示的に設定された Skill の場所だけを管理します。オンラインマーケットやリモートリポジトリの読み込みにはネットワーク接続が必要です。インストール前に警告、スクリプト、バイナリファイル、配布元を必ず確認してください。

セキュリティ上重要な問題は、公開 Issue に悪用方法を書かず、リポジトリ所有者へ非公開で報告してください。

## コントリビューション

Issue と Pull Request を歓迎します。コードを変更する場合：

1. リポジトリを Fork し、目的を絞ったブランチを作成します。
2. 変更範囲を限定し、動作変更にはテストを追加します。
3. `npm run typecheck` と `npm test` を実行します。
4. 問題、解決方法、検証結果を記載した Pull Request を作成します。

## ライセンス

SooKool Agent Helper は [MIT License](../../LICENSE) で公開されています。
