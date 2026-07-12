import { createHash } from 'crypto'
import { spawn } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'path'
import { homedir } from 'os'
import extractZip from 'extract-zip'
import { parseSkillMarkdown } from './skill-parser'
import { MarketCatalogCache, type CatalogCacheRead } from './market-catalog-cache'
import { extractCompatibleZip } from './archive-extractor'
import { mergeCatalogRecords } from './market-catalog-utils'

export type MarketSourceKind = 'skills-sh' | 'skillhub' | 'redskill' | 'modelscope' | 'git' | 'local'

export interface CatalogSkillRecord {
  name: string
  description: string
  author: string
  version?: string
  category: string
  tags: string[]
  sourcePath: string
  skillDirectory: string
  fileCount?: number
  hasScripts: boolean
}

export interface CatalogPage {
  records: CatalogSkillRecord[]
  total: number
  page: number
  pageSize: number
}

export interface MarketPreviewFile {
  name: string
  relativePath: string
  kind: 'markdown' | 'script' | 'json' | 'text' | 'image' | 'binary'
  size: number
  content: string | null
  dataUrl?: string
  truncated: boolean
}

export interface CatalogSkillPreview extends CatalogSkillRecord {
  content: string
  body: string
  files: MarketPreviewFile[]
  warnings: string[]
}

interface ResolvedSource {
  root: string
  prefix: string
}

const ignoredDirectories = new Set(['.git', 'node_modules', 'dist', 'out', 'build'])
const maxFileBytes = 256 * 1024
const maxImagePreviewBytes = 8 * 1024 * 1024
const maxPreviewFiles = 160
const cacheMaxAgeMs = 5 * 60 * 1000
const catalogMemoryMaxAgeMs = 15 * 60 * 1000

export class MarketSourceLoader {
  private catalogCache = new Map<string, { records: CatalogSkillRecord[]; cachedAt: number }>()
  private catalogRequests = new Map<string, { promise: Promise<CatalogSkillRecord[]>; refresh: boolean }>()
  private modelScopeMaterializations = new Map<string, Promise<string>>()
  private redSkillDefaultCatalogs = new Map<string, { records: CatalogSkillRecord[]; cachedAt: number }>()
  private redSkillDefaultRequests = new Map<string, Promise<CatalogSkillRecord[]>>()
  private catalogDiskCache: MarketCatalogCache

  constructor(private cacheRoot: string) {
    this.catalogDiskCache = new MarketCatalogCache(join(cacheRoot, 'catalogs'))
  }

  readCachedCatalog(source: string, kind: MarketSourceKind): CatalogCacheRead | null {
    const cacheKey = `${kind}:${source.trim()}`
    const memory = this.catalogCache.get(cacheKey)
    if (memory) {
      this.rememberCatalog(cacheKey, memory)
      return {
        records: memory.records,
        cachedAt: memory.cachedAt,
        isFresh: Date.now() - memory.cachedAt < catalogMemoryMaxAgeMs
      }
    }
    return this.catalogDiskCache.read(kind, source, catalogMemoryMaxAgeMs)
  }

  async list(source: string, kind: MarketSourceKind, refresh = false): Promise<CatalogSkillRecord[]> {
    const cacheKey = `${kind}:${source.trim()}`
    const cached = this.catalogCache.get(cacheKey)
    if (!refresh && cached && Date.now() - cached.cachedAt < catalogMemoryMaxAgeMs) {
      this.rememberCatalog(cacheKey, cached)
      return cached.records
    }
    if (!refresh) {
      const persisted = this.catalogDiskCache.read(kind, source, catalogMemoryMaxAgeMs)
      if (persisted?.isFresh) {
        this.rememberCatalog(cacheKey, { records: persisted.records, cachedAt: persisted.cachedAt })
        return persisted.records
      }
    }

    const running = this.catalogRequests.get(cacheKey)
    if (running) {
      if (!refresh || running.refresh) return running.promise
      return running.promise.catch(() => undefined).then(() => this.list(source, kind, true))
    }
    const request = this.fetchCatalog(source, kind, refresh)
      .then((records) => {
        const cachedAt = Date.now()
        this.rememberCatalog(cacheKey, { records, cachedAt })
        void this.catalogDiskCache.writeAsync(kind, source, records).catch(() => {
          // A persistence failure must not discard a successfully fetched in-memory catalog.
        })
        return records
      })
      .finally(() => {
        if (this.catalogRequests.get(cacheKey)?.promise === request) this.catalogRequests.delete(cacheKey)
      })
    this.catalogRequests.set(cacheKey, { promise: request, refresh })
    return request
  }

  async listPage(
    source: string,
    kind: MarketSourceKind,
    page: number,
    pageSize: number,
    query = '',
    refresh = false
  ): Promise<CatalogPage> {
    const safePage = Math.max(1, Math.floor(page))
    const safePageSize = Math.max(1, Math.min(100, Math.floor(pageSize)))
    if (kind === 'skillhub') return listSkillHubCatalog(source, safePage, safePageSize, query)
    if (kind === 'redskill') {
      if (query.trim()) return listRedSkillCatalog(source, safePage, safePageSize, query)
      const sourceKey = source.trim().toLowerCase()
      if (refresh) {
        await this.redSkillDefaultRequests.get(sourceKey)?.catch(() => undefined)
        this.redSkillDefaultCatalogs.delete(sourceKey)
      }
      const records = await this.loadRedSkillDefaultCatalog(source)
      const start = (safePage - 1) * safePageSize
      return {
        records: records.slice(start, start + safePageSize),
        total: records.length,
        page: safePage,
        pageSize: safePageSize
      }
    }
    if (kind === 'modelscope') return listModelScopeCatalog(source, safePage, safePageSize, query)
    const records = await this.list(source, kind)
    return { records, total: records.length, page: 1, pageSize: records.length || safePageSize }
  }

  private async loadRedSkillDefaultCatalog(source: string): Promise<CatalogSkillRecord[]> {
    const sourceKey = source.trim().toLowerCase()
    const cached = this.redSkillDefaultCatalogs.get(sourceKey)
    if (cached && Date.now() - cached.cachedAt < catalogMemoryMaxAgeMs) return cached.records
    const running = this.redSkillDefaultRequests.get(sourceKey)
    if (running) return running

    const request = Promise.all([
      listAllRedSkillMatches(source, 'skill'),
      listAllRedSkillMatches(source, '技能')
    ])
      .then((groups) => {
        const records = mergeCatalogRecords(groups.flat())
        this.redSkillDefaultCatalogs.set(sourceKey, { records, cachedAt: Date.now() })
        return records
      })
      .finally(() => {
        if (this.redSkillDefaultRequests.get(sourceKey) === request) {
          this.redSkillDefaultRequests.delete(sourceKey)
        }
      })
    this.redSkillDefaultRequests.set(sourceKey, request)
    return request
  }

  private rememberCatalog(key: string, value: { records: CatalogSkillRecord[]; cachedAt: number }): void {
    this.catalogCache.delete(key)
    this.catalogCache.set(key, value)
    while (this.catalogCache.size > 24) {
      this.catalogCache.delete(this.catalogCache.keys().next().value as string)
    }
  }

  private async fetchCatalog(
    source: string,
    kind: MarketSourceKind,
    refresh: boolean
  ): Promise<CatalogSkillRecord[]> {
    if (kind === 'skillhub') return (await listSkillHubCatalog(source)).records
    if (kind === 'redskill') return (await listRedSkillCatalog(source)).records
    if (kind === 'modelscope') return (await listModelScopeCatalog(source)).records
    const resolved = await this.resolveSource(source, kind, refresh)
    const searchRoot = resolveWithinSource(resolved.root, resolved.prefix)
    return findSkillDirectories(searchRoot).map((directory) => readCatalogSkill(directory, resolved.root))
  }

  async preview(
    source: string,
    kind: MarketSourceKind,
    skillName: string,
    refresh = false
  ): Promise<CatalogSkillPreview> {
    if (kind === 'skillhub') {
      const directory = await this.materializeSkillHubSkill(source, skillName, refresh)
      return readCatalogPreview(directory, directory)
    }
    if (kind === 'redskill') {
      const directory = await this.materializeRedSkill(source, skillName, refresh)
      return readCatalogPreview(directory, directory)
    }
    if (kind === 'modelscope') {
      const directory = await this.materializeModelScopeSkill(source, skillName, refresh)
      return readCatalogPreview(directory, directory)
    }
    const resolved = await this.resolveSource(source, kind, refresh)
    const selected = findCatalogSkillDirectory(resolved, skillName)
    if (!selected) throw new Error(`市场源中未找到 Skill：${skillName}`)

    return readCatalogPreview(selected, resolved.root)
  }

  async materialize(
    source: string,
    kind: MarketSourceKind,
    skillName: string,
    refresh = false
  ): Promise<string> {
    if (kind === 'skillhub') return this.materializeSkillHubSkill(source, skillName, refresh)
    if (kind === 'redskill') return this.materializeRedSkill(source, skillName, refresh)
    if (kind === 'modelscope') return this.materializeModelScopeSkill(source, skillName, refresh)
    const resolved = await this.resolveSource(source, kind, refresh)
    const selected = findCatalogSkillDirectory(resolved, skillName)
    if (!selected) throw new Error(`市场源中未找到 Skill：${skillName}`)
    return selected
  }

  async materializeSkillHubSkill(
    source: string,
    skillName: string,
    refresh = false
  ): Promise<string> {
    const slug = normalizeRemoteSlug(skillName)
    const key = createHash('sha256').update(`skillhub:${source}:${slug}`).digest('hex').slice(0, 20)
    const target = join(this.cacheRoot, `skillhub-${key}`)
    const staging = `${target}.staging`
    const stamp = join(target, '.sookool-cache.json')
    const fresh =
      !refresh && existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < cacheMaxAgeMs
    if (!fresh) {
      mkdirSync(this.cacheRoot, { recursive: true })
      rmSync(staging, { recursive: true, force: true })
      mkdirSync(staging, { recursive: true })
      const zipPath = join(this.cacheRoot, `skillhub-${key}.zip`)
      try {
        const base = normalizeSkillHubBase(source)
        const response = await fetch(`${base}/api/v1/download?slug=${encodeURIComponent(slug)}`, {
          headers: { Accept: 'application/zip', 'User-Agent': 'SooKool-Agent-Helper/0.1' }
        })
        if (!response.ok) throw new Error(`SkillHub 下载失败：HTTP ${response.status}`)
        writeFileSync(zipPath, Buffer.from(await response.arrayBuffer()))
        await extractZip(zipPath, { dir: staging })
        const directories = findSkillDirectories(staging)
        if (!directories.length) throw new Error('SkillHub 下载包中没有有效的 SKILL.md。')
        writeFileSync(
          join(staging, '.sookool-cache.json'),
          JSON.stringify({ source, slug, syncedAt: new Date().toISOString() })
        )
        rmSync(target, { recursive: true, force: true })
        renameDirectory(staging, target)
      } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        if (!existsSync(stamp)) throw error
      } finally {
        rmSync(zipPath, { force: true })
      }
    }
    const directory = findSkillDirectories(target)[0]
    if (!directory) throw new Error(`SkillHub 缓存中未找到 Skill：${slug}`)
    return directory
  }

  async materializeRedSkill(source: string, skillName: string, refresh = false): Promise<string> {
    normalizeRedSkillSource(source)
    const identifier = normalizeRemoteSlug(skillName)
    const key = createHash('sha256').update(`redskill:${identifier}`).digest('hex').slice(0, 20)
    const target = join(this.cacheRoot, `redskill-${key}`)
    const staging = `${target}.staging`
    const stamp = join(target, '.sookool-cache.json')
    const fresh = !refresh && existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < cacheMaxAgeMs
    if (!fresh) {
      mkdirSync(this.cacheRoot, { recursive: true })
      rmSync(staging, { recursive: true, force: true })
      mkdirSync(staging, { recursive: true })
      const zipPath = join(this.cacheRoot, `redskill-${key}.zip`)
      try {
        const bundleResponse = await fetch(`${redSkillApiBase}/get_skill_bundle?identifier=${encodeURIComponent(identifier)}`, {
          headers: { Accept: 'application/json, application/zip, */*', 'User-Agent': 'SooKool-Agent-Helper/0.1' }
        })
        if (!bundleResponse.ok) throw new Error(`Red Skill 下载失败：HTTP ${bundleResponse.status}`)
        const contentType = bundleResponse.headers.get('content-type') || ''
        let archive: Buffer
        let expectedHash = bundleResponse.headers.get('x-skill-sha256') || ''
        if (contentType.includes('application/json')) {
          const envelope = (await bundleResponse.json()) as Record<string, unknown>
          const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope) as Record<string, unknown>
          const zipUrl = normalizeRedSkillDownloadUrl(String(data.zip_url || ''))
          expectedHash = String(data.sha256 || '')
          const archiveResponse = await fetch(zipUrl, { headers: { 'User-Agent': 'SooKool-Agent-Helper/0.1' } })
          if (!archiveResponse.ok) throw new Error(`Red Skill 技能包下载失败：HTTP ${archiveResponse.status}`)
          archive = Buffer.from(await archiveResponse.arrayBuffer())
        } else {
          archive = Buffer.from(await bundleResponse.arrayBuffer())
        }
        if (!/^[a-f0-9]{64}$/i.test(expectedHash)) throw new Error('Red Skill 技能包缺少有效的 SHA-256 校验值。')
        if (createHash('sha256').update(archive).digest('hex') !== expectedHash.toLowerCase()) throw new Error('Red Skill 技能包完整性校验失败。')
        writeFileSync(zipPath, archive)
        await extractZip(zipPath, { dir: staging })
        if (!findSkillDirectories(staging).length) throw new Error('Red Skill 技能包中没有有效的 SKILL.md。')
        writeFileSync(stamp.replace(target, staging), JSON.stringify({ source, identifier, syncedAt: new Date().toISOString() }))
        rmSync(target, { recursive: true, force: true })
        renameDirectory(staging, target)
      } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        if (!existsSync(stamp)) throw error
      } finally {
        rmSync(zipPath, { force: true })
      }
    }
    const directory = findSkillDirectories(target)[0]
    if (!directory) throw new Error(`Red Skill 缓存中未找到 Skill：${identifier}`)
    return directory
  }

  async materializeModelScopeSkill(source: string, skillName: string, refresh = false): Promise<string> {
    const requestKey = `${source.trim()}:${skillName.trim()}:${refresh ? 'refresh' : 'cached'}`
    const running = this.modelScopeMaterializations.get(requestKey)
    if (running) return running
    const request = this.materializeModelScopeSkillOnce(source, skillName, refresh).finally(() => {
      if (this.modelScopeMaterializations.get(requestKey) === request) {
        this.modelScopeMaterializations.delete(requestKey)
      }
    })
    this.modelScopeMaterializations.set(requestKey, request)
    return request
  }

  private async materializeModelScopeSkillOnce(source: string, skillName: string, refresh: boolean): Promise<string> {
    normalizeModelScopeSource(source)
    const identifier = normalizeModelScopeIdentifier(skillName)
    const key = createHash('sha256').update(`modelscope:${identifier}`).digest('hex').slice(0, 20)
    const target = join(this.cacheRoot, `modelscope-${key}`)
    const staging = `${target}.staging`
    const stamp = join(target, '.sookool-cache.json')
    const fresh = !refresh && existsSync(stamp) && Date.now() - statSync(stamp).mtimeMs < cacheMaxAgeMs
    if (!fresh) {
      mkdirSync(this.cacheRoot, { recursive: true })
      rmSync(staging, { recursive: true, force: true })
      mkdirSync(staging, { recursive: true })
      const zipPath = join(this.cacheRoot, `modelscope-${key}.zip`)
      try {
        const encodedIdentifier = identifier.split('/').map(encodeURIComponent).join('/')
        const archive = await downloadModelScopeArchive(
          `https://www.modelscope.cn/skills/${encodedIdentifier}/archive/zip/master`
        )
        writeFileSync(zipPath, archive)
        await extractCompatibleZip(zipPath, staging)
        if (!findSkillDirectories(staging).length) throw new Error('ModelScope 技能包中没有有效的 SKILL.md。')
        writeFileSync(join(staging, '.sookool-cache.json'), JSON.stringify({ source, identifier, syncedAt: new Date().toISOString() }))
        rmSync(target, { recursive: true, force: true })
        renameDirectory(staging, target)
      } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        if (!existsSync(stamp)) throw error
      } finally {
        rmSync(zipPath, { force: true })
      }
    }
    const directory = findSkillDirectories(target)[0]
    if (!directory) throw new Error(`ModelScope 缓存中未找到 Skill：${identifier}`)
    return directory
  }

  private async resolveSource(
    source: string,
    kind: MarketSourceKind,
    refresh: boolean
  ): Promise<ResolvedSource> {
    if (kind === 'local' || looksLikeLocalPath(source)) {
      const root = expandPath(source)
      if (!existsSync(root)) throw new Error(`本地市场源不存在：${root}`)
      return { root, prefix: '' }
    }

    const parsed = parseGitSource(source)
    mkdirSync(this.cacheRoot, { recursive: true })
    const key = createHash('sha256').update(`${parsed.url}#${parsed.ref || ''}`).digest('hex').slice(0, 20)
    const target = join(this.cacheRoot, key)
    const staging = join(this.cacheRoot, `${key}.staging`)
    const stamp = join(target, '.sookool-cache.json')
    const fresh =
      !refresh &&
      existsSync(stamp) &&
      Date.now() - statSync(stamp).mtimeMs < cacheMaxAgeMs &&
      existsSync(join(target, '.git'))

    if (!fresh) {
      const args = ['clone', '--depth', '1']
      if (parsed.ref) args.push('--branch', parsed.ref)
      if (parsed.prefix) args.push('--filter=blob:none', '--sparse')
      args.push(parsed.url, staging)
      rmSync(staging, { recursive: true, force: true })
      try {
        await runGit(args)
        if (parsed.prefix) {
          await runGit(['-C', staging, 'sparse-checkout', 'set', '--no-cone', parsed.prefix])
        }
        writeFileSync(
          join(staging, '.sookool-cache.json'),
          JSON.stringify({ source, syncedAt: new Date().toISOString() })
        )
        rmSync(target, { recursive: true, force: true })
        renameDirectory(staging, target)
      } catch (error) {
        rmSync(staging, { recursive: true, force: true })
        if (!existsSync(join(target, '.git'))) throw error
      }
    }

    return { root: target, prefix: parsed.prefix }
  }
}

async function listSkillHubCatalog(source: string, page = 1, pageSize = 100, query = ''): Promise<CatalogPage> {
  const base = normalizeSkillHubBase(source)
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (query.trim()) params.set('keyword', query.trim())
  const response = await fetch(`${base}/api/skills?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SooKool-Agent-Helper/0.1' }
  })
  if (!response.ok) throw new Error(`SkillHub 目录加载失败：HTTP ${response.status}`)
  const envelope = (await response.json()) as Record<string, unknown>
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope) as Record<string, unknown>
  if (!Array.isArray(data.skills)) throw new Error('SkillHub 返回了无法识别的目录数据。')
  const records = data.skills.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const skill = item as Record<string, unknown>
    const slug = String(skill.slug || '').trim()
    if (!slug) return []
    const subCategories = Array.isArray(skill.subCategories)
      ? skill.subCategories
          .map((category) =>
            category && typeof category === 'object'
              ? String((category as Record<string, unknown>).name || '')
              : ''
          )
          .filter(Boolean)
      : []
    const tags = Array.isArray(skill.tags) ? skill.tags.map(String).filter(Boolean) : []
    return [
      {
        name: String(skill.name || slug),
        description: String(skill.description_zh || skill.description || '暂无描述'),
        author: String(skill.ownerName || 'SkillHub'),
        version: String(skill.version || '') || undefined,
        category: mapSkillHubCategory(String(skill.category || '')),
        tags: [...new Set([...subCategories, ...tags])].slice(0, 6),
        sourcePath: slug,
        skillDirectory: '',
        hasScripts: false
      }
    ]
  })
  return { records, total: Number(data.total) || records.length, page, pageSize }
}

const redSkillApiBase = 'https://edith.xiaohongshu.com/api/sns/v1/creator/red_skill'
const modelScopeApiBase = 'https://modelscope.cn/openapi/v1'

async function listRedSkillCatalog(source: string, page = 1, pageSize = 100, query = ''): Promise<CatalogPage> {
  normalizeRedSkillSource(source)
  const params = new URLSearchParams({ q: query.trim() || 'skill', limit: String(pageSize), page: String(page) })
  const response = await fetch(`${redSkillApiBase}/search_published_skills?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SooKool-Agent-Helper/0.1' }
  })
  if (!response.ok) throw new Error(`Red Skill 目录加载失败：HTTP ${response.status}`)
  const envelope = (await response.json()) as Record<string, unknown>
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope) as Record<string, unknown>
  if (!Array.isArray(data.results)) throw new Error('Red Skill 返回了无法识别的目录数据。')
  const records = data.results.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const skill = item as Record<string, unknown>
    const identifier = String(skill.identifier || skill.slug || '').trim()
    if (!identifier) return []
    const tags = Array.isArray(skill.tags) ? skill.tags.map(String).filter(Boolean) : []
    return [{
      name: String(skill.name || identifier),
      description: String(skill.description || '暂无描述'),
      author: String(skill.author || 'Red Skill'),
      version: String(skill.version || '') || undefined,
      category: tags[0] || '内容与办公',
      tags: tags.slice(0, 6),
      sourcePath: identifier,
      skillDirectory: '',
      hasScripts: false
    }]
  })
  return { records, total: Number(data.total) || records.length, page, pageSize }
}

async function listAllRedSkillMatches(source: string, query: string): Promise<CatalogSkillRecord[]> {
  const first = await loadRedSkillPage(source, 1, 100, query)
  const remainingPages = Math.max(0, Math.ceil(first.total / first.pageSize) - 1)
  if (!remainingPages) return first.records
  const remaining = await mapWithConcurrency(
    Array.from({ length: remainingPages }, (_, index) => index + 2),
    3,
    (page) => loadRedSkillPage(source, page, first.pageSize, query)
  )
  return [first, ...remaining].flatMap((result) => result.records)
}

async function loadRedSkillPage(source: string, page: number, pageSize: number, query: string): Promise<CatalogPage> {
  try {
    return await listRedSkillCatalog(source, page, pageSize, query)
  } catch {
    return listRedSkillCatalog(source, page, pageSize, query)
  }
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  task: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await task(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
  return results
}

async function listModelScopeCatalog(source: string, page = 1, pageSize = 100, query = ''): Promise<CatalogPage> {
  normalizeModelScopeSource(source)
  const params = new URLSearchParams({ page_number: String(page), page_size: String(pageSize) })
  if (query.trim()) params.set('search', query.trim())
  const response = await fetch(`${modelScopeApiBase}/skills?${params.toString()}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'SooKool-Agent-Helper/0.1' }
  })
  if (!response.ok) throw new Error(`ModelScope 目录加载失败：HTTP ${response.status}`)
  const envelope = (await response.json()) as Record<string, unknown>
  const data = (envelope.data && typeof envelope.data === 'object' ? envelope.data : envelope) as Record<string, unknown>
  if (!Array.isArray(data.skills)) throw new Error('ModelScope 返回了无法识别的目录数据。')
  const records = data.skills.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const skill = item as Record<string, unknown>
    const identifier = String(skill.id || '').trim()
    if (!identifier) return []
    const tags = Array.isArray(skill.tags) ? skill.tags.map(String).filter(Boolean) : []
    return [{
      name: String(skill.display_name || identifier.split('/').pop() || identifier),
      description: String(skill.description || '暂无描述'),
      author: String(skill.owner || skill.developer || identifier.split('/')[0] || 'ModelScope'),
      category: mapModelScopeCategory(String(skill.category || '')),
      tags: tags.filter((tag) => !tag.startsWith('category:') && !tag.startsWith('developer:')).slice(0, 6),
      sourcePath: identifier,
      skillDirectory: '',
      hasScripts: false
    }]
  })
  return { records, total: Number(data.total) || records.length, page, pageSize }
}

function readCatalogPreview(directory: string, sourceRoot: string): CatalogSkillPreview {
  const record = readCatalogSkill(directory, sourceRoot)
  const content = readFileSync(join(directory, 'SKILL.md'), 'utf-8')
  const parsed = parseSkillMarkdown(content)
  const files = listPreviewFiles(directory)
  const warnings = parsed.issues.map((issue) => issue.message)
  if (record.hasScripts) warnings.push('此 Skill 包含脚本文件。安装前请检查脚本内容。')
  if (files.some((file) => file.kind === 'binary')) {
    warnings.push('此 Skill 包含无法直接预览的二进制文件。')
  }
  return { ...record, content, body: parsed.body, files, warnings: [...new Set(warnings)] }
}

function normalizeSkillHubBase(source: string): string {
  const value = source.trim().replace(/\/+$/, '')
  if (!/^https:\/\/api\.skillhub\.cn$/i.test(value)) {
    throw new Error('SkillHub 来源必须使用官方 API 地址。')
  }
  return value
}

function normalizeRedSkillSource(source: string): void {
  if (!/^https:\/\/redskill\.xiaohongshu\.net\/?$/i.test(source.trim())) {
    throw new Error('Red Skill 来源必须使用小红书官方地址。')
  }
}

function normalizeModelScopeSource(source: string): void {
  if (!/^https:\/\/(?:www\.)?modelscope\.cn\/skills\/?$/i.test(source.trim())) {
    throw new Error('ModelScope 来源必须使用官方 Skills 地址。')
  }
}

function normalizeModelScopeIdentifier(value: string): string {
  const identifier = value.trim()
  if (!/^@?[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(identifier)) {
    throw new Error('ModelScope Skill 标识无效。')
  }
  return identifier
}

function isZipArchive(value: Buffer): boolean {
  if (value.length < 4 || value[0] !== 0x50 || value[1] !== 0x4b) return false
  return (
    (value[2] === 0x03 && value[3] === 0x04) ||
    (value[2] === 0x05 && value[3] === 0x06) ||
    (value[2] === 0x07 && value[3] === 0x08)
  )
}

async function downloadModelScopeArchive(url: string): Promise<Buffer> {
  let lastFailure = '返回内容不是 ZIP 文件'
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/zip',
        'Cache-Control': 'no-cache',
        'User-Agent': 'SooKool-Agent-Helper/0.1'
      },
      redirect: 'follow'
    })
    if (response.ok) {
      const archive = Buffer.from(await response.arrayBuffer())
      if (isZipArchive(archive)) return archive
      lastFailure = `返回内容不是 ZIP 文件（${response.headers.get('content-type') || '未知类型'}）`
    } else {
      lastFailure = `HTTP ${response.status}`
    }
    if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)))
  }
  throw new Error(`ModelScope 下载失败：${lastFailure}`)
}

function mapModelScopeCategory(category: string): string {
  if (category.includes('developer') || category.includes('cloud')) return '开发工具'
  if (category.includes('data') || category.includes('research')) return '数据与研究'
  if (category.includes('content') || category.includes('media')) return '内容与办公'
  if (category.includes('security') || category.includes('quality')) return '质量与安全'
  if (category.includes('design') || category.includes('frontend')) return '设计与前端'
  return '效率工具'
}

function normalizeRedSkillDownloadUrl(value: string): string {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('Red Skill 返回了无效的下载地址。')
  }
  if (url.protocol === 'http:') {
    const host = url.hostname.toLowerCase()
    if (host !== 'xhscdn.com' && !host.endsWith('.xhscdn.com')) {
      throw new Error('Red Skill 返回了不安全的 HTTP 下载地址。')
    }
    url.protocol = 'https:'
  }
  if (url.protocol !== 'https:') throw new Error('Red Skill 下载地址必须使用 HTTPS。')
  return url.toString()
}

function normalizeRemoteSlug(value: string): string {
  const slug = value.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9._-]{0,127}$/.test(slug)) throw new Error('SkillHub Skill 标识无效。')
  return slug
}

function mapSkillHubCategory(category: string): string {
  if (category.startsWith('dev-')) return '开发工具'
  if (category === 'design-media') return '设计与前端'
  if (category === 'data-analysis') return '数据与研究'
  if (category === 'content-creation' || category === 'office-efficiency') return '内容与办公'
  if (category === 'security') return '质量与安全'
  return '效率工具'
}

function renameDirectory(from: string, to: string): void {
  // Kept behind one helper so cache replacement remains atomic on a single volume.
  renameSync(from, to)
}

export function inferMarketSourceKind(source: string): MarketSourceKind {
  if (/^https:\/\/redskill\.xiaohongshu\.net\/?$/i.test(source.trim())) return 'redskill'
  if (/^https:\/\/(?:www\.)?modelscope\.cn\/skills\/?$/i.test(source.trim())) return 'modelscope'
  return looksLikeLocalPath(source) ? 'local' : 'git'
}

function readCatalogSkill(directory: string, sourceRoot: string): CatalogSkillRecord {
  const content = readFileSync(join(directory, 'SKILL.md'), 'utf-8')
  const parsed = parseSkillMarkdown(content)
  const name = parsed.frontmatter.name || basename(directory)
  const tags = parseList(parsed.frontmatter.tags || parsed.frontmatter.keywords)
  const category = parsed.frontmatter.category || inferCategory(name, parsed.frontmatter.description, tags)
  const allFiles = listFiles(directory)

  return {
    name,
    description: parsed.frontmatter.description || firstMeaningfulLine(parsed.body) || '暂无描述',
    author: parsed.frontmatter.author || inferAuthor(sourceRoot),
    version: parsed.frontmatter.version,
    category,
    tags: tags.length ? tags : inferTags(name, parsed.frontmatter.description),
    sourcePath: relative(sourceRoot, directory).replaceAll('\\', '/'),
    skillDirectory: directory,
    fileCount: allFiles.length,
    hasScripts: allFiles.some((path) => detectFileKind(path) === 'script')
  }
}

function findSkillDirectories(root: string): string[] {
  if (!existsSync(root)) return []
  const results: string[] = []

  function visit(directory: string, depth: number): void {
    if (depth > 7 || results.length >= 500) return
    if (existsSync(join(directory, 'SKILL.md'))) {
      results.push(directory)
      return
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue
      visit(join(directory, entry.name), depth + 1)
    }
  }

  visit(root, 0)
  return results
}

function findCatalogSkillDirectory(resolved: ResolvedSource, locator: string): string | undefined {
  const searchRoot = resolveWithinSource(resolved.root, resolved.prefix)
  const direct = resolveWithinSource(resolved.root, locator)
  const insideSearchRoot = direct === searchRoot || direct.startsWith(`${searchRoot}${sep}`)
  if (insideSearchRoot && existsSync(join(direct, 'SKILL.md'))) return direct

  const normalized = locator.toLowerCase()
  return findSkillDirectories(searchRoot).find((directory) => {
    if (basename(directory).toLowerCase() === normalized) return true
    const parsed = parseSkillMarkdown(readFileSync(join(directory, 'SKILL.md'), 'utf-8'))
    return (parsed.frontmatter.name || basename(directory)).toLowerCase() === normalized
  })
}

function listFiles(root: string): string[] {
  const files: string[] = []
  function visit(directory: string, depth: number): void {
    if (depth > 6 || files.length >= maxPreviewFiles) return
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (ignoredDirectories.has(entry.name) || entry.name === '.DS_Store') continue
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path, depth + 1)
      else if (entry.isFile()) files.push(path)
    }
  }
  visit(root, 0)
  return files
}

function listPreviewFiles(root: string): MarketPreviewFile[] {
  return listFiles(root).map((path) => {
    const stats = statSync(path)
    const kind = detectFileKind(path)
    const extension = extname(path).toLowerCase()
    const readable = kind !== 'binary' && (kind !== 'image' || extension === '.svg')
    const previewLimit = kind === 'image' ? maxImagePreviewBytes : maxFileBytes
    const truncated = stats.size > previewLimit
    return {
      name: basename(path),
      relativePath: relative(root, path).replaceAll('\\', '/'),
      kind,
      size: stats.size,
      content: readable
        ? readFileSync(path).subarray(0, maxFileBytes).toString('utf-8')
        : null,
      dataUrl: kind === 'image' && !truncated ? fileDataUrl(path) : undefined,
      truncated
    }
  })
}

function parseGitSource(source: string): { url: string; ref?: string; prefix: string } {
  const value = source.trim().replace(/\/$/, '')
  const tree = value.match(/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)$/)
  if (tree) {
    return {
      url: `https://github.com/${tree[1]}/${tree[2].replace(/\.git$/, '')}.git`,
      ref: tree[3],
      prefix: tree[4]
    }
  }
  if (/^[\w.-]+\/[\w.-]+$/.test(value)) {
    return { url: `https://github.com/${value.replace(/\.git$/, '')}.git`, prefix: '' }
  }
  return { url: value, prefix: '' }
}

function resolveWithinSource(root: string, prefix: string): string {
  const resolvedRoot = resolve(root)
  const target = resolve(resolvedRoot, prefix || '.')
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${sep}`)) {
    throw new Error('市场源路径不能超出仓库目录。')
  }
  return target
}

function runGit(args: string[]): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn('git', args, { stdio: ['ignore', 'ignore', 'pipe'] })
    let stderr = ''
    const timeout = setTimeout(() => child.kill(), 90_000)
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()))
    child.on('error', reject)
    child.on('close', (code) => {
      clearTimeout(timeout)
      if (code === 0) resolvePromise()
      else reject(new Error(stderr.trim() || '无法读取 Git 市场源。'))
    })
  })
}

function looksLikeLocalPath(source: string): boolean {
  return source === '~' || source.startsWith('~/') || source.startsWith('./') || isAbsolute(source)
}

function expandPath(path: string): string {
  if (path === '~') return homedir()
  if (path.startsWith('~/')) return join(homedir(), path.slice(2))
  return resolve(path)
}

function parseList(value?: string): string[] {
  if (!value) return []
  return value
    .replace(/^\[|\]$/g, '')
    .split(/[,;]/)
    .map((item) => item.trim().replace(/^['"]|['"]$/g, ''))
    .filter(Boolean)
    .slice(0, 6)
}

function inferAuthor(sourceRoot: string): string {
  const gitConfig = join(sourceRoot, '.git', 'config')
  if (existsSync(gitConfig)) {
    const match = readFileSync(gitConfig, 'utf-8').match(/github\.com[/:]([^/]+)\//)
    if (match) return match[1]
  }
  return '社区贡献者'
}

function firstMeaningfulLine(body: string): string {
  return body
    .split('\n')
    .map((line) => line.replace(/^#+\s*/, '').trim())
    .find((line) => Boolean(line) && !line.startsWith('```')) || ''
}

function inferCategory(name: string, description = '', tags: string[]): string {
  const haystack = `${name} ${description} ${tags.join(' ')}`.toLowerCase()
  if (/design|frontend|ui|ux|image|visual/.test(haystack)) return '设计与前端'
  if (/test|review|debug|security|audit/.test(haystack)) return '质量与安全'
  if (/data|spreadsheet|sql|analysis|research/.test(haystack)) return '数据与研究'
  if (/write|document|content|article|presentation/.test(haystack)) return '内容与办公'
  if (/deploy|git|code|api|backend|develop/.test(haystack)) return '开发工具'
  return '效率工具'
}

function inferTags(name: string, description = ''): string[] {
  const words = `${name} ${description}`
    .toLowerCase()
    .match(/[a-z][a-z0-9+#.-]{2,}/g)
  return [...new Set(words || [])].filter((word) => !['skill', 'skills', 'with', 'from', 'that'].includes(word)).slice(0, 4)
}

function detectFileKind(path: string): MarketPreviewFile['kind'] {
  const extension = extname(path).toLowerCase()
  if (['.md', '.mdx', '.markdown'].includes(extension)) return 'markdown'
  if (['.js', '.jsx', '.ts', '.tsx', '.py', '.sh', '.bash', '.zsh', '.mjs', '.cjs'].includes(extension)) return 'script'
  if (['.json', '.jsonc'].includes(extension)) return 'json'
  if (['.txt', '.csv', '.log', '.yaml', '.yml', '.toml', '.ini', '.env', '.html', '.htm', '.xml', '.css'].includes(extension)) return 'text'
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
