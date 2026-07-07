import { app, shell } from 'electron'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { homedir } from 'os'
import type { SavedSkillRoot, SettingsStore } from '../settings/settings-store'
import { listSkillApplicationRoots } from './ecosystem'
import { buildSkillMarkdown, normalizeSkillName, parseSkillMarkdown } from './skill-parser'
import type {
  CreateSkillInput,
  ImportSkillInput,
  ReadSkillFileInput,
  SkillFileContent,
  SkillFileKind,
  SkillFileTreeNode,
  SkillDetail,
  SkillRoot,
  SkillRootCategory,
  SkillRootSource,
  SkillSummary,
  UpdateSkillInput
} from './skill-types'

const ignoredDirs = new Set(['node_modules', '.git', 'out', 'dist', 'build'])
const ignoredFileNames = new Set(['.DS_Store'])
const skillFileName = 'SKILL.md'
const maxPreviewBytes = 1024 * 1024

type RootCandidate = SavedSkillRoot & {
  source: SkillRootSource
  category?: SkillRootCategory
  appIds?: string[]
  appNames?: string[]
}

export class SkillManager {
  constructor(private settings: SettingsStore) {}

  getSkillRoots(): SkillRoot[] {
    const roots: RootCandidate[] = [
      ...getDefaultRoots().map((root) => ({
        ...root,
        source: 'default' as const,
        category: defaultRootCategory(root.id)
      })),
      ...getApplicationRoots(),
      ...this.settings.getSkillRoots().map((root) => ({
        ...root,
        source: 'custom' as const,
        category: 'custom' as const
      }))
    ]
    const deduped = new Map<string, SkillRoot>()

    for (const root of roots) {
      const resolved = expandHome(root.path)
      const exists = existsSync(resolved)
      const pathKey = pathDedupKey(resolved)
      const existing = deduped.get(pathKey)
      const appIds = uniqueValues([...(existing?.appIds ?? []), ...(root.appIds ?? [])])
      const appNames = uniqueValues([...(existing?.appNames ?? []), ...(root.appNames ?? [])])
      const id = existing?.id || root.id || resolved
      const category = mergeRootCategory(existing?.category, root.category, appNames)
      const source = mergeRootSource(existing?.source, root.source, appNames)
      const shared = category === 'shared' || appNames.length > 1

      deduped.set(pathKey, {
        id,
        label: formatRootLabel(existing?.label || root.label, category, appNames),
        path: existing?.path || resolved,
        readonly: Boolean(existing?.readonly || root.readonly),
        defaultRoot: Boolean(existing?.defaultRoot || isDefaultRootId(id)),
        exists: Boolean(existing?.exists || exists),
        source,
        category,
        appIds,
        appNames,
        shared
      })
    }

    return [...deduped.values()]
  }

  saveCustomRoots(roots: SavedSkillRoot[]): SkillRoot[] {
    const normalized = roots.map((root) => ({
      ...root,
      id: root.id || crypto.randomUUID(),
      path: expandHome(root.path)
    }))
    this.settings.saveSkillRoots(normalized)
    return this.getSkillRoots()
  }

  listSkills(): SkillSummary[] {
    const roots = this.getSkillRoots().filter((root) => root.exists)
    const skills: SkillSummary[] = []

    for (const root of roots) {
      const skillFiles = findSkillFiles(root.path)
      for (const skillFilePath of skillFiles) {
        try {
          skills.push(this.readSkillSummary(skillFilePath, root))
        } catch {
          // Keep scanning other skills even if a single folder is malformed.
        }
      }
    }

    return skills.sort((a, b) => a.name.localeCompare(b.name))
  }

  readSkill(skillPath: string): SkillDetail {
    const skillFilePath = resolveSkillFilePath(skillPath)
    const root = this.requireReadableRoot(skillFilePath)
    const summary = this.readSkillSummary(skillFilePath, root)
    const content = readFileSync(skillFilePath, 'utf-8')
    const parsed = parseSkillMarkdown(content)

    return {
      ...summary,
      content,
      frontmatter: parsed.frontmatter,
      body: parsed.body
    }
  }

  listSkillFiles(skillPath: string): SkillFileTreeNode[] {
    const skillFilePath = resolveSkillFilePath(skillPath)
    this.requireReadableRoot(skillFilePath)
    const skillDir = resolve(skillFilePath, '..')
    assertWithinRoot(skillFilePath, skillDir)

    const nodes: SkillFileTreeNode[] = []
    if (existsSync(skillFilePath)) nodes.push(createFileNode(skillDir, skillFilePath))

    for (const dir of listResourceDirs(skillDir)) {
      const dirPath = join(skillDir, dir)
      nodes.push(createDirectoryNode(skillDir, dirPath, 0))
    }

    return nodes
  }

  readSkillFile(input: ReadSkillFileInput): SkillFileContent {
    const skillFilePath = resolveSkillFilePath(input.skillPath)
    this.requireReadableRoot(skillFilePath)
    const skillDir = resolve(skillFilePath, '..')
    const targetPath = resolve(skillDir, input.relativePath)
    assertWithinRoot(targetPath, skillDir)

    const stats = statSync(targetPath)
    if (!stats.isFile()) throw new Error('只能预览文件，不能预览目录。')

    const kind = detectFileKind(targetPath)
    const canReadAsText = kind !== 'binary' && kind !== 'image'
    const truncated = stats.size > maxPreviewBytes
    const content = canReadAsText
      ? readFileSync(targetPath).subarray(0, maxPreviewBytes).toString('utf-8')
      : null

    return {
      name: basename(targetPath),
      relativePath: normalizeRelativePath(relative(skillDir, targetPath)),
      kind,
      size: stats.size,
      modifiedAt: stats.mtime.toISOString(),
      content,
      truncated
    }
  }

  createSkill(input: CreateSkillInput): SkillDetail {
    const root = this.getSkillRoots().find((item) => item.id === input.rootId)
    if (!root) throw new Error('未找到目标 Skill 根目录。')
    if (root.readonly) throw new Error('不能在只读根目录中创建 Skill。')

    const name = normalizeSkillName(input.name)
    if (!name) throw new Error('Skill 名称不能为空。')
    if (!input.description.trim()) throw new Error('Skill 描述不能为空。')

    mkdirSync(root.path, { recursive: true })
    const skillDir = resolve(root.path, name)
    assertWithinRoot(skillDir, root.path)
    if (existsSync(skillDir)) throw new Error('同名 Skill 目录已存在。')

    mkdirSync(skillDir, { recursive: true })
    const resourceDirs = input.resourceDirs || []
    for (const dir of resourceDirs) {
      if (!['scripts', 'references', 'assets'].includes(dir)) continue
      mkdirSync(join(skillDir, dir), { recursive: true })
    }

    writeFileSync(
      join(skillDir, 'SKILL.md'),
      buildSkillMarkdown(name, input.description.trim(), input.body),
      'utf-8'
    )

    return this.readSkill(skillDir)
  }

  importSkillDirectory(input: ImportSkillInput): SkillDetail {
    const sourceDir = resolve(input.sourcePath)
    const sourceSkillFile = join(sourceDir, skillFileName)
    if (!existsSync(sourceSkillFile)) throw new Error('导入目录必须包含 SKILL.md。')

    const root =
      (input.rootId ? this.getSkillRoots().find((item) => item.id === input.rootId) : null) ||
      this.getDefaultWritableRoot()
    if (!root) throw new Error('未找到可写入的 Skill 根目录。')
    if (root.readonly) throw new Error('不能导入到只读根目录。')

    const parsed = parseSkillMarkdown(readFileSync(sourceSkillFile, 'utf-8'))
    const rawName = input.name?.trim() || parsed.frontmatter.name || basename(sourceDir)
    const name = normalizeSkillName(rawName)
    if (!name) throw new Error('无法识别导入 Skill 的名称。')

    mkdirSync(root.path, { recursive: true })
    const targetDir = resolve(root.path, name)
    assertWithinRoot(targetDir, root.path)
    if (existsSync(targetDir)) throw new Error(`目标目录已存在：${name}`)
    if (isPathWithin(targetDir, sourceDir)) throw new Error('不能把 Skill 导入到自身目录下。')

    cpSync(sourceDir, targetDir, {
      recursive: true,
      dereference: false,
      filter: (source) =>
        !ignoredFileNames.has(basename(source)) && !ignoredDirs.has(basename(source))
    })

    return this.readSkill(targetDir)
  }

  updateSkill(input: UpdateSkillInput): SkillDetail {
    const skillFilePath = resolveSkillFilePath(input.path)
    const root = this.requireWritableRoot(skillFilePath)
    const parsed = parseSkillMarkdown(input.content)
    const hasErrors = parsed.issues.some((issue) => issue.severity === 'error')
    if (hasErrors) {
      throw new Error(parsed.issues.map((issue) => issue.message).join(' '))
    }

    assertWithinRoot(skillFilePath, root.path)
    writeFileSync(skillFilePath, ensureTrailingNewline(input.content), 'utf-8')
    return this.readSkill(skillFilePath)
  }

  deleteSkill(skillPath: string): { success: true } {
    const skillFilePath = resolveSkillFilePath(skillPath)
    this.requireWritableRoot(skillFilePath)
    const skillDir = resolve(skillFilePath, '..')
    const name = basename(skillDir)
    const backupRoot = join(app.getPath('userData'), 'skill-backups')
    const backupDir = join(backupRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-${name}`)

    mkdirSync(backupRoot, { recursive: true })
    cpSync(skillDir, backupDir, { recursive: true, dereference: false })
    rmSync(skillDir, { recursive: true, force: true })

    this.settings.addBackup({
      id: crypto.randomUUID(),
      skillName: name,
      originalPath: skillDir,
      backupPath: backupDir,
      createdAt: new Date().toISOString()
    })

    return { success: true }
  }

  revealSkill(skillPath: string): { success: true } {
    const skillFilePath = resolveSkillFilePath(skillPath)
    this.requireReadableRoot(skillFilePath)
    shell.showItemInFolder(skillFilePath)
    return { success: true }
  }

  getBackups() {
    return this.settings.getBackups()
  }

  private readSkillSummary(skillFilePath: string, root: SkillRoot): SkillSummary {
    const content = readFileSync(skillFilePath, 'utf-8')
    const parsed = parseSkillMarkdown(content)
    const skillDir = resolve(skillFilePath, '..')
    const stats = statSync(skillFilePath)
    const system = isSystemSkill(skillDir)
    const name = parsed.frontmatter.name || basename(skillDir)
    const resourceDirs = listResourceDirs(skillDir)

    return {
      id: skillDir,
      name,
      description: parsed.frontmatter.description || '缺少描述',
      path: skillDir,
      skillFilePath,
      rootId: root.id,
      rootLabel: root.label,
      readonly: root.readonly || system,
      system,
      modifiedAt: stats.mtime.toISOString(),
      resourceDirs,
      issues: parsed.issues
    }
  }

  private requireReadableRoot(skillFilePath: string): SkillRoot {
    const root = this.getSkillRoots().find(
      (item) => item.exists && isPathWithin(skillFilePath, item.path)
    )
    if (!root) throw new Error('Skill 路径不在已登记根目录内。')
    return root
  }

  private requireWritableRoot(skillFilePath: string): SkillRoot {
    const root = this.requireReadableRoot(skillFilePath)
    if (root.readonly || isSystemSkill(skillFilePath)) {
      throw new Error('该 Skill 是只读或系统 Skill，不能修改。')
    }
    return root
  }

  private getDefaultWritableRoot(): SkillRoot | null {
    const roots = this.getSkillRoots()
    return (
      roots.find(
        (root) => !root.readonly && (root.id === 'codex-skills' || root.category === 'codex')
      ) ||
      roots.find((root) => !root.readonly && root.defaultRoot) ||
      roots.find((root) => root.exists && !root.readonly) ||
      null
    )
  }
}

function getDefaultRoots(): SavedSkillRoot[] {
  const home = homedir()
  return [
    { id: 'codex-skills', label: 'Codex Skills', path: join(home, '.codex', 'skills') },
    { id: 'agents-skills', label: 'Agents Skills', path: join(home, '.agents', 'skills') },
    {
      id: 'developer-claude-skills',
      label: 'Developer Claude Skills',
      path: join(home, 'Developer', '.claude', 'skills')
    },
    { id: 'developer-skills', label: 'Developer Skills', path: join(home, 'Developer', 'skills') }
  ]
}

function getApplicationRoots(): RootCandidate[] {
  return listSkillApplicationRoots().map((root) => ({
    id: `app-${root.id}-skills`,
    label: root.name,
    path: root.path,
    source: 'application',
    category: root.id === 'codex' ? 'codex' : 'application',
    appIds: [root.id],
    appNames: [root.name]
  }))
}

function isDefaultRootId(id: string): boolean {
  return ['codex-skills', 'agents-skills', 'developer-claude-skills', 'developer-skills'].includes(
    id
  )
}

function defaultRootCategory(id: string): SkillRootCategory {
  if (id === 'codex-skills') return 'codex'
  if (id === 'agents-skills') return 'shared'
  return 'application'
}

function mergeRootCategory(
  current: SkillRootCategory | undefined,
  next: SkillRootCategory | undefined,
  appNames: string[]
): SkillRootCategory {
  if (appNames.length > 1) return 'shared'
  if (current === 'shared' || next === 'shared') return 'shared'
  if (current === 'custom' && next) return next
  return current || next || 'application'
}

function mergeRootSource(
  current: SkillRootSource | undefined,
  next: SkillRootSource,
  appNames: string[]
): SkillRootSource {
  if (appNames.length > 0) return 'application'
  return current || next
}

function formatRootLabel(
  fallback: string,
  category: SkillRootCategory,
  appNames: string[]
): string {
  if (category === 'shared') return '共享技能目录'
  if (appNames.length === 1) return appNames[0]
  return fallback
}

function uniqueValues(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))]
}

function pathDedupKey(path: string): string {
  return realpathOrResolve(path)
}

function expandHome(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith(`~${sep}`)) return join(homedir(), path.slice(2))
  return resolve(path)
}

function findSkillFiles(rootPath: string): string[] {
  const results: string[] = []
  const root = realpathSync(rootPath)

  function visit(dir: string, depth: number): void {
    if (depth > 5) return
    const skillFile = join(dir, 'SKILL.md')
    if (existsSync(skillFile)) {
      results.push(skillFile)
      return
    }

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (ignoredDirs.has(entry.name)) continue
      visit(join(dir, entry.name), depth + 1)
    }
  }

  visit(root, 0)
  return results
}

function resolveSkillFilePath(skillPath: string): string {
  const resolved = resolve(skillPath)
  if (basename(resolved) === skillFileName) return resolved
  return join(resolved, skillFileName)
}

function listResourceDirs(skillDir: string): string[] {
  return ['scripts', 'references', 'assets', 'agents'].filter((dir) =>
    existsSync(join(skillDir, dir))
  )
}

function createDirectoryNode(skillDir: string, dirPath: string, depth: number): SkillFileTreeNode {
  assertWithinRoot(dirPath, skillDir)
  const stats = statSync(dirPath)
  const children =
    depth >= 5
      ? []
      : readdirSync(dirPath, { withFileTypes: true })
          .filter((entry) => !ignoredDirs.has(entry.name) && !ignoredFileNames.has(entry.name))
          .map((entry) => {
            const childPath = join(dirPath, entry.name)
            if (entry.isDirectory()) return createDirectoryNode(skillDir, childPath, depth + 1)
            if (entry.isFile()) return createFileNode(skillDir, childPath)
            return null
          })
          .filter((node): node is SkillFileTreeNode => Boolean(node))
          .sort(compareFileNodes)

  return {
    name: basename(dirPath),
    relativePath: normalizeRelativePath(relative(skillDir, dirPath)),
    type: 'directory',
    modifiedAt: stats.mtime.toISOString(),
    children
  }
}

function createFileNode(skillDir: string, filePath: string): SkillFileTreeNode {
  assertWithinRoot(filePath, skillDir)
  const stats = statSync(filePath)

  return {
    name: basename(filePath),
    relativePath: normalizeRelativePath(relative(skillDir, filePath)),
    type: 'file',
    kind: detectFileKind(filePath),
    size: stats.size,
    modifiedAt: stats.mtime.toISOString()
  }
}

function compareFileNodes(left: SkillFileTreeNode, right: SkillFileTreeNode): number {
  if (left.type !== right.type) return left.type === 'directory' ? -1 : 1
  return left.name.localeCompare(right.name)
}

function detectFileKind(path: string): SkillFileKind {
  const extension = extname(path).toLowerCase()
  if (['.md', '.mdx', '.markdown'].includes(extension)) return 'markdown'
  if (
    ['.js', '.jsx', '.ts', '.tsx', '.py', '.sh', '.bash', '.zsh', '.mjs', '.cjs'].includes(
      extension
    )
  )
    return 'script'
  if (['.json', '.jsonc'].includes(extension)) return 'json'
  if (['.txt', '.csv', '.log', '.yaml', '.yml', '.toml', '.ini', '.env'].includes(extension))
    return 'text'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico'].includes(extension)) return 'image'
  return 'binary'
}

function normalizeRelativePath(path: string): string {
  return path.split(sep).join('/')
}

function isSystemSkill(path: string): boolean {
  return path.split(sep).includes('.system')
}

function assertWithinRoot(child: string, root: string): void {
  if (!isPathWithin(child, root)) {
    throw new Error('目标路径不在 Skill 根目录内。')
  }
}

function isPathWithin(child: string, root: string): boolean {
  const resolvedChild = realpathOrResolve(child)
  const resolvedRoot = realpathOrResolve(root)
  const rel = relative(resolvedRoot, resolvedChild)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function realpathOrResolve(path: string): string {
  return existsSync(path) ? realpathSync(path) : resolve(path)
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`
}
