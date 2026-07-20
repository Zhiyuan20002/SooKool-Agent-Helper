import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { recoverLiveSwitchTransactions, switchLiveConfig, updateCcSwitchCurrentSetting, type RoutingLivePaths } from './live-config-switcher.ts'

function paths(root: string): RoutingLivePaths {
  return {
    claudeSettingsPath: join(root, '.claude', 'settings.json'),
    codexAuthPath: join(root, '.codex', 'auth.json'),
    codexConfigPath: join(root, '.codex', 'config.toml'),
    geminiEnvPath: join(root, '.gemini', '.env'),
    geminiSettingsPath: join(root, '.gemini', 'settings.json'),
    backupDir: join(root, 'backups')
  }
}

test('writes Claude provider settings and strips internal fields', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const livePaths = paths(root)
  mkdirSync(join(root, '.claude'))
  writeFileSync(livePaths.claudeSettingsPath, JSON.stringify({ hooks: { keep: true }, env: { KEEP: 'yes', ANTHROPIC_BASE_URL: 'old' } }))
  switchLiveConfig('claude', { env: { ANTHROPIC_AUTH_TOKEN: 'secret' }, meta: { private: true } }, livePaths)
  const value = JSON.parse(readFileSync(livePaths.claudeSettingsPath, 'utf8'))
  assert.equal(value.env.ANTHROPIC_AUTH_TOKEN, 'secret')
  assert.equal(value.env.KEEP, 'yes')
  assert.equal(value.env.ANTHROPIC_BASE_URL, undefined)
  assert.deepEqual(value.hooks, { keep: true })
  assert.equal(value.meta, undefined)
})

test('writes Codex auth and TOML as one switch operation', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const livePaths = paths(root)
  mkdirSync(join(root, '.codex'))
  writeFileSync(livePaths.codexAuthPath, JSON.stringify({ tokens: { access_token: 'login' } }))
  writeFileSync(livePaths.codexConfigPath, 'approval_policy = "on-request"\n[mcp_servers.local]\ncommand = "tool"\n')
  switchLiveConfig('codex', {
    auth: { OPENAI_API_KEY: 'key' },
    config: 'model_provider = "sookool"\nmodel = "gpt-5"\n\n[model_providers.sookool]\nname = "SooKool"\nbase_url = "https://example.com"\nwire_api = "responses"'
  }, livePaths)
  assert.deepEqual(JSON.parse(readFileSync(livePaths.codexAuthPath, 'utf8')), {
    tokens: { access_token: 'login' }, OPENAI_API_KEY: 'key'
  })
  assert.equal(readFileSync(livePaths.codexConfigPath, 'utf8'), 'approval_policy = "on-request"\n[mcp_servers.local]\ncommand = "tool"\n\nmodel_provider = "sookool"\nmodel = "gpt-5"\n\n[model_providers.sookool]\nname = "SooKool"\nbase_url = "https://example.com"\nwire_api = "responses"\n')
})

test('merges Gemini settings while replacing provider environment', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const livePaths = paths(root)
  mkdirSync(join(root, '.gemini'))
  writeFileSync(livePaths.geminiSettingsPath, JSON.stringify({ mcpServers: { local: {} }, theme: 'old' }))
  writeFileSync(livePaths.geminiEnvPath, '# keep this\nexport KEEP="quoted value"\nGEMINI_API_KEY=old\n')
  switchLiveConfig('gemini', { env: { GEMINI_API_KEY: 'key' }, config: { theme: 'new' } }, livePaths)
  assert.equal(readFileSync(livePaths.geminiEnvPath, 'utf8'), '# keep this\nexport KEEP="quoted value"\nGEMINI_API_KEY=key\n')
  assert.deepEqual(JSON.parse(readFileSync(livePaths.geminiSettingsPath, 'utf8')), {
    mcpServers: { local: {} }, theme: 'new'
  })
})

test('rejects multiline environment values without modifying Gemini files', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const livePaths = paths(root)
  mkdirSync(join(root, '.gemini'))
  writeFileSync(livePaths.geminiEnvPath, 'KEEP=yes\n')
  assert.throws(() => switchLiveConfig('gemini', { env: { GEMINI_API_KEY: 'key\nINJECTED=yes' } }, livePaths), /换行符/)
  assert.equal(readFileSync(livePaths.geminiEnvPath, 'utf8'), 'KEEP=yes\n')
})

test('updates and can roll back the CC-Switch device current provider', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const settingsPath = join(root, 'settings.json')
  writeFileSync(settingsPath, JSON.stringify({ current_provider_claude: 'old', theme: 'dark' }))
  const rollback = updateCcSwitchCurrentSetting(settingsPath, 'claude', 'next')
  assert.deepEqual(JSON.parse(readFileSync(settingsPath, 'utf8')), {
    current_provider_claude: 'next', theme: 'dark'
  })
  rollback()
  assert.equal(JSON.parse(readFileSync(settingsPath, 'utf8')).current_provider_claude, 'old')
})

test('recovers an interrupted switch according to its durable transaction phase', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-live-'))
  const livePaths = paths(root)
  mkdirSync(join(root, '.claude'))
  writeFileSync(livePaths.claudeSettingsPath, JSON.stringify({ old: true }))
  switchLiveConfig('claude', { next: true }, livePaths, {
    appType: 'claude', providerKey: 'sookool:provider:next', providerId: 'next', source: 'sookool'
  })
  recoverLiveSwitchTransactions(livePaths, () => assert.fail('state must not commit'))
  assert.deepEqual(JSON.parse(readFileSync(livePaths.claudeSettingsPath, 'utf8')), { old: true })

  const transaction = switchLiveConfig('claude', { next: true }, livePaths, {
    appType: 'claude', providerKey: 'sookool:provider:next', providerId: 'next', source: 'sookool'
  })
  transaction.beginStateCommit()
  let finalized = false
  recoverLiveSwitchTransactions(livePaths, (target) => { finalized = target.providerId === 'next' })
  assert.equal(finalized, true)
  assert.equal(JSON.parse(readFileSync(livePaths.claudeSettingsPath, 'utf8')).next, true)
})
