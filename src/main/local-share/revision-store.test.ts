import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RevisionStore } from './revision-store.ts'

test('capturing and restoring a revision keeps immutable history and deduplicates payloads', () => {
  const root = mkdtempSync(join(tmpdir(), 'sookool-local-share-store-'))
  const skill = join(root, 'skill')
  mkdirSync(skill)
  writeFileSync(join(skill, 'SKILL.md'), '---\nname: demo\ndescription: Demo\n---\n')
  const store = new RevisionStore(join(root, 'repository'))

  const first = store.capture(skill, {
    direction: 'received',
    status: 'completed',
    deviceId: 'peer',
    deviceAlias: 'Peer'
  })
  const second = store.capture(skill, {
    direction: 'applied',
    status: 'completed',
    deviceId: 'peer',
    deviceAlias: 'Peer'
  })
  assert.equal(first.contentHash, second.contentHash)
  assert.equal(first.objectPath, second.objectPath)
  assert.equal(store.listHistory().length, 2)
  assert.ok(existsSync(first.objectPath))

  const restored = join(root, 'restored')
  store.restore(first.id, restored)
  assert.match(readFileSync(join(restored, 'SKILL.md'), 'utf8'), /name: demo/)
})
