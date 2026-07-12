import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { SettingsStore } from '../settings/settings-store.ts'
import { ProjectDiscoveryManager } from './project-discovery-manager.ts'

const applications = [{
  id: 'codex', name: 'Codex', source: 'builtin' as const, detectionPaths: [],
  systemSkillPaths: [], projectSkillPaths: ['.agents/skills']
}]
const noExternalSources = {
  recentWorkspaces: async (): Promise<string[]> => [],
  indexedProjects: async (): Promise<string[]> => []
}

test('persists discovered projects and serves them without another scan', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'project-discovery-manager-'))
  try {
    const project = join(workspace, 'demo')
    mkdirSync(join(project, '.agents', 'skills', 'review'), { recursive: true })
    writeFileSync(join(project, '.agents', 'skills', 'review', 'SKILL.md'), '---\nname: review\n---\n')
    const settings = new SettingsStore(join(workspace, 'settings.json'))
    const manager = new ProjectDiscoveryManager(settings, noExternalSources)

    await manager.refresh(applications, [], { scanRoots: [workspace] })
    assert.equal(manager.getProjects().some((item) => item.path === project), true)
    assert.equal(new ProjectDiscoveryManager(settings).getProjects().some((item) => item.path === project), true)
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})

test('coalesces concurrent refresh requests', async () => {
  const workspace = mkdtempSync(join(tmpdir(), 'project-discovery-coalesce-'))
  try {
    const settings = new SettingsStore(join(workspace, 'settings.json'))
    const manager = new ProjectDiscoveryManager(settings, noExternalSources)
    const first = manager.refresh(applications, [], { scanRoots: [workspace] })
    const second = manager.refresh(applications, [], { scanRoots: [workspace] })
    assert.equal(first, second)
    await first
  } finally {
    rmSync(workspace, { recursive: true, force: true })
  }
})
