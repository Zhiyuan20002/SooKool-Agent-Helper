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
import { isBuiltinApplicationId, listBuiltinApplicationRules } from './ecosystem'
import { ProjectDiscoveryManager } from './project-discovery-manager'
import { buildSkillTopology, type ApplicationRule, type ProjectRegistration } from './skill-topology'
import { buildSkillMarkdown, normalizeSkillName, parseSkillMarkdown } from './skill-parser'
import { isDirectoryPath, replaceDirectoryAtomically } from './skill-filesystem'
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
  SkillSummary,
  SkillCatalogSnapshot,
  TransferSkillInput,
  UpdateSkillInput
} from './skill-types'

const ignoredDirs = new Set(['node_modules', '.git', 'out', 'dist', 'build'])
const ignoredFileNames = new Set(['.DS_Store'])
const skillFileName = 'SKILL.md'
const maxPreviewBytes = 1024 * 1024
const maxImagePreviewBytes = 8 * 1024 * 1024

export class SkillManager {
  private readonly projectDiscovery: ProjectDiscoveryManager

  constructor(private settings: SettingsStore, onCatalogChanged?: () => void) {
    this.projectDiscovery = new ProjectDiscoveryManager(settings, {}, onCatalogChanged)
  }

  getSkillRoots(topology = this.getTopology()): SkillRoot[] {
    const applicationById = new Map(topology.applications.map((application) => [application.id, application]))
    const resolvedRoots: SkillRoot[] = topology.locations.map((location) => {
      const appNames = location.applicationIds.map((id) => applicationById.get(id)?.name || id)
      const shared = location.applicationIds.length > 1
      const category: SkillRootCategory = shared
        ? 'shared'
        : location.applicationIds[0] === 'codex'
          ? 'codex'
          : 'application'
      return {
        id: location.id,
        label: shared ? '共享技能目录' : appNames[0] || '应用技能目录',
        path: location.path,
        readonly: false,
        defaultRoot: location.scope === 'system',
        exists: isDirectoryPath(location.path),
        source: 'application',
        category,
        appIds: location.applicationIds,
        appNames,
        shared,
        scope: location.scope,
        projectId: location.projectId
      }
    })
    const occupiedPaths = new Set(resolvedRoots.map((root) => realpathOrResolve(root.path)))
    const legacyRoots: SkillRoot[] = this.settings.getLegacySkillRoots().filter((root) => {
      const key = realpathOrResolve(expandHome(root.path))
      if (occupiedPaths.has(key)) return false
      occupiedPaths.add(key)
      return true
    }).map((root) => {
      const path = expandHome(root.path)
      return {
        id: root.id,
        label: root.label,
        path,
        readonly: Boolean(root.readonly),
        defaultRoot: false,
        exists: isDirectoryPath(path),
        source: 'custom',
        category: 'custom',
        appIds: [],
        appNames: [],
        shared: false,
        scope: 'system',
        projectId: null
      }
    })
    return [...resolvedRoots, ...legacyRoots]
  }

  getCatalogSnapshot(): SkillCatalogSnapshot {
    const topology = this.getTopology()
    const roots = this.getSkillRoots(topology)
    return {
      applications: topology.applications,
      projects: topology.projects,
      roots,
      skills: this.listSkills(roots),
      discovery: this.projectDiscovery.getStatus()
    }
  }

  async refreshCatalogSnapshot(mode: 'quick' | 'deep' = 'quick'): Promise<SkillCatalogSnapshot> {
    const registeredProjects = this.settings.getProjects()
    const customApplications = this.settings.getApplicationRules()
    const applications = [...listBuiltinApplicationRules(registeredProjects), ...customApplications]
    await this.projectDiscovery.refresh(applications, registeredProjects, { mode })
    return this.getCatalogSnapshot()
  }

  cancelProjectDiscovery(): void {
    this.projectDiscovery.cancel()
  }

  dispose(): void {
    this.projectDiscovery.dispose()
  }

  saveApplicationRule(rule: ApplicationRule): SkillCatalogSnapshot {
    const projects = this.settings.getProjects()
    if (isBuiltinApplicationId(rule.id)) {
      throw new Error('自定义应用规则不能使用内置应用 ID。')
    }
    const customRules = this.settings.getApplicationRules().filter((item) => item.id !== rule.id)
    const nextRules = [...customRules, { ...rule, source: 'custom' as const }]
    buildSkillTopology({ applications: [...listBuiltinApplicationRules(projects), ...nextRules], projects })
    this.settings.saveApplicationRules(nextRules)
    return this.getCatalogSnapshot()
  }

  removeApplicationRule(id: string): SkillCatalogSnapshot {
    this.settings.saveApplicationRules(this.settings.getApplicationRules().filter((rule) => rule.id !== id))
    return this.getCatalogSnapshot()
  }

  saveProject(project: ProjectRegistration): SkillCatalogSnapshot {
    const projects = this.settings.getProjects().filter((item) => item.id !== project.id)
    const nextProjects = [...projects, { ...project, source: 'manual' as const }]
    buildSkillTopology({
      applications: [...listBuiltinApplicationRules(nextProjects), ...this.settings.getApplicationRules()],
      projects: nextProjects
    })
    this.settings.saveProjects(nextProjects)
    this.settings.saveIgnoredProjectPaths(
      this.settings.getIgnoredProjectPaths().filter((path) => resolve(path) !== resolve(project.path))
    )
    return this.getCatalogSnapshot()
  }

  removeProject(id: string): SkillCatalogSnapshot {
    const manualProjects = this.settings.getProjects()
    const automaticProject = this.settings.getProjectDiscoveryRecords().find((project) => project.id === id)
    this.settings.saveProjects(manualProjects.filter((project) => project.id !== id))
    if (automaticProject && !manualProjects.some((project) => project.id === id)) {
      this.settings.saveIgnoredProjectPaths([
        ...this.settings.getIgnoredProjectPaths(),
        automaticProject.path
      ])
      this.settings.saveProjectDiscoveryRecords(
        this.settings.getProjectDiscoveryRecords().filter((project) => project.id !== id)
      )
    }
    return this.getCatalogSnapshot()
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

  listSkills(availableRoots = this.getSkillRoots()): SkillSummary[] {
    const roots = availableRoots.filter((root) => root.exists)
    const skills: SkillSummary[] = []

    for (const root of roots) {
      let skillFiles: string[]
      try {
        skillFiles = findSkillFiles(root.path)
      } catch {
        // A root can disappear, lose permissions, or be replaced by a file between discovery and scanning.
        continue
      }
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
    const extension = extname(targetPath).toLowerCase()
    const canReadAsText = kind !== 'binary' && (kind !== 'image' || extension === '.svg')
    const previewLimit = kind === 'image' ? maxImagePreviewBytes : maxPreviewBytes
    const truncated = stats.size > previewLimit
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
      dataUrl: kind === 'image' && !truncated ? fileDataUrl(targetPath) : undefined,
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

  transferSkill(input: TransferSkillInput) {
    const startedAt = Date.now()
    const sourceSkillFile = resolveSkillFilePath(input.skillPath)
    this.requireReadableRoot(sourceSkillFile)
    const sourceDirectory = resolve(sourceSkillFile, '..')
    const targetRoots = this.getSkillRoots().filter((root) =>
      root.scope === input.scope &&
      root.projectId === (input.scope === 'project' ? input.projectId || null : null) &&
      root.appIds.some((id) => input.applicationIds.includes(id))
    )
    const uniqueRoots = [...new Map(targetRoots.map((root) => [realpathOrResolve(root.path), root])).values()]
    if (!uniqueRoots.length) throw new Error('所选应用没有匹配的技能位置。')
    const messages: string[] = []
    for (const root of uniqueRoots) {
      const destination = resolve(root.path, basename(sourceDirectory))
      assertWithinRoot(destination, root.path)
      if (realpathOrResolve(destination) === realpathOrResolve(sourceDirectory)) {
        messages.push(`${root.label}: 已在目标位置`)
        continue
      }
      if (input.operation === 'remove') {
        const selectedBindings = root.appIds.filter((id) => input.applicationIds.includes(id))
        if (root.shared && selectedBindings.length < root.appIds.length) {
          throw new Error(`${root.label} 被多个应用共享；必须同时选择全部关联应用才能移除。`)
        }
        if (existsSync(join(destination, skillFileName))) this.deleteSkill(destination)
        messages.push(`${root.label}: ${destination}`)
        continue
      }
      replaceDirectoryAtomically(sourceDirectory, destination)
      messages.push(`${root.label}: ${destination}`)
    }
    return {
      command: `${input.operation} ${basename(sourceDirectory)}`,
      stdout: messages.join('\n'),
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - startedAt
    }
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
      issues: parsed.issues,
      applicationIds: root.appIds,
      projectId: root.projectId,
      scope: root.scope
    }
  }

  private getTopology() {
    const registeredProjects = this.settings.getProjects()
    const customApplications = this.settings.getApplicationRules()
    const discoveredProjects = this.projectDiscovery.getProjects(registeredProjects)
    return buildSkillTopology({
      applications: [...listBuiltinApplicationRules(discoveredProjects), ...customApplications],
      projects: discoveredProjects
    })
  }

  private requireReadableRoot(skillFilePath: string): SkillRoot {
    const root = this.getSkillRoots().sort((left, right) => right.path.length - left.path.length).find(
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
  if (['.txt', '.csv', '.log', '.yaml', '.yml', '.toml', '.ini', '.env', '.html', '.htm', '.xml', '.css'].includes(extension))
    return 'text'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.ico', '.bmp', '.avif'].includes(extension)) return 'image'
  return 'binary'
}

function fileDataUrl(path: string): string {
  const mime: Record<string, string> = {
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon', '.bmp': 'image/bmp', '.avif': 'image/avif'
  }
  return `data:${mime[extname(path).toLowerCase()] || 'application/octet-stream'};base64,${readFileSync(path).toString('base64')}`
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
