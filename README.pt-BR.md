<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="Ícone do SooKool Agent Helper" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>Um espaço de trabalho local para descobrir, organizar, visualizar, transferir e instalar Agent Skills.</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="Licença MIT" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <strong>Português</strong> ·
  <a href="README.ar.md">العربية</a>
</div>

## Visão geral

Aplicativos de Agent armazenam Skills em diferentes diretórios de sistema, compartilhados e de projeto. O SooKool Agent Helper reúne esses locais em uma biblioteca coerente e adiciona um marketplace unificado, evitando que você precise memorizar convenções ou copiar pacotes manualmente.

O aplicativo é focado no gerenciamento local de Agent Skills. Ele exibe apenas aplicativos relevantes e diretórios válidos detectados e permite conectar outras ferramentas com regras personalizadas.

## Destaques

- **Biblioteca unificada**: navegue por Skills de sistema e projeto por aplicativo ou projeto sem duplicar diretórios compartilhados.
- **Visualizações completas**: confira `SKILL.md`, Markdown, scripts, imagens, textos e metadados antes de qualquer ação.
- **Transferência entre aplicativos**: adicione ou remova um Skill em aplicativos compatíveis no escopo do sistema ou de um projeto.
- **Marketplace de Skills**: pesquise, visualize e instale fontes oficiais, selecionadas e da comunidade.
- **Descoberta flexível**: registre projetos, adicione locais de varredura e crie regras personalizadas de diretório.
- **Proteções locais**: revele e copie caminhos, receba alertas de conteúdo arriscado e mantenha backups ao excluir Skills.
- **Interface multilíngue**: inglês, chinês simplificado e tradicional, japonês, francês, coreano, espanhol, português do Brasil e árabe.

## Capturas de tela

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="Biblioteca de Skills" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="Marketplace de Skills" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Biblioteca de Skills</strong></td>
    <td align="center"><strong>Marketplace de Skills</strong></td>
  </tr>
</table>

## Compatibilidade

As regras integradas cobrem ferramentas como Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode, OpenClaw, Hermes Agent, Kilo Code, Qoder, Qwen Code, Trae e Windsurf. A biblioteca principal mostra apenas aplicativos e locais de Skills válidos detectados na máquina. Outras ferramentas podem ser conectadas por regras personalizadas.

O marketplace inclui Anthropic, OpenAI, OpenClaw, Hermes, Vercel Labs, Hugging Face, NVIDIA, Tencent SkillHub, Red Skill, ModelScope Skills e ClawHub. Também é possível adicionar repositórios Git, diretórios locais e fontes personalizadas compatíveis.

## Primeiros passos

### Pré-requisitos

- Node.js e npm
- Git

### Executar a partir do código-fonte

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## Desenvolvimento

| Comando             | Descrição                                                    |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Iniciar o ambiente de desenvolvimento Electron               |
| `npm run typecheck` | Verificar os tipos dos processos principal e de renderização |
| `npm test`          | Executar os testes automatizados                             |
| `npm run build`     | Verificar os tipos e criar o build de produção               |
| `npm run dist:mac`  | Empacotar o aplicativo para macOS                            |
| `npm run dist:win`  | Empacotar o aplicativo para Windows                          |

O repositório também contém configuração de empacotamento para Linux em `electron-builder.yml`.

## Estrutura do projeto

```text
src/main/       Processo principal Electron, descoberta, armazenamento e marketplaces
src/preload/    Ponte tipada entre os processos principal e de renderização
src/renderer/   Interface React, estado, localização e visualizações
resources/      Ícones e recursos empacotados
scripts/        Verificação do build e benchmarks do marketplace
```

## Segurança

O SooKool Agent Helper gerencia apenas os locais detectados ou configurados explicitamente. É necessária conexão de rede para carregar marketplaces online ou repositórios remotos. Antes de instalar, confira sempre os alertas, scripts, arquivos binários e a confiabilidade da fonte.

Relate problemas de segurança confidencialmente ao proprietário do repositório, sem publicar detalhes de exploração em uma Issue pública.

## Como contribuir

Issues e Pull Requests são bem-vindos. Para alterações de código:

1. Faça um Fork do repositório e crie uma branch focada.
2. Mantenha as alterações limitadas e adicione testes quando o comportamento mudar.
3. Execute `npm run typecheck` e `npm test`.
4. Abra um Pull Request descrevendo o problema, a solução e a verificação.

## Licença

O SooKool Agent Helper é distribuído sob a [licença MIT](LICENSE).
