import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MarketCatalogCache } from './market-catalog-cache.ts'

const record = {
  name: 'cached-skill',
  description: 'Cached catalog entry',
  author: 'SooKool',
  category: '开发工具',
  tags: ['cache'],
  sourcePath: 'skills/cached-skill',
  skillDirectory: '',
  fileCount: 1,
  hasScripts: false
}

test('persists catalog snapshots across cache instances', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-cache-'))
  try {
    const first = new MarketCatalogCache(root, () => 1_000)
    first.write('git', 'owner/repo', [record])

    const restarted = new MarketCatalogCache(root, () => 1_500)
    const cached = restarted.read('git', 'owner/repo', 1_000)

    assert.deepEqual(cached?.records, [record])
    assert.equal(cached?.isFresh, true)
    assert.equal(cached?.cachedAt, 1_000)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('returns stale snapshots for immediate offline rendering', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-cache-'))
  try {
    new MarketCatalogCache(root, () => 1_000).write('git', 'owner/repo', [record])
    const cached = new MarketCatalogCache(root, () => 5_000).read('git', 'owner/repo', 1_000)

    assert.equal(cached?.isFresh, false)
    assert.deepEqual(cached?.records, [record])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('replaces an existing snapshot without leaving staging files', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-cache-'))
  try {
    const cache = new MarketCatalogCache(root, () => 1_000)
    cache.write('git', 'owner/repo', [record])
    cache.write('git', 'owner/repo', [{ ...record, description: 'Updated' }])

    assert.equal(cache.read('git', 'owner/repo', 1_000)?.records[0].description, 'Updated')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('keeps a parsed snapshot in memory after the first disk read', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-cache-'))
  try {
    new MarketCatalogCache(root, () => 1_000).write('git', 'owner/repo', [record])
    const restarted = new MarketCatalogCache(root, () => 1_500)
    assert.deepEqual(restarted.read('git', 'owner/repo', 1_000)?.records, [record])

    rmSync(root, { recursive: true, force: true })
    assert.deepEqual(restarted.read('git', 'owner/repo', 1_000)?.records, [record])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('persists an asynchronous snapshot without delaying in-memory reads', async () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-market-cache-'))
  try {
    const cache = new MarketCatalogCache(root, () => 2_000)
    const writing = cache.writeAsync('git', 'owner/async-repo', [record])
    assert.deepEqual(cache.read('git', 'owner/async-repo', 1_000)?.records, [record])
    await writing
    assert.deepEqual(new MarketCatalogCache(root, () => 2_500).read('git', 'owner/async-repo', 1_000)?.records, [record])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
