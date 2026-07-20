<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="Icône de SooKool Agent Helper" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>Un espace de travail local pour découvrir, organiser, prévisualiser, transférer et installer des Agent Skills.</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="Licence MIT" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <strong>Français</strong> ·
  <a href="README.ko.md">한국어</a> ·
  <a href="README.es.md">Español</a> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.ar.md">العربية</a>
</div>

## Présentation

Les applications Agent enregistrent les Skills dans différents dossiers système, partagés et propres aux projets. SooKool Agent Helper rassemble ces emplacements dans une bibliothèque cohérente et ajoute une place de marché unifiée. Vous n'avez plus à mémoriser les conventions de chaque outil ni à copier les paquets manuellement.

L'application se concentre sur la gestion locale des Agent Skills. Elle n'affiche que les applications pertinentes et les dossiers valides détectés, tout en permettant d'ajouter des règles personnalisées.

## Points forts

- **Bibliothèque unifiée** : parcourez les Skills système et projet par application ou projet, sans compter deux fois les dossiers partagés.
- **Aperçus complets** : examinez `SKILL.md`, Markdown, scripts, images, textes et métadonnées avant toute action.
- **Transfert entre applications** : ajoutez ou retirez un Skill dans les applications compatibles, au niveau système ou projet.
- **Place de marché** : recherchez, prévisualisez et installez des Skills officiels, sélectionnés ou communautaires.
- **Découverte flexible** : enregistrez des projets, ajoutez des emplacements d'analyse et créez des règles de dossiers personnalisées.
- **Protections locales** : affichez et copiez les chemins, détectez les contenus risqués et sauvegardez les Skills supprimés.
- **Interface multilingue** : anglais, chinois simplifié et traditionnel, japonais, français, coréen, espagnol, portugais brésilien et arabe.

## Captures d'écran

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="Bibliothèque de Skills" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="Place de marché des Skills" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Bibliothèque de Skills</strong></td>
    <td align="center"><strong>Place de marché</strong></td>
  </tr>
</table>

## Écosystème pris en charge

Des règles intégrées couvrent notamment Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode, OpenClaw, Hermes Agent, Kilo Code, Qoder, Qwen Code, Trae et Windsurf. Seules les applications et les positions de Skills valides détectées sur votre machine apparaissent dans la bibliothèque. Des règles personnalisées permettent d'ajouter d'autres outils.

La place de marché intègre Anthropic, OpenAI, OpenClaw, Hermes, Vercel Labs, Hugging Face, NVIDIA, Tencent SkillHub, Red Skill, ModelScope Skills et ClawHub. Vous pouvez aussi ajouter des dépôts Git, des dossiers locaux et des sources personnalisées compatibles.

## Démarrage

### Prérequis

- Node.js et npm
- Git

### Exécuter depuis les sources

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## Développement

| Commande            | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `npm run dev`       | Démarrer l'environnement de développement Electron     |
| `npm run typecheck` | Vérifier les types des processus principal et de rendu |
| `npm test`          | Exécuter les tests automatisés                         |
| `npm run build`     | Vérifier les types et créer le build de production     |
| `npm run dist:mac`  | Empaqueter l'application macOS                         |
| `npm run dist:win`  | Empaqueter l'application Windows                       |

La configuration de l'empaquetage Linux se trouve également dans `electron-builder.yml`.

## Structure du projet

```text
src/main/       Processus principal Electron, découverte, stockage et marchés
src/preload/    Pont typé entre les processus principal et de rendu
src/renderer/   Interface React, état, localisation et aperçus
resources/      Icônes et ressources empaquetées
scripts/        Vérification du build et bancs d'essai du marché
```

## Sécurité

SooKool Agent Helper ne gère que les emplacements détectés ou explicitement configurés. Une connexion réseau est nécessaire pour les marchés en ligne et les dépôts distants. Avant une installation, vérifiez toujours les avertissements, scripts, fichiers binaires et la fiabilité de la source.

Signalez les problèmes de sécurité sensibles en privé au propriétaire du dépôt, sans publier les détails d'exploitation dans une Issue publique.

## Contribution

Les Issues et Pull Requests sont bienvenues. Pour modifier le code :

1. Forkez le dépôt et créez une branche ciblée.
2. Limitez la portée des changements et ajoutez des tests pour tout changement de comportement.
3. Exécutez `npm run typecheck` et `npm test`.
4. Ouvrez une Pull Request décrivant le problème, la solution et les vérifications.

## Licence

SooKool Agent Helper est distribué sous [licence MIT](LICENSE).
