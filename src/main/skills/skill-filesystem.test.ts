import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { isDirectoryPath, replaceDirectoryAtomically } from './skill-filesystem.ts'

test('does not treat a file containing a directory-link target as a skill directory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-skill-root-'))
  const malformedLink = join(root, 'skills')
  writeFileSync(malformedLink, '../.agents/skills')

  assert.equal(isDirectoryPath(root), true)
  assert.equal(isDirectoryPath(malformedLink), false)
  assert.equal(isDirectoryPath(join(root, 'missing')), false)
})

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
