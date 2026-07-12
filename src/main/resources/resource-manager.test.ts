import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ResourceManager } from './resource-manager.ts'

test('reports non-overlapping cache categories and clears only the requested category', async () => {
  const root = await mkdtemp(join(tmpdir(), 'sookool-resources-'))
  const userDataPath = join(root, 'user-data')
  const logsPath = join(root, 'logs')
  const installedSkill = join(root, 'installed-skills', 'demo', 'SKILL.md')
  await Promise.all([
    mkdir(join(userDataPath, 'market-cache', 'catalogs'), { recursive: true }),
    mkdir(join(userDataPath, 'market-cache', 'modelscope-demo'), { recursive: true }),
    mkdir(join(userDataPath, 'Cache'), { recursive: true }),
    mkdir(logsPath, { recursive: true }),
    mkdir(join(root, 'installed-skills', 'demo'), { recursive: true })
  ])
  await Promise.all([
    writeFile(join(userDataPath, 'market-cache', 'catalogs', 'catalog.json'), 'catalog'),
    writeFile(join(userDataPath, 'market-cache', 'modelscope-demo', 'SKILL.md'), 'preview'),
    writeFile(join(userDataPath, 'Cache', 'data'), 'browser'),
    writeFile(join(logsPath, 'main.log'), 'log'),
    writeFile(installedSkill, 'installed')
  ])

  const manager = new ResourceManager({ userDataPath, logsPath })
  const before = await manager.inspect()
  assert.equal(before.categories.find((item) => item.id === 'market-catalogs')?.files, 1)
  assert.equal(before.categories.find((item) => item.id === 'market-previews')?.files, 1)

  const after = await manager.clear('market-previews')
  assert.equal(after.categories.find((item) => item.id === 'market-previews')?.files, 0)
  assert.equal(after.categories.find((item) => item.id === 'market-catalogs')?.files, 1)
  assert.equal(await readFile(installedSkill, 'utf8'), 'installed')
})
