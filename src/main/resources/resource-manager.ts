import { existsSync } from 'node:fs'
import { lstat, mkdir, readdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'

export type ResourceCleanupId = 'market-catalogs' | 'market-previews' | 'browser-cache' | 'logs'

export interface DiskUsageCategory {
  id: ResourceCleanupId
  bytes: number
  files: number
  directories: number
  path: string
}

export interface DiskUsageSnapshot {
  totalBytes: number
  categories: DiskUsageCategory[]
  scannedAt: string
}

interface ResourceManagerOptions {
  userDataPath: string
  logsPath: string
  clearBrowserCache?: () => Promise<void>
}

interface UsageCount {
  bytes: number
  files: number
  directories: number
}

const emptyUsage = (): UsageCount => ({ bytes: 0, files: 0, directories: 0 })

export class ResourceManager {
  private readonly options: ResourceManagerOptions

  constructor(options: ResourceManagerOptions) {
    this.options = options
  }

  async inspect(): Promise<DiskUsageSnapshot> {
    const marketRoot = join(this.options.userDataPath, 'market-cache')
    const categories = await Promise.all([
      this.category('market-catalogs', join(marketRoot, 'catalogs')),
      this.marketPreviewCategory(marketRoot),
      this.combinedCategory('browser-cache', [
        join(this.options.userDataPath, 'Cache'),
        join(this.options.userDataPath, 'Code Cache'),
        join(this.options.userDataPath, 'GPUCache')
      ]),
      this.category('logs', this.options.logsPath)
    ])
    return {
      totalBytes: categories.reduce((sum, category) => sum + category.bytes, 0),
      categories,
      scannedAt: new Date().toISOString()
    }
  }

  async clear(id: ResourceCleanupId | 'all'): Promise<DiskUsageSnapshot> {
    const targets: ResourceCleanupId[] = id === 'all'
      ? ['market-catalogs', 'market-previews', 'browser-cache', 'logs']
      : [id]
    for (const target of targets) await this.clearTarget(target)
    return this.inspect()
  }

  private async clearTarget(id: ResourceCleanupId): Promise<void> {
    const marketRoot = join(this.options.userDataPath, 'market-cache')
    if (id === 'market-catalogs') {
      await removeAndRecreate(join(marketRoot, 'catalogs'))
      return
    }
    if (id === 'market-previews') {
      await removeChildrenExcept(marketRoot, new Set(['catalogs']))
      return
    }
    if (id === 'browser-cache') {
      await this.options.clearBrowserCache?.()
      await Promise.allSettled([
        removeAndRecreate(join(this.options.userDataPath, 'Cache')),
        removeAndRecreate(join(this.options.userDataPath, 'Code Cache')),
        removeAndRecreate(join(this.options.userDataPath, 'GPUCache'))
      ])
      return
    }
    await removeAndRecreate(this.options.logsPath)
  }

  private async category(id: ResourceCleanupId, path: string): Promise<DiskUsageCategory> {
    return { id, path, ...(await inspectPath(path)) }
  }

  private async combinedCategory(id: ResourceCleanupId, paths: string[]): Promise<DiskUsageCategory> {
    const usages = await Promise.all(paths.map(inspectPath))
    return {
      id,
      path: paths.join(' · '),
      bytes: usages.reduce((sum, item) => sum + item.bytes, 0),
      files: usages.reduce((sum, item) => sum + item.files, 0),
      directories: usages.reduce((sum, item) => sum + item.directories, 0)
    }
  }

  private async marketPreviewCategory(marketRoot: string): Promise<DiskUsageCategory> {
    if (!existsSync(marketRoot)) return { id: 'market-previews', path: marketRoot, ...emptyUsage() }
    const entries = await readdir(marketRoot, { withFileTypes: true })
    const usages = await Promise.all(entries
      .filter((entry) => entry.name !== 'catalogs')
      .map((entry) => inspectPath(join(marketRoot, entry.name))))
    return {
      id: 'market-previews',
      path: marketRoot,
      bytes: usages.reduce((sum, item) => sum + item.bytes, 0),
      files: usages.reduce((sum, item) => sum + item.files, 0),
      directories: usages.reduce((sum, item) => sum + item.directories, 0)
    }
  }
}

async function inspectPath(root: string): Promise<UsageCount> {
  if (!existsSync(root)) return emptyUsage()
  const result = emptyUsage()
  const pending = [root]
  let visited = 0
  while (pending.length && visited < 100_000) {
    const current = pending.pop() as string
    visited += 1
    let stat
    try {
      stat = await lstat(current)
    } catch {
      continue
    }
    if (stat.isSymbolicLink()) continue
    if (!stat.isDirectory()) {
      result.files += 1
      result.bytes += stat.size
      continue
    }
    result.directories += 1
    let entries
    try {
      entries = await readdir(current)
    } catch {
      continue
    }
    entries.forEach((entry) => pending.push(join(current, entry)))
  }
  return result
}

async function removeChildrenExcept(root: string, excluded: Set<string>): Promise<void> {
  if (!existsSync(root)) return
  const entries = await readdir(root)
  await Promise.all(entries
    .filter((entry) => !excluded.has(basename(entry)))
    .map((entry) => rm(join(root, entry), { recursive: true, force: true })))
}

async function removeAndRecreate(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
  await mkdir(path, { recursive: true })
}
