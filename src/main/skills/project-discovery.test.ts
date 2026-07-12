import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { discoverProjects } from './project-discovery.ts'

test('discovers a project root from an existing configured project Skill directory', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'skill-project-discovery-'))
  try {
    const project = join(workspace, 'demo')
    mkdirSync(join(project, '.agents', 'skills', 'review'), { recursive: true })
    writeFileSync(join(project, '.agents', 'skills', 'review', 'SKILL.md'), '---\nname: review\n---\n')

    const snapshot = await discoverProjects([
      { id: 'codex', name: 'Codex', source: 'builtin', detectionPaths: [], systemSkillPaths: [], projectSkillPaths: ['.agents/skills'] }
    ], [], { scanRoots: [workspace] })

    assert.deepEqual(snapshot.projects.map(({ name, path, source }) => ({ name, path, source })), [
      { name: 'demo', path: project, source: 'auto' }
    ])
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('uses an independent directory budget for every scan root', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'skill-project-discovery-budget-'))
  try {
    const first = join(workspace, 'first')
    const second = join(workspace, 'second')
    mkdirSync(join(first, 'noise-a'), { recursive: true })
    mkdirSync(join(first, 'noise-b'), { recursive: true })
    mkdirSync(join(second, 'project', '.agents', 'skills', 'review'), { recursive: true })
    writeFileSync(join(second, 'project', '.agents', 'skills', 'review', 'SKILL.md'), '---\nname: review\n---\n')

    const snapshot = await discoverProjects([
      { id: 'codex', name: 'Codex', source: 'builtin', detectionPaths: [], systemSkillPaths: [], projectSkillPaths: ['.agents/skills'] }
    ], [], { scanRoots: [first, second], maxDirectoriesPerRoot: 2 })

    assert.equal(snapshot.projects.some((project) => project.path === join(second, 'project')), true)
    assert.equal(snapshot.truncatedRoots.includes(first), true)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('keeps a manual project even when it currently has no Skill evidence', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'skill-project-discovery-manual-'))
  try {
    const snapshot = await discoverProjects([], [
      { id: 'manual', name: 'Manual', path: workspace, source: 'manual' }
    ], { scanRoots: [] })
    assert.equal(snapshot.projects[0]?.id, 'manual')
    assert.equal(snapshot.records[0]?.sources.includes('manual'), true)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('discovers nested projects without traversing into Skill Space contents', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'skill-project-discovery-nested-'))
  try {
    const parent = join(workspace, 'monorepo')
    const child = join(parent, 'apps', 'web')
    for (const project of [parent, child]) {
      mkdirSync(join(project, '.agents', 'skills', 'review'), { recursive: true })
      writeFileSync(join(project, '.agents', 'skills', 'review', 'SKILL.md'), '---\nname: review\n---\n')
    }

    const snapshot = await discoverProjects([
      { id: 'codex', name: 'Codex', source: 'builtin', detectionPaths: [], systemSkillPaths: [], projectSkillPaths: ['.agents/skills'] }
    ], [], { scanRoots: [workspace] })

    assert.deepEqual(snapshot.projects.map((project) => project.path), [child, parent].sort())
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('returns a cancelled snapshot without completing a directory scan', async () => {
  const controller = new AbortController()
  controller.abort()

  const snapshot = await discoverProjects([], [], { scanRoots: ['/'], signal: controller.signal })

  assert.equal(snapshot.cancelled, true)
  assert.equal(snapshot.scannedDirectories, 0)
})

test('keeps cached projects active until three consecutive evidence misses', async () => {
  const path = '/offline/project'
  const cached = [{
    id: 'cached', name: 'Project', path, sources: ['cache' as const], evidencePaths: [],
    firstDiscoveredAt: '2026-01-01T00:00:00.000Z', lastConfirmedAt: '2026-01-01T00:00:00.000Z',
    status: 'active' as const, missCount: 1
  }]

  const secondMiss = await discoverProjects([
    { id: 'codex', name: 'Codex', source: 'builtin', detectionPaths: [], systemSkillPaths: [], projectSkillPaths: ['.agents/skills'] }
  ], [], { scanRoots: [], cachedRecords: cached })
  const thirdMiss = await discoverProjects([
    { id: 'codex', name: 'Codex', source: 'builtin', detectionPaths: [], systemSkillPaths: [], projectSkillPaths: ['.agents/skills'] }
  ], [], { scanRoots: [], cachedRecords: secondMiss.records })

  assert.equal(secondMiss.projects.some((project) => project.path === path), true)
  assert.equal(thirdMiss.projects.some((project) => project.path === path), false)
})

test('does not restore an ignored cached project', async () => {
  const path = '/ignored/project'
  const snapshot = await discoverProjects([], [], {
    scanRoots: [],
    ignoredPaths: [path],
    cachedRecords: [{
      id: 'cached', name: 'Project', path, sources: ['cache'], evidencePaths: [],
      firstDiscoveredAt: '2026-01-01T00:00:00.000Z', lastConfirmedAt: '2026-01-01T00:00:00.000Z', status: 'active'
    }]
  })
  assert.equal(snapshot.projects.length, 0)
})
