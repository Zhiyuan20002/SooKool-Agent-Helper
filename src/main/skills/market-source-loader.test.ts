import assert from 'node:assert/strict'
import test from 'node:test'
import { mergeCatalogRecords } from './market-catalog-utils.ts'

function record(sourcePath: string, name = sourcePath) {
  return {
    name,
    description: '',
    author: '',
    category: '',
    tags: [],
    sourcePath,
    skillDirectory: '',
    hasScripts: false
  }
}

test('merges Red Skill default keyword results by stable identifier', () => {
  const merged = mergeCatalogRecords([
    record('skill-creator-pro', 'English result'),
    record('other-skill'),
    record('SKILL-CREATOR-PRO', 'Chinese duplicate'),
    record('chinese-only')
  ])

  assert.deepEqual(merged.map((item) => item.name), [
    'English result',
    'other-skill',
    'chinese-only'
  ])
})
