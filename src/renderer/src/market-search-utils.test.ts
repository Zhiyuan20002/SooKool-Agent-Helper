import assert from 'node:assert/strict'
import test from 'node:test'
import { splitMarketHighlight } from './market-search-utils.ts'

test('highlights every case-insensitive query term while preserving original text', () => {
  assert.deepEqual(splitMarketHighlight('Webapp testing with TEST tools', 'test webapp'), [
    { text: 'Webapp', matched: true },
    { text: ' ', matched: false },
    { text: 'test', matched: true },
    { text: 'ing with ', matched: false },
    { text: 'TEST', matched: true },
    { text: ' tools', matched: false }
  ])
})

test('treats regex punctuation as literal search text', () => {
  assert.deepEqual(splitMarketHighlight('Build with C++ and React', 'C++'), [
    { text: 'Build with ', matched: false },
    { text: 'C++', matched: true },
    { text: ' and React', matched: false }
  ])
})

test('returns one unmarked segment for an empty query', () => {
  assert.deepEqual(splitMarketHighlight('No query', '   '), [{ text: 'No query', matched: false }])
})
