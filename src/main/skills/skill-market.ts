import type { SettingsStore, SavedMarketSource } from '../settings/settings-store'
import type { SkillDetail } from './skill-types'
import type { SkillManager } from './skill-manager'
import { runSkillsCommand, type SkillsCommandResult } from './ecosystem'

export interface MarketSource {
  id: string
  name: string
  source: string
  description: string
  builtin: boolean
  enabled: boolean
}

export interface MarketSkill {
  id: string
  name: string
  description: string
  sourceId: string
  sourceName: string
  source: string
  installSource: string
  installed: boolean
  url?: string
  origin: 'source' | 'search'
}

export interface MarketListSkillsInput {
  sourceId?: string
  source?: string
}

export interface MarketSearchInput {
  query: string
  owner?: string
}

export interface MarketAddSourceInput {
  name?: string
  source: string
  description?: string
}

export interface MarketInstallInput {
  source: string
  skillName: string
  copy?: boolean
}

export interface MarketSkillResult {
  skills: MarketSkill[]
  command: string
  exitCode: number
  error: string | null
}

export interface MarketInstallResult {
  skill: SkillDetail | null
  commandResult: SkillsCommandResult
}

const builtinSources: MarketSource[] = [
  {
    id: 'builtin-vercel-agent-skills',
    name: 'Agent Skills',
    source: 'vercel-labs/agent-skills',
    description: 'skills.sh 生态里的公共技能集合，适合用作探索入口。',
    builtin: true,
    enabled: true
  }
]

export class SkillMarketManager {
  constructor(
    private settings: SettingsStore,
    private skillManager: SkillManager
  ) {}

  listSources(): MarketSource[] {
    const customSources = this.settings.getMarketSources().map(savedSourceToMarketSource)
    const sourceKeys = new Set(builtinSources.map((source) => normalizeSourceKey(source.source)))

    return [
      ...builtinSources,
      ...customSources.filter((source) => {
        const key = normalizeSourceKey(source.source)
        if (sourceKeys.has(key)) return false
        sourceKeys.add(key)
        return true
      })
    ]
  }

  addSource(input: MarketAddSourceInput): MarketSource[] {
    const source = input.source.trim()
    if (!source) throw new Error('市场源不能为空。')

    const duplicate = this.listSources().find(
      (item) => normalizeSourceKey(item.source) === normalizeSourceKey(source)
    )
    if (duplicate) throw new Error('该市场源已经存在。')

    const nextSource: SavedMarketSource = {
      id: crypto.randomUUID(),
      name: input.name?.trim() || inferSourceName(source),
      source,
      description: input.description?.trim() || '自定义市场源',
      enabled: true
    }

    this.settings.saveMarketSources([...this.settings.getMarketSources(), nextSource])
    return this.listSources()
  }

  removeSource(sourceId: string): MarketSource[] {
    if (builtinSources.some((source) => source.id === sourceId)) {
      throw new Error('内置市场源不能删除。')
    }

    this.settings.saveMarketSources(
      this.settings.getMarketSources().filter((source) => source.id !== sourceId)
    )
    return this.listSources()
  }

  async listSkills(input: MarketListSkillsInput): Promise<MarketSkillResult> {
    const source = this.resolveSource(input)
    const result = await runSkillsCommand({
      command: 'add',
      source: source.source,
      listOnly: true
    })
    const skills = this.markInstalled(
      parseSourceSkills(result.stdout, source).map((skill) => ({
        ...skill,
        sourceId: source.id,
        sourceName: source.name
      }))
    )

    return {
      skills,
      command: result.command,
      exitCode: result.exitCode,
      error: result.exitCode === 0 ? null : normalizeOutput(`${result.stdout}\n${result.stderr}`)
    }
  }

  async search(input: MarketSearchInput): Promise<MarketSkillResult> {
    if (!input.query.trim()) {
      return { skills: [], command: 'skills find', exitCode: 0, error: null }
    }

    const result = await runSkillsCommand({
      command: 'find',
      query: input.query,
      owner: input.owner
    })

    return {
      skills: this.markInstalled(parseSearchSkills(result.stdout)),
      command: result.command,
      exitCode: result.exitCode,
      error: result.exitCode === 0 ? null : normalizeOutput(`${result.stdout}\n${result.stderr}`)
    }
  }

  async install(input: MarketInstallInput): Promise<MarketInstallResult> {
    const result = await runSkillsCommand({
      command: 'add',
      source: input.source,
      skills: [input.skillName],
      global: true,
      copy: input.copy ?? true,
      yes: true
    })
    const installedSkill =
      result.exitCode === 0
        ? this.skillManager
            .listSkills()
            .find((skill) => skill.name.toLowerCase() === input.skillName.toLowerCase())
        : null

    return {
      skill: installedSkill ? this.skillManager.readSkill(installedSkill.path) : null,
      commandResult: result
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
        builtin: false,
        enabled: true
      }
    }

    throw new Error('缺少市场源。')
  }

  private markInstalled(skills: MarketSkill[]): MarketSkill[] {
    const installedNames = new Set(
      this.skillManager.listSkills().map((skill) => skill.name.toLowerCase())
    )

    return skills.map((skill) => ({
      ...skill,
      installed: installedNames.has(skill.name.toLowerCase())
    }))
  }
}

function savedSourceToMarketSource(source: SavedMarketSource): MarketSource {
  return {
    id: source.id,
    name: source.name,
    source: source.source,
    description: source.description || '自定义市场源',
    builtin: false,
    enabled: source.enabled ?? true
  }
}

function parseSourceSkills(stdout: string, source: MarketSource): MarketSkill[] {
  const lines = normalizeOutput(stdout).split('\n')
  const skills: MarketSkill[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    let name = ''
    let description = ''

    if (trimmed.startsWith('Skill:')) {
      name = trimmed.slice('Skill:'.length).trim()
      description = lines[index + 1]?.trim() || ''
    } else if (isAvailableSkillName(lines, index)) {
      name = trimmed
      description = lines[index + 1]?.trim() || ''
    }

    if (!name || skills.some((skill) => skill.name === name)) continue
    skills.push({
      id: `${source.id}:${name}`,
      name,
      description: cleanDescription(description) || '暂无描述',
      sourceId: source.id,
      sourceName: source.name,
      source: source.source,
      installSource: source.source,
      installed: false,
      origin: 'source'
    })
  }

  return skills
}

function parseSearchSkills(stdout: string): MarketSkill[] {
  const lines = normalizeOutput(stdout).split('\n')
  const skills: MarketSkill[] = []

  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim()
    if (!trimmed || trimmed.startsWith('Install with') || trimmed.startsWith('No skills found')) {
      continue
    }

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
      description: '来自 skills.sh 搜索结果',
      sourceId: 'search',
      sourceName: source,
      source,
      installSource: source,
      installed: false,
      url,
      origin: 'search'
    })
  }

  return skills
}

function isAvailableSkillName(lines: string[], index: number): boolean {
  const line = lines[index]
  const trimmed = line.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('Available Skills')) return false
  if (trimmed.startsWith('Run without')) return false
  if (trimmed.startsWith('Files:')) return false
  if (trimmed.includes(':')) return false
  if (!line.startsWith('  ') || line.startsWith('    ')) return false
  return Boolean(lines[index + 1]?.startsWith('    '))
}

function cleanDescription(value: string): string {
  if (value.startsWith('Files:')) return ''
  return value.replace(/^[-•]\s*/, '').trim()
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
  const parts = withoutSuffix.split(/[/:]/).filter(Boolean)
  return parts.at(-1) || source
}
