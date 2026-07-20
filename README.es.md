<div align="center">
  <img src="resources/sookool-app-icon-preview.png" width="112" alt="Icono de SooKool Agent Helper" />

  <h1>SooKool Agent Helper</h1>

  <p><strong>Un espacio de trabajo local para descubrir, organizar, previsualizar, transferir e instalar Agent Skills.</strong></p>

  <p>
    <a href="https://www.electronjs.org/"><img alt="Electron" src="https://img.shields.io/badge/Electron-desktop-47848F?logo=electron&logoColor=white" /></a>
    <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=20232A" /></a>
    <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" /></a>
    <a href="LICENSE"><img alt="Licencia MIT" src="https://img.shields.io/badge/License-MIT-F4511E.svg" /></a>
  </p>
</div>

<div align="center">
  <a href="README.md">English</a> ·
  <a href="README.zh-CN.md">简体中文</a> ·
  <a href="README.zh-TW.md">繁體中文</a> ·
  <a href="README.ja.md">日本語</a> ·
  <a href="README.fr.md">Français</a> ·
  <a href="README.ko.md">한국어</a> ·
  <strong>Español</strong> ·
  <a href="README.pt-BR.md">Português</a> ·
  <a href="README.ar.md">العربية</a>
</div>

## Descripción

Las aplicaciones Agent guardan los Skills en distintos directorios del sistema, compartidos y de proyecto. SooKool Agent Helper reúne esas ubicaciones en una biblioteca coherente y añade un mercado unificado, para que no tengas que memorizar las convenciones de cada herramienta ni copiar paquetes manualmente.

La aplicación se centra en la gestión local de Agent Skills. Solo muestra las aplicaciones relevantes y los directorios válidos detectados, y permite conectar herramientas adicionales mediante reglas personalizadas.

## Funciones principales

- **Biblioteca unificada**: explora Skills del sistema y de proyectos por aplicación o proyecto sin duplicar directorios compartidos.
- **Vista previa completa**: revisa `SKILL.md`, Markdown, scripts, imágenes, textos y metadatos antes de actuar.
- **Transferencia entre aplicaciones**: añade o retira un Skill en aplicaciones compatibles, a nivel de sistema o proyecto.
- **Mercado de Skills**: busca, previsualiza e instala desde fuentes oficiales, seleccionadas y comunitarias.
- **Detección flexible**: registra proyectos, añade ubicaciones de análisis y crea reglas de directorio personalizadas.
- **Protecciones locales**: muestra y copia rutas, avisa sobre contenido riesgoso y conserva copias de seguridad al eliminar Skills.
- **Interfaz multilingüe**: inglés, chino simplificado y tradicional, japonés, francés, coreano, español, portugués de Brasil y árabe.

## Capturas de pantalla

<table>
  <tr>
    <td width="50%"><img src="docs/images/skill-library.png" alt="Biblioteca de Skills" /></td>
    <td width="50%"><img src="docs/images/skill-market.png" alt="Mercado de Skills" /></td>
  </tr>
  <tr>
    <td align="center"><strong>Biblioteca de Skills</strong></td>
    <td align="center"><strong>Mercado de Skills</strong></td>
  </tr>
</table>

## Compatibilidad

Las reglas integradas cubren herramientas como Codex, Claude Code, Cursor, Gemini CLI, GitHub Copilot, OpenCode, OpenClaw, Hermes Agent, Kilo Code, Qoder, Qwen Code, Trae y Windsurf. La biblioteca principal solo muestra aplicaciones y ubicaciones de Skills válidas detectadas en el equipo. Puedes añadir otras herramientas con reglas personalizadas.

El mercado integra Anthropic, OpenAI, OpenClaw, Hermes, Vercel Labs, Hugging Face, NVIDIA, Tencent SkillHub, Red Skill, ModelScope Skills y ClawHub. También admite repositorios Git, directorios locales y fuentes personalizadas compatibles.

## Primeros pasos

### Requisitos

- Node.js y npm
- Git

### Ejecutar desde el código fuente

```bash
git clone https://github.com/Zhiyuan20002/SooKool-Agent-Helper.git
cd SooKool-Agent-Helper
npm install
npm run dev
```

## Desarrollo

| Comando             | Descripción                                                    |
| ------------------- | -------------------------------------------------------------- |
| `npm run dev`       | Iniciar el entorno de desarrollo de Electron                   |
| `npm run typecheck` | Comprobar los tipos de los procesos principal y de renderizado |
| `npm test`          | Ejecutar las pruebas automatizadas                             |
| `npm run build`     | Comprobar tipos y crear el build de producción                 |
| `npm run dist:mac`  | Empaquetar la aplicación para macOS                            |
| `npm run dist:win`  | Empaquetar la aplicación para Windows                          |

El repositorio también incluye configuración de empaquetado para Linux en `electron-builder.yml`.

## Estructura del proyecto

```text
src/main/       Proceso principal de Electron, detección, almacenamiento y mercados
src/preload/    Puente tipado entre los procesos principal y de renderizado
src/renderer/   Interfaz React, estado, localización y vistas previas
resources/      Iconos y recursos empaquetados
scripts/        Verificación del build y pruebas de rendimiento del mercado
```

## Seguridad

SooKool Agent Helper solo gestiona las ubicaciones detectadas o configuradas explícitamente. Se requiere conexión de red para cargar mercados en línea o repositorios remotos. Antes de instalar, revisa siempre las advertencias, los scripts, los archivos binarios y la fiabilidad de la fuente.

Informa de problemas de seguridad sensibles en privado al propietario del repositorio, sin publicar detalles de explotación en una Issue pública.

## Contribuir

Las Issues y Pull Requests son bienvenidas. Para cambios de código:

1. Haz un Fork del repositorio y crea una rama enfocada.
2. Mantén los cambios acotados y añade pruebas cuando cambie el comportamiento.
3. Ejecuta `npm run typecheck` y `npm test`.
4. Abre una Pull Request describiendo el problema, la solución y la verificación.

## Licencia

SooKool Agent Helper se distribuye bajo la [licencia MIT](LICENSE).
