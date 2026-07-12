import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { replaceDirectoryAtomically } from './skill-filesystem.ts'

test('atomically replaces an existing skill directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-skill-files-'))
  const source = join(root, 'source')
  const destination = join(root, 'destination')
  mkdirSync(source)
  mkdirSync(destination)
  writeFileSync(join(source, 'SKILL.md'), 'new')
  writeFileSync(join(destination, 'SKILL.md'), 'old')

  replaceDirectoryAtomically(source, destination)

  assert.equal(readFileSync(join(destination, 'SKILL.md'), 'utf8'), 'new')
})
