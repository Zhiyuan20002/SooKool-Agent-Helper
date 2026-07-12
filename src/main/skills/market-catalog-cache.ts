import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { CatalogSkillRecord, MarketSourceKind } from './market-source-loader'

interface PersistedCatalogSnapshot {
  version: 1
  kind: MarketSourceKind
  source: string
  cachedAt: number
  records: CatalogSkillRecord[]
}

export interface CatalogCacheRead {
  records: CatalogSkillRecord[]
  cachedAt: number
  isFresh: boolean
}

export class MarketCatalogCache {
  private root: string
  private now: () => number
  private memory = new Map<string, PersistedCatalogSnapshot>()
  private pendingWrites = new Map<string, Promise<void>>()
  private readonly memoryLimit = 24

  constructor(
    root: string,
    now: () => number = Date.now
  ) {
    this.root = root
    this.now = now
  }

  read(kind: MarketSourceKind, source: string, maxAgeMs: number): CatalogCacheRead | null {
    const path = this.snapshotPath(kind, source)
    const memory = this.memory.get(path)
    if (memory) {
      this.remember(path, memory)
      return this.toCacheRead(memory, maxAgeMs)
    }
    if (!existsSync(path)) return null
    try {
      const snapshot = JSON.parse(readFileSync(path, 'utf-8')) as PersistedCatalogSnapshot
      if (
        snapshot.version !== 1 ||
        snapshot.kind !== kind ||
        snapshot.source !== source.trim() ||
        !Number.isFinite(snapshot.cachedAt) ||
        !Array.isArray(snapshot.records)
      ) return null
      this.remember(path, snapshot)
      return this.toCacheRead(snapshot, maxAgeMs)
    } catch {
      return null
    }
  }

  write(kind: MarketSourceKind, source: string, records: CatalogSkillRecord[]): void {
    mkdirSync(this.root, { recursive: true })
    const path = this.snapshotPath(kind, source)
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
    const staging = `${path}.${suffix}.staging`
    const backup = `${path}.${suffix}.backup`
    const snapshot: PersistedCatalogSnapshot = {
      version: 1,
      kind,
      source: source.trim(),
      cachedAt: this.now(),
      records
    }
    try {
      writeFileSync(staging, JSON.stringify(snapshot))
      if (existsSync(path)) renameSync(path, backup)
      renameSync(staging, path)
      rmSync(backup, { force: true })
      this.remember(path, snapshot)
    } catch (error) {
      if (!existsSync(path) && existsSync(backup)) renameSync(backup, path)
      throw error
    } finally {
      rmSync(staging, { force: true })
      rmSync(backup, { force: true })
    }
  }

  async writeAsync(kind: MarketSourceKind, source: string, records: CatalogSkillRecord[]): Promise<void> {
    const path = this.snapshotPath(kind, source)
    const snapshot: PersistedCatalogSnapshot = {
      version: 1,
      kind,
      source: source.trim(),
      cachedAt: this.now(),
      records
    }
    this.remember(path, snapshot)
    const previous = this.pendingWrites.get(path) || Promise.resolve()
    const current = previous.catch(() => undefined).then(async () => {
      const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
      const staging = `${path}.${suffix}.staging`
      const backup = `${path}.${suffix}.backup`
      await mkdir(this.root, { recursive: true })
      try {
        await writeFile(staging, JSON.stringify(snapshot))
        if (existsSync(path)) await rename(path, backup)
        await rename(staging, path)
        await rm(backup, { force: true })
      } catch (error) {
        if (!existsSync(path) && existsSync(backup)) await rename(backup, path)
        throw error
      } finally {
        await rm(staging, { force: true })
        await rm(backup, { force: true })
      }
    })
    this.pendingWrites.set(path, current)
    try {
      await current
    } finally {
      if (this.pendingWrites.get(path) === current) this.pendingWrites.delete(path)
    }
  }

  private toCacheRead(snapshot: PersistedCatalogSnapshot, maxAgeMs: number): CatalogCacheRead {
    return {
      records: snapshot.records,
      cachedAt: snapshot.cachedAt,
      isFresh: this.now() - snapshot.cachedAt < maxAgeMs
    }
  }

  private remember(path: string, snapshot: PersistedCatalogSnapshot): void {
    this.memory.delete(path)
    this.memory.set(path, snapshot)
    while (this.memory.size > this.memoryLimit) {
      this.memory.delete(this.memory.keys().next().value as string)
    }
  }

  private snapshotPath(kind: MarketSourceKind, source: string): string {
    const key = createHash('sha256').update(`${kind}:${source.trim()}`).digest('hex').slice(0, 24)
    return join(this.root, `${key}.json`)
  }
}
