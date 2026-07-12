import { performance } from 'node:perf_hooks'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MarketCatalogCache } from '../src/main/skills/market-catalog-cache.ts'
import { MarketSourceLoader, type CatalogSkillRecord } from '../src/main/skills/market-source-loader.ts'
import { SkillMarketManager, type MarketSkill } from '../src/main/skills/skill-market.ts'
import { createMarketResultCollector } from '../src/renderer/src/market-load-utils.ts'

const catalogSize = Number(process.env.MARKET_BENCH_CATALOG_SIZE || 600)
const sourceCount = Number(process.env.MARKET_BENCH_SOURCE_COUNT || 10)
const repeatRounds = Number(process.env.MARKET_BENCH_REPEAT_ROUNDS || 5)
const previewSkillCount = Number(process.env.MARKET_BENCH_PREVIEW_SKILLS || 400)

function percentile(values: number[], percentileValue: number): number {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * percentileValue))] || 0
}

function elapsed(run: () => void): number {
  const startedAt = performance.now()
  run()
  return performance.now() - startedAt
}

function makeRecords(sourceIndex: number): CatalogSkillRecord[] {
  return Array.from({ length: catalogSize }, (_, index) => ({
    name: `skill-${sourceIndex}-${index}`,
    description: `Synthetic catalog skill ${index} for repeatable performance measurements`,
    author: `author-${index % 25}`,
    category: index % 3 === 0 ? '开发工具' : index % 3 === 1 ? '效率工具' : '质量与安全',
    tags: [`tag-${index % 20}`, 'benchmark'],
    sourcePath: `skills/skill-${sourceIndex}-${index}`,
    skillDirectory: '',
    fileCount: 1,
    hasScripts: false
  }))
}

function runCacheBenchmark(root: string): {
  coldMs: number
  repeatP50Ms: number
  repeatP95Ms: number
  installedScans: number
} {
  let installedScans = 0
  const settings = {
    getMarketSourcePalettes: () => ({}),
    getMarketSources: () => []
  }
  const roots = [{ id: 'root', appIds: ['codex'] }]
  const installedSkills = Array.from({ length: 300 }, (_, index) => ({
    name: `skill-${index % sourceCount}-${index}`,
    rootId: 'root'
  }))
  const skillManager = {
    getSkillRoots: () => roots,
    listSkills: () => {
      installedScans += 1
      return installedSkills
    }
  }
  const manager = new SkillMarketManager(settings as never, skillManager as never, root)
  const sources = manager.listSources().slice(0, sourceCount)
  const diskCache = new MarketCatalogCache(join(root, 'catalogs'))
  sources.forEach((source, index) => diskCache.write(source.kind, source.source, makeRecords(index)))

  const coldMs = elapsed(() => {
    for (const source of sources) manager.listCachedSkills({ sourceId: source.id })
  })
  const rounds: number[] = []
  for (let round = 0; round < repeatRounds; round += 1) {
    rounds.push(elapsed(() => {
      for (const source of sources) manager.listCachedSkills({ sourceId: source.id })
    }))
  }
  return {
    coldMs,
    repeatP50Ms: percentile(rounds, 0.5),
    repeatP95Ms: percentile(rounds, 0.95),
    installedScans
  }
}

async function runPreviewBenchmark(root: string): Promise<{ nameLookupMs: number; pathLookupMs: number | null }> {
  const sourceRoot = join(root, 'preview-source')
  for (let index = 0; index < previewSkillCount; index += 1) {
    const directory = join(sourceRoot, 'skills', `skill-${index}`)
    mkdirSync(directory, { recursive: true })
    writeFileSync(join(directory, 'SKILL.md'), `---\nname: skill-${index}\ndescription: benchmark\n---\n# Skill ${index}\n`)
  }
  const loader = new MarketSourceLoader(join(root, 'preview-cache'))
  const targetName = `skill-${previewSkillCount - 1}`
  const nameStartedAt = performance.now()
  await loader.preview(sourceRoot, 'local', targetName)
  const nameLookupMs = performance.now() - nameStartedAt
  const pathStartedAt = performance.now()
  try {
    await loader.preview(sourceRoot, 'local', `skills/${targetName}`)
    return { nameLookupMs, pathLookupMs: performance.now() - pathStartedAt }
  } catch {
    return { nameLookupMs, pathLookupMs: null }
  }
}

function makeMarketSkill(sourceIndex: number, index: number): MarketSkill {
  return {
    id: `source-${sourceIndex}:skill-${sourceIndex}-${index}`,
    name: `skill-${sourceIndex}-${index}`,
    description: `Synthetic market skill ${index}`,
    author: `author-${index % 25}`,
    category: '开发工具',
    tags: ['benchmark'],
    sourceId: `source-${sourceIndex}`,
    sourceName: `Source ${sourceIndex}`,
    source: `source-${sourceIndex}`,
    installSource: `source-${sourceIndex}`,
    installed: false,
    installedOn: [],
    compatibleAgents: [],
    origin: 'source'
  }
}

function runProgressiveAggregationBenchmark(): { elapsedMs: number; visitedItems: number; publishes: number } {
  const batches = Array.from({ length: sourceCount }, (_, sourceIndex) =>
    Array.from({ length: catalogSize }, (_, index) => makeMarketSkill(sourceIndex, index))
  )
  let current: MarketSkill[] = []
  let visitedItems = 0
  let publishes = 0
  const startedAt = performance.now()
  for (const batch of batches) {
    const seen = new Set<string>()
    current = [...current, ...batch].filter((skill) => {
      visitedItems += 1
      const key = `${skill.installSource}:${skill.name.toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    publishes += 1
  }
  return { elapsedMs: performance.now() - startedAt, visitedItems, publishes }
}

function runCurrentAggregationBenchmark(): { elapsedMs: number; visitedItems: number; publishes: number } {
  const batches = Array.from({ length: sourceCount }, (_, sourceIndex) =>
    Array.from({ length: catalogSize }, (_, index) => makeMarketSkill(sourceIndex, index))
  )
  let visitedItems = 0
  let publishes = 0
  const scheduled: Array<() => void> = []
  const collector = createMarketResultCollector(
    (skill: MarketSkill) => {
      visitedItems += 1
      return `${skill.installSource}:${skill.name.toLowerCase()}`
    },
    () => { publishes += 1 },
    (flush) => scheduled.push(flush)
  )
  const startedAt = performance.now()
  for (const batch of batches) collector.add(batch)
  scheduled[0]?.()
  return { elapsedMs: performance.now() - startedAt, visitedItems, publishes }
}

async function main(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-benchmark-'))
  try {
    const result = {
      fixture: { catalogSize, sourceCount, repeatRounds, previewSkillCount },
      cache: runCacheBenchmark(root),
      preview: await runPreviewBenchmark(root),
      legacyProgressiveAggregation: runProgressiveAggregationBenchmark(),
      currentProgressiveAggregation: runCurrentAggregationBenchmark()
    }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

void main()
