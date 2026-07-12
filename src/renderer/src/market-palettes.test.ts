import assert from 'node:assert/strict'
import test from 'node:test'
import { MARKET_PALETTES, marketPaletteStyle } from './market-palettes.ts'

test('defines six distinct source palettes with six reusable UI colors each', () => {
  assert.deepEqual(Object.keys(MARKET_PALETTES), [
    'memphis', 'macaron', 'rococo', 'mondrian', 'morandi', 'matisse'
  ])
  for (const tones of Object.values(MARKET_PALETTES)) {
    assert.equal(tones.length, 6)
    assert.equal(new Set(tones.map((tone) => tone.color)).size, 6)
  }
})

test('uses historically representative anchor colors and exposes the same values to CSS', () => {
  assert.deepEqual(MARKET_PALETTES.mondrian.slice(0, 4).map((tone) => tone.color), [
    '#D40920', '#1356A2', '#F7D842', '#1B1B1B'
  ])
  assert.deepEqual(MARKET_PALETTES.morandi.slice(0, 3).map((tone) => tone.color), [
    '#A89F91', '#B6A58C', '#8F8A82'
  ])
  const style = marketPaletteStyle('matisse') as Record<string, string>
  assert.equal(style['--palette-color-0'], MARKET_PALETTES.matisse[0].color)
  assert.equal(style['--palette-ink-0'], MARKET_PALETTES.matisse[0].ink)
})
