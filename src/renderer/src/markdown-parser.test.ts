import assert from 'node:assert/strict'
import test from 'node:test'
import { parseMarkdownBlocks } from './markdown-parser.ts'

test('parses GFM tables with column alignment', () => {
  const blocks = parseMarkdownBlocks('| Task | Approach |\n|:---|---:|\n| Read | `pandoc` |')
  assert.deepEqual(blocks, [{
    type: 'table', headers: ['Task', 'Approach'], alignments: ['left', 'right'],
    rows: [['Read', '`pandoc`']]
  }])
})

test('parses common horizontal rule forms instead of paragraphs', () => {
  const blocks = parseMarkdownBlocks('Before\n\n---\n\n* * *\n\n___\n\nAfter')
  assert.deepEqual(blocks.map((block) => block.type), ['paragraph', 'rule', 'rule', 'rule', 'paragraph'])
})
