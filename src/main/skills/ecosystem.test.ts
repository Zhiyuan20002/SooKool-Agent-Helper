import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createSkillsCommandLaunchSpec,
  listBuiltinApplicationRules,
  listSkillAgentAdapters
} from './ecosystem.ts'

test('runs the packaged skills CLI through Electron node mode instead of opening another app', () => {
  const environment = { PATH: '/usr/bin', ELECTRON_RUN_AS_NODE: '0' }
  const launch = createSkillsCommandLaunchSpec(
    { command: 'find', query: 'browser automation', owner: 'openai' },
    '/Applications/SooKool.app/Contents/Resources/app.asar/node_modules/skills/bin/cli.mjs',
    '/Applications/SooKool.app/Contents/MacOS/SooKool Agent',
    environment
  )

  assert.equal(launch.executable, '/Applications/SooKool.app/Contents/MacOS/SooKool Agent')
  assert.deepEqual(launch.args, [
    '/Applications/SooKool.app/Contents/Resources/app.asar/node_modules/skills/bin/cli.mjs',
    'find',
    'browser automation',
    '--owner',
    'openai'
  ])
  assert.equal(launch.env.ELECTRON_RUN_AS_NODE, '1')
  assert.equal(launch.env.DISABLE_TELEMETRY, '1')
  assert.equal(environment.ELECTRON_RUN_AS_NODE, '0')
})

test('detects DeepSeek Harness and exposes its native and shared skill roots', () => {
  const project = mkdtempSync(join(tmpdir(), 'sookool-dsh-'))
  try {
    mkdirSync(join(project, '.dsh', 'skills'), { recursive: true })

    const adapter = listSkillAgentAdapters(project).find((entry) => entry.id === 'deepseek-harness')
    assert.ok(adapter)
    assert.equal(adapter.name, 'DeepSeek Harness')
    assert.equal(adapter.installed, true)
    assert.equal(adapter.projectPath, '.dsh/skills')
    assert.match(adapter.globalPath ?? '', /[/\\]\.dsh[/\\]skills$/)

    const rule = listBuiltinApplicationRules(
      [{ id: 'project', name: 'Project', path: project }],
      project
    ).find((entry) => entry.id === 'deepseek-harness')
    assert.ok(rule)
    assert.deepEqual(rule.projectSkillPaths, ['.dsh/skills', '.agents/skills'])
    assert.equal(rule.systemSkillPaths.length, 2)
    assert.match(rule.systemSkillPaths[0], /[/\\]\.dsh[/\\]skills$/)
    assert.match(rule.systemSkillPaths[1], /[/\\]\.agents[/\\]skills$/)
  } finally {
    rmSync(project, { recursive: true, force: true })
  }
})
