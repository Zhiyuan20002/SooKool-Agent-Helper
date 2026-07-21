import assert from 'node:assert/strict'
import test from 'node:test'
import { createSkillsCommandLaunchSpec } from './ecosystem.ts'

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
