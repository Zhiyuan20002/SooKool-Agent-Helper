import type { MarketPalette, SettingsStore, SavedMarketSource } from '../settings/settings-store'
import { isAbsolute, relative, resolve, sep } from 'path'
import type { SkillDetail } from './skill-types'
import type { SkillManager } from './skill-manager'
import {
  runSkillsCommand,
  type SkillsCommandResult
} from './ecosystem'
import type { ApplicationRule } from './skill-topology'
import { replaceDirectoryAtomically } from './skill-filesystem'
import {
  inferMarketSourceKind,
  MarketSourceLoader,
  type CatalogSkillRecord,
  type MarketPreviewFile,
  type MarketSourceKind
} from './market-source-loader'

export interface MarketSource {
  id: string
  name: string
  source: string
  description: string
  kind: MarketSourceKind
  palette: MarketPalette
  builtin: boolean
  enabled: boolean
}

export interface MarketSkill {
  id: string
  name: string
  description: string
  author: string
  version?: string
  category: string
  tags: string[]
  sourceId: string
  sourceName: string
  source: string
  installSource: string
  sourcePath?: string
  installed: boolean
  installedOn: string[]
  compatibleAgents: string[]
  fileCount?: number
  hasScripts?: boolean
  url?: string
  origin: 'source' | 'search'
}

export interface MarketSkillPreview extends MarketSkill {
  content: string
  body: string
  files: MarketPreviewFile[]
  warnings: string[]
  fetchedAt: string
}

export interface MarketListSkillsInput {
  sourceId?: string
  source?: string
  refresh?: boolean
  page?: number
  pageSize?: number
  query?: string
}

export interface MarketSearchInput {
  query: string
  owner?: string
}

export interface MarketAddSourceInput {
  name?: string
  source: string
  description?: string
  kind?: MarketSourceKind
  palette?: MarketPalette
}

export interface MarketPreviewInput {
  source: string
  sourceId?: string
  skillName: string
  refresh?: boolean
}

export interface MarketInstallInput {
  source: string
  skillName: string
  agents: string[]
  global?: boolean
  projectId?: string
  projectDirectory?: string
  copy?: boolean
}

export interface MarketInstallTarget {
  id: string
  name: string
  path: string
  systemPath: string | null
  projectPath: string | null
  installed: boolean
  selectedByDefault: boolean
}

export interface MarketSkillResult {
  skills: MarketSkill[]
  command: string
  exitCode: number
  error: string | null
  failedSourceCount?: number
  publicSearchFailed?: boolean
  cacheHit?: boolean
  isStale?: boolean
  cachedAt?: number
  total?: number
  page?: number
  pageSize?: number
}

export interface MarketInstallResult {
  skill: SkillDetail | null
  commandResult: SkillsCommandResult
  targets: Array<{ id: string; name: string; path: string; success: boolean }>
}

const builtinSources: MarketSource[] = [
  {
    id: 'builtin-anthropic-skills',
    name: 'Anthropic 官方技能',
    source: 'anthropics/skills',
    description: 'Anthropic 官方 Agent Skills 示例与文档处理技能。',
    kind: 'git',
    palette: 'morandi',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-openclaw-skills',
    name: 'OpenClaw 官方技能',
    source: 'https://github.com/openclaw/openclaw/tree/main/skills',
    description: 'OpenClaw 官方仓库内置的 AgentSkills 兼容技能。',
    kind: 'git',
    palette: 'matisse',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-hermes-skills',
    name: 'Hermes 官方技能',
    source: 'https://github.com/NousResearch/hermes-agent/tree/main/optional-skills',
    description: 'Nous Research 为 Hermes Agent 维护的官方可选技能目录。',
    kind: 'git',
    palette: 'rococo',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-openai-skills',
    name: 'OpenAI 官方技能',
    source: 'https://github.com/openai/skills/tree/main/skills/.curated',
    description: 'OpenAI 为 Codex 维护的精选 Skill 目录。',
    kind: 'git',
    palette: 'memphis',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-vercel-agent-skills',
    name: 'Vercel Labs 精选',
    source: 'vercel-labs/agent-skills',
    description: 'Vercel Labs 官方仓库中的精选 Agent Skills。',
    kind: 'git',
    palette: 'mondrian',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-huggingface-skills',
    name: 'Hugging Face 官方技能',
    source: 'https://github.com/huggingface/skills/tree/main/skills',
    description: 'Hugging Face 官方发布的模型、数据集与训练工作流技能。',
    kind: 'git',
    palette: 'macaron',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-nvidia-skills',
    name: 'NVIDIA 官方技能',
    source: 'NVIDIA/skills',
    description: 'NVIDIA 官方发布的 AI 与加速计算 Agent Skills。',
    kind: 'git',
    palette: 'matisse',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-tencent-skillhub',
    name: '腾讯 SkillHub',
    source: 'https://api.skillhub.cn',
    description: '腾讯面向中国用户优化的 SkillHub 商店，提供推荐、搜索与高速下载。',
    kind: 'skillhub',
    palette: 'mondrian',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-redskill',
    name: '小红书 Red Skill',
    source: 'https://redskill.xiaohongshu.net',
    description: '小红书官方 Red Skill 市场，提供中文技能搜索、预览与安全下载。',
    kind: 'redskill',
    palette: 'rococo',
    builtin: true,
    enabled: true
  },
  {
    id: 'builtin-modelscope-skills',
    name: 'ModelScope Skills',
    source: 'https://modelscope.cn/skills',
    description: '魔搭社区官方 Skills 中心，提供中文技能目录、预览与 ZIP 下载。',
    kind: 'modelscope',
    palette: 'memphis',
    builtin: true,
    enabled: true
  }
]

export class SkillMarketManager {
  private loader: MarketSourceLoader
  private installedIndexCache: { expiresAt: number; appsBySkill: Map<string, string[]> } | null = null

  constructor(
    private settings: SettingsStore,
    private skillManager: SkillManager,
    cacheRoot: string
  ) {
    this.loader = new MarketSourceLoader(cacheRoot)
  }

  listSources(): MarketSource[] {
    const paletteOverrides = this.settings.getMarketSourcePalettes()
    const customSources = this.settings.getMarketSources().map(savedSourceToMarketSource)
    const sourceKeys = new Set(builtinSources.map((source) => normalizeSourceKey(source.source)))
    return [
      ...builtinSources.map((source) => ({
        ...source,
        palette: paletteOverrides[source.id] || source.palette
      })),
      ...customSources.filter((source) => {
        const key = normalizeSourceKey(source.source)
        if (sourceKeys.has(key)) return false
        sourceKeys.add(key)
        return true
      })
    ]
  }

  listInstallTargets(): MarketInstallTarget[] {
    return this.skillManager.getCatalogSnapshot().applications
      .filter((application) => application.systemSkillPaths.length || application.projectSkillPaths.length)
      .map((application) => ({
        id: application.id,
        name: application.name,
        path: application.systemSkillPaths[0] || application.projectSkillPaths[0],
        systemPath: application.systemSkillPaths[0] || null,
        projectPath: application.projectSkillPaths[0] || null,
        installed: true,
        selectedByDefault: false
      }))
  }

  addSource(input: MarketAddSourceInput): MarketSource[] {
    const source = input.source.trim()
    if (!source) throw new Error('市场源不能为空。')
    if (this.listSources().some((item) => normalizeSourceKey(item.source) === normalizeSourceKey(source))) {
      throw new Error('该市场源已经存在。')
    }

    const nextSource: SavedMarketSource = {
      id: crypto.randomUUID(),
      name: input.name?.trim() || inferSourceName(source),
      source,
      description: input.description?.trim() || '自定义市场源',
      kind: input.kind || inferMarketSourceKind(source),
      palette: input.palette || 'morandi',
      enabled: true
    }
    this.settings.saveMarketSources([...this.settings.getMarketSources(), nextSource])
    return this.listSources()
  }

  removeSource(sourceId: string): MarketSource[] {
    if (builtinSources.some((source) => source.id === sourceId)) throw new Error('内置市场源不能删除。')
    this.settings.saveMarketSources(this.settings.getMarketSources().filter((source) => source.id !== sourceId))
    return this.listSources()
  }

  updateSourcePalette(sourceId: string, palette: MarketPalette): MarketSource[] {
    if (!isMarketPalette(palette)) throw new Error('无法识别该市场色系。')
    if (builtinSources.some((source) => source.id === sourceId)) {
      this.settings.saveMarketSourcePalettes({
        ...this.settings.getMarketSourcePalettes(),
        [sourceId]: palette
      })
      return this.listSources()
    }
    const sources = this.settings.getMarketSources()
    if (!sources.some((source) => source.id === sourceId)) throw new Error('市场源不存在。')
    this.settings.saveMarketSources(sources.map((source) => source.id === sourceId ? { ...source, palette } : source))
    return this.listSources()
  }

  async listSkills(input: MarketListSkillsInput): Promise<MarketSkillResult> {
    const source = this.resolveSource(input)
    try {
      if (['skillhub', 'redskill', 'modelscope'].includes(source.kind)) {
        const result = await this.loader.listPage(
          source.source,
          source.kind,
          input.page || 1,
          input.pageSize || 100,
          input.query || ''
        )
        return {
          skills: this.mapCatalogSkills(source, result.records),
          command: `catalog ${source.source} page ${result.page}`,
          exitCode: 0,
          error: null,
          total: result.total,
          page: result.page,
          pageSize: result.pageSize
        }
      }
      const records = await this.loader.list(source.source, source.kind, input.refresh)
      return {
        skills: this.mapCatalogSkills(source, records),
        command: `catalog ${source.source}`,
        exitCode: 0,
        error: null
      }
    } catch (error) {
      return {
        skills: [],
        command: `catalog ${source.source}`,
        exitCode: 1,
        error: normalizeError(error)
      }
    }
  }

  listCachedSkills(input: MarketListSkillsInput): MarketSkillResult {
    const source = this.resolveSource(input)
    const cached = this.loader.readCachedCatalog(source.source, source.kind)
    return {
      skills: cached ? this.mapCatalogSkills(source, cached.records) : [],
      command: `cache ${source.source}`,
      exitCode: 0,
      error: null,
      cacheHit: Boolean(cached),
      isStale: cached ? !cached.isFresh : false,
      cachedAt: cached?.cachedAt
    }
  }

  listCachedSkillsBatch(input: { sourceIds: string[] }): Record<string, MarketSkillResult> {
    const results: Record<string, MarketSkillResult> = {}
    for (const sourceId of [...new Set(input.sourceIds)]) {
      try {
        results[sourceId] = this.listCachedSkills({ sourceId })
      } catch (error) {
        results[sourceId] = {
          skills: [],
          command: `cache ${sourceId}`,
          exitCode: 1,
          error: normalizeError(error),
          cacheHit: false,
          isStale: false
        }
      }
    }
    return results
  }

  async search(input: MarketSearchInput): Promise<MarketSkillResult> {
    if (!input.query.trim()) return { skills: [], command: 'skills find', exitCode: 0, error: null }
    const query = input.query.trim().toLowerCase()
    const enabledSources = this.listSources().filter((source) => source.enabled)
    const [sourceResults, publicResult] = await Promise.all([
      Promise.all(enabledSources.map((source) => this.listSkills({ sourceId: source.id }))),
      runSkillsCommand({ command: 'find', query: input.query, owner: input.owner })
    ])
    const failedSourceCount = sourceResults.filter((result) => result.error).length
    const configuredSkills = sourceResults
      .flatMap((result) => result.skills)
      .filter((skill) => marketSkillMatchesQuery(skill, query))
    const publicSkills = publicResult.exitCode === 0 ? parseSearchSkills(publicResult.stdout) : []
    return {
      skills: this.markInstalled(dedupeMarketSkills([...configuredSkills, ...publicSkills])),
      command: `search ${enabledSources.length} catalogs + ${publicResult.command}`,
      exitCode: failedSourceCount === enabledSources.length && publicResult.exitCode !== 0 ? 1 : 0,
      error: null,
      failedSourceCount,
      publicSearchFailed: publicResult.exitCode !== 0
    }
  }

  async searchPublic(input: MarketSearchInput): Promise<MarketSkillResult> {
    if (!input.query.trim()) return { skills: [], command: 'skills find', exitCode: 0, error: null }
    const result = await runSkillsCommand({ command: 'find', query: input.query, owner: input.owner })
    return {
      skills: result.exitCode === 0 ? this.markInstalled(parseSearchSkills(result.stdout)) : [],
      command: result.command,
      exitCode: result.exitCode,
      error: result.exitCode === 0 ? null : normalizeOutput(`${result.stdout}\n${result.stderr}`)
    }
  }

  async preview(input: MarketPreviewInput): Promise<MarketSkillPreview> {
    const configured = input.sourceId
      ? this.listSources().find((source) => source.id === input.sourceId)
      : undefined
    if (input.sourceId && !configured) throw new Error('未找到市场源。')
    const previewSource = configured?.source || input.source.trim()
    if (!previewSource) throw new Error('缺少预览来源。')
    const kind = configured?.kind || inferMarketSourceKind(previewSource)
    const preview = await this.loader.preview(previewSource, kind, input.skillName, input.refresh)
    const base: MarketSkill = {
      id: `${configured?.id || 'preview'}:${preview.name}`,
      name: preview.name,
      description: preview.description,
      author: preview.author,
      version: preview.version,
      category: preview.category,
      tags: preview.tags,
      sourceId: configured?.id || 'search',
      sourceName: configured?.name || inferSourceName(input.source),
      source: previewSource,
      installSource: previewSource,
      sourcePath: preview.sourcePath,
      installed: false,
      installedOn: [],
      compatibleAgents: [],
      fileCount: preview.fileCount,
      hasScripts: preview.hasScripts,
      origin: configured ? 'source' : 'search'
    }
    return {
      ...this.markInstalled([base])[0],
      content: preview.content,
      body: preview.body,
      files: preview.files,
      warnings: preview.warnings,
      fetchedAt: new Date().toISOString()
    }
  }

  async install(input: MarketInstallInput): Promise<MarketInstallResult> {
    if (!input.agents.length) throw new Error('请至少选择一个目标应用。')
    const availableTargets = this.skillManager.getCatalogSnapshot().applications
    const selectedTargets = input.agents.map((id) => {
      const target = availableTargets.find((item) => item.id === id)
      if (!target) throw new Error(`目标应用不可用：${id}`)
      return target
    })
    const projectDirectory = input.projectId
      ? this.settings.getProjects().find((project) => project.id === input.projectId)?.path
      : input.projectDirectory
    if (input.projectId && !projectDirectory) throw new Error('未找到已登记的项目目录。')
    const sourceKind = this.listSources().find(
      (source) => normalizeSourceKey(source.source) === normalizeSourceKey(input.source)
    )?.kind || inferMarketSourceKind(input.source)
    return this.installMaterializedSkill(input, selectedTargets, sourceKind, projectDirectory)
  }

  private async installMaterializedSkill(
    input: MarketInstallInput,
    selectedTargets: ApplicationRule[],
    kind: MarketSourceKind,
    projectDirectory?: string
  ): Promise<MarketInstallResult> {
    const startedAt = Date.now()
    const sourceDirectory = await this.loader.materialize(input.source, kind, input.skillName)
    const destinationName = input.skillName.split('/').pop() || input.skillName
    const targetResults: MarketInstallResult['targets'] = []
    const messages: string[] = []

    for (const target of selectedTargets) {
      const targetPath = projectDirectory
        ? target.projectSkillPaths[0] && resolve(projectDirectory, target.projectSkillPaths[0])
        : target.systemSkillPaths[0]
      if (!targetPath) throw new Error(`${target.name} 没有配置${projectDirectory ? '项目' : '系统'}技能目录。`)
      const baseDirectory = resolve(targetPath)
      const destination = resolve(baseDirectory, destinationName)
      const relativeDestination = relative(baseDirectory, destination)
      if (relativeDestination === '..' || relativeDestination.startsWith(`..${sep}`) || isAbsolute(relativeDestination)) {
        throw new Error('市场 Skill 安装路径超出目标应用目录。')
      }
      try {
        replaceDirectoryAtomically(
          sourceDirectory,
          destination,
          (path) => !path.endsWith('.sookool-cache.json')
        )
        targetResults.push({ id: target.id, name: target.name, path: destination, success: true })
        messages.push(`${target.name}: ${destination}`)
      } catch (error) {
        targetResults.push({ id: target.id, name: target.name, path: destination, success: false })
        messages.push(`${target.name}: ${normalizeError(error)}`)
      }
    }

    this.installedIndexCache = null

    const commandResult: SkillsCommandResult = {
      command: `${kind} install ${input.skillName} --dir <selected-apps>`,
      stdout: messages.join('\n'),
      stderr: targetResults.some((target) => !target.success) ? '部分目标安装失败。' : '',
      exitCode: targetResults.some((target) => !target.success) ? 1 : 0,
      durationMs: Date.now() - startedAt
    }
    const installedSkill = this.skillManager
      .listSkills()
      .find((skill) =>
        targetResults.some(
          (target) => target.success && resolve(skill.path) === resolve(target.path)
        )
      )
    return {
      skill: installedSkill ? this.skillManager.readSkill(installedSkill.path) : null,
      commandResult,
      targets: targetResults
    }
  }

  private resolveSource(input: MarketListSkillsInput): MarketSource {
    if (input.sourceId) {
      const source = this.listSources().find((item) => item.id === input.sourceId)
      if (!source) throw new Error('未找到市场源。')
      return source
    }
    if (input.source?.trim()) {
      const source = input.source.trim()
      return {
        id: `adhoc:${source}`,
        name: inferSourceName(source),
        source,
        description: '临时市场源',
        kind: inferMarketSourceKind(source),
        palette: 'morandi',
        builtin: false,
        enabled: true
      }
    }
    throw new Error('缺少市场源。')
  }

  private markInstalled(skills: MarketSkill[]): MarketSkill[] {
    const installed = this.getInstalledIndex()
    return skills.map((skill) => {
      const installedOn = installed.get(skill.name.toLowerCase()) || []
      return { ...skill, installed: installedOn.length > 0, installedOn }
    })
  }

  private getInstalledIndex(): Map<string, string[]> {
    if (this.installedIndexCache && this.installedIndexCache.expiresAt > Date.now()) {
      return this.installedIndexCache.appsBySkill
    }
    const roots = new Map(this.skillManager.getSkillRoots().map((root) => [root.id, root]))
    const mutable = new Map<string, Set<string>>()
    for (const skill of this.skillManager.listSkills()) {
      const key = skill.name.toLowerCase()
      const apps = mutable.get(key) || new Set<string>()
      for (const appId of roots.get(skill.rootId)?.appIds || []) apps.add(appId)
      mutable.set(key, apps)
    }
    const appsBySkill = new Map([...mutable].map(([name, apps]) => [name, [...apps]]))
    this.installedIndexCache = { expiresAt: Date.now() + 3_000, appsBySkill }
    return appsBySkill
  }

  private mapCatalogSkills(source: MarketSource, records: CatalogSkillRecord[]): MarketSkill[] {
    return this.markInstalled(records.map((record) => ({
      id: `${source.id}:${record.name}`,
      name: record.name,
      description: record.description,
      author: record.author,
      version: record.version,
      category: record.category,
      tags: record.tags,
      sourceId: source.id,
      sourceName: source.name,
      source: source.source,
      installSource: source.source,
      sourcePath: record.sourcePath,
      installed: false,
      installedOn: [],
      compatibleAgents: [],
      fileCount: source.kind === 'git' || source.kind === 'local' ? record.fileCount : undefined,
      hasScripts: record.hasScripts,
      origin: 'source'
    })))
  }
}

function savedSourceToMarketSource(source: SavedMarketSource): MarketSource {
  return {
    id: source.id,
    name: source.name,
    source: source.source,
    description: source.description || '自定义市场源',
    kind: source.kind || inferMarketSourceKind(source.source),
    palette: source.palette || 'morandi',
    builtin: false,
    enabled: source.enabled ?? true
  }
}

function isMarketPalette(value: unknown): value is MarketPalette {
  return ['memphis', 'macaron', 'rococo', 'mondrian', 'morandi', 'matisse'].includes(String(value))
}

function parseSearchSkills(stdout: string): MarketSkill[] {
  const lines = normalizeOutput(stdout).split('\n')
  const skills: MarketSkill[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed || trimmed.startsWith('Install with') || trimmed.startsWith('No skills found')) continue
    const token = trimmed.split(/\s+/)[0]
    const separator = token.lastIndexOf('@')
    if (separator <= 0) continue
    const source = token.slice(0, separator)
    const name = token.slice(separator + 1)
    const urlLine = lines[index + 1]?.trim()
    const url = urlLine?.startsWith('└ ') ? urlLine.slice(2).trim() : undefined
    skills.push({
      id: `search:${source}:${name}`,
      name,
      description: `由 ${source.split('/')[0] || '社区贡献者'} 发布的公开 Skill`,
      author: source.split('/')[0] || '社区贡献者',
      category: inferSearchCategory(name),
      tags: inferSearchTags(name),
      sourceId: 'search',
      sourceName: source,
      source,
      installSource: source,
      installed: false,
      installedOn: [],
      compatibleAgents: [],
      url,
      origin: 'search'
    })
  }
  return skills
}

function marketSkillMatchesQuery(skill: MarketSkill, query: string): boolean {
  return [skill.name, skill.description, skill.author, skill.category, skill.sourceName, ...skill.tags]
    .some((value) => value.toLowerCase().includes(query))
}

function dedupeMarketSkills(skills: MarketSkill[]): MarketSkill[] {
  const seen = new Set<string>()
  return skills.filter((skill) => {
    const key = `${normalizeSourceKey(skill.installSource)}:${skill.name.toLowerCase()}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function inferSearchCategory(name: string): string {
  const value = name.toLowerCase()
  if (/design|frontend|ui|ux/.test(value)) return '设计与前端'
  if (/test|review|debug|security/.test(value)) return '质量与安全'
  if (/data|sql|research|sheet/.test(value)) return '数据与研究'
  if (/write|doc|content|slide/.test(value)) return '内容与办公'
  if (/git|code|api|deploy/.test(value)) return '开发工具'
  return '效率工具'
}

function inferSearchTags(name: string): string[] {
  return name.split(/[-_]/).filter((part) => part.length > 2).slice(0, 4)
}

function normalizeOutput(value: string): string {
  return value
    .replace(/\u001b\[[0-9;?]*[A-Za-z]/g, '')
    .split('\n')
    .map((line) => line.replace(/[◇◒●■│]/g, '').trimEnd())
    .join('\n')
    .trim()
}

function normalizeSourceKey(source: string): string {
  return source.trim().replace(/\/+$/, '').toLowerCase()
}

function inferSourceName(source: string): string {
  const withoutSuffix = source.replace(/\.git$/, '').replace(/\/+$/, '')
  return withoutSuffix.split(/[/:]/).filter(Boolean).at(-1) || source
}

function normalizeError(error: unknown): string {
  return String(error).replace(/^Error:\s*/, '')
}
