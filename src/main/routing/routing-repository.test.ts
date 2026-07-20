import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { RoutingRepository } from './routing-repository.ts'

function createCcSwitchDatabase(path: string): void {
  const db = new DatabaseSync(path)
  db.exec(`
    CREATE TABLE providers (
      id TEXT NOT NULL,
      app_type TEXT NOT NULL,
      name TEXT NOT NULL,
      settings_config TEXT NOT NULL,
      website_url TEXT,
      category TEXT,
      created_at INTEGER,
      sort_index INTEGER,
      notes TEXT,
      icon TEXT,
      icon_color TEXT,
      meta TEXT NOT NULL DEFAULT '{}',
      is_current BOOLEAN NOT NULL DEFAULT 0,
      in_failover_queue BOOLEAN NOT NULL DEFAULT 0,
      PRIMARY KEY (id, app_type)
    )
  `)
  db.prepare(`
    INSERT INTO providers (
      id, app_type, name, settings_config, category, created_at, meta, is_current
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cc-provider',
    'claude',
    'CC Provider',
    JSON.stringify({ env: { ANTHROPIC_AUTH_TOKEN: 'cc-secret', ANTHROPIC_BASE_URL: 'https://cc.example' } }),
    'third_party',
    1,
    '{}',
    1
  )
  db.close()
}

test('lists CC-Switch and local providers without exposing credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'routing-providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  writeFileSync(localStorePath, JSON.stringify({
    schemaVersion: 1,
    providers: [{
      id: 'local-provider',
      appType: 'codex',
      name: 'Local Provider',
      settingsConfig: { auth: { OPENAI_API_KEY: 'local-secret' }, config: 'model = "gpt-5"' },
      createdAt: 2,
      updatedAt: 2
    }]
  }))

  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })
  const snapshot = repository.getSnapshot()

  assert.deepEqual(snapshot.providers.map(({ id, source }) => [id, source]), [
    ['cc-provider', 'cc-switch'],
    ['local-provider', 'sookool']
  ])
  assert.equal(snapshot.providers[0].isCurrent, true)
  assert.equal(snapshot.providers[0].baseUrl, 'https://cc.example')
  assert.equal(snapshot.providers[0].hasSecret, true)
  assert.equal(JSON.stringify(snapshot).includes('cc-secret'), false)
  assert.equal(JSON.stringify(snapshot).includes('local-secret'), false)
})

test('groups matching CC-Switch app records into one provider', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare(`
    INSERT INTO providers (id, app_type, name, settings_config, meta, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'codex-provider',
    'codex',
    'CC Provider',
    JSON.stringify({ auth: { OPENAI_API_KEY: 'codex-secret' }, config: 'model = "gpt-5"' }),
    '{}',
    0
  )
  database.close()

  const repository = new RoutingRepository({
    ccSwitchDbPath,
    localStorePath: join(root, 'providers.json')
  })
  const snapshot = repository.getSnapshot()

  assert.equal(snapshot.providers.length, 1)
  assert.deepEqual(
    snapshot.providers[0].applications.map((application) => application.appType),
    ['claude', 'codex']
  )
  assert.equal(snapshot.apps.find((app) => app.id === 'claude')?.providerCount, 1)
  assert.equal(snapshot.apps.find((app) => app.id === 'codex')?.providerCount, 1)
})

test('marks CC-Switch adapters that require its local protocol proxy as non-activatable', async () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare('UPDATE providers SET meta = ? WHERE id = ?')
    .run(JSON.stringify({ apiFormat: 'openai_chat' }), 'cc-provider')
  database.close()
  const repository = new RoutingRepository({
    ccSwitchDbPath,
    localStorePath: join(root, 'providers.json'),
    livePaths: {
      claudeSettingsPath: join(root, '.claude', 'settings.json'),
      codexAuthPath: join(root, '.codex', 'auth.json'),
      codexConfigPath: join(root, '.codex', 'config.toml'),
      geminiEnvPath: join(root, '.gemini', '.env'),
      geminiSettingsPath: join(root, '.gemini', 'settings.json'),
      backupDir: join(root, 'backups', 'live')
    }
  })
  const provider = repository.getSnapshot().providers[0]
  assert.equal(provider.applications[0].requiresProxy, true)
  await assert.rejects(
    repository.activateProvider({ key: provider.key, appType: 'claude' }),
    /依赖本地协议转换/
  )
  const copied = repository.saveProvider({
    key: provider.key,
    name: 'Copied Proxy Provider',
    applications: ['claude']
  })
  assert.equal(copied.applications[0].requiresProxy, true)
  await assert.rejects(
    repository.activateProvider({ key: copied.key, appType: 'claude' }),
    /依赖本地协议转换/
  )
})

test('editing a unified CC-Switch provider copies all application adapters locally', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare(`
    INSERT INTO providers (id, app_type, name, settings_config, meta, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'codex-provider',
    'codex',
    'CC Provider',
    JSON.stringify({ auth: { OPENAI_API_KEY: 'codex-secret' }, config: 'model = "gpt-5"' }),
    '{}',
    0
  )
  database.close()
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })
  const unified = repository.getSnapshot().providers[0]

  const saved = repository.saveProvider({
    key: unified.key,
    name: 'Managed Provider',
    baseUrl: 'https://managed.example'
  })

  assert.equal(saved.source, 'sookool')
  assert.deepEqual(saved.applications.map((application) => application.appType), ['claude', 'codex'])
  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{ appType: string; settingsConfig: Record<string, unknown> }>
  }
  assert.deepEqual(localStore.providers.map((provider) => provider.appType), ['claude', 'codex'])
  assert.equal(JSON.stringify(localStore).includes('cc-secret'), true)
  assert.equal(JSON.stringify(localStore).includes('codex-secret'), true)
})

test('editing a CC-Switch provider creates a SooKool-owned copy', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'routing-providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })

  const saved = repository.saveProvider({
    key: 'cc-switch:claude:cc-provider',
    appType: 'claude',
    name: 'Edited Provider',
    baseUrl: 'https://edited.example',
    apiKey: 'edited-secret',
    model: 'claude-sonnet'
  })

  assert.equal(saved.source, 'sookool')
  assert.equal(saved.name, 'Edited Provider')
  assert.equal(saved.baseUrl, 'https://edited.example')
  const snapshot = repository.getSnapshot()
  assert.equal(snapshot.providers.length, 2)
  assert.equal(snapshot.providers.find((provider) => provider.source === 'cc-switch')?.name, 'CC Provider')
  assert.equal(snapshot.providers.find((provider) => provider.source === 'sookool')?.name, 'Edited Provider')

  const ccDatabase = new DatabaseSync(ccSwitchDbPath, { readOnly: true })
  const original = ccDatabase.prepare(
    'SELECT name, settings_config FROM providers WHERE id = ? AND app_type = ?'
  ).get('cc-provider', 'claude') as { name: string; settings_config: string }
  ccDatabase.close()
  assert.equal(original.name, 'CC Provider')
  assert.equal(original.settings_config.includes('cc-secret'), true)
})

test('deletes a non-current CC-Switch provider from the upstream database after backup', async () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'routing-providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare(`
    INSERT INTO providers (id, app_type, name, settings_config, meta, is_current)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run('removable', 'claude', 'Removable', '{}', '{}', 0)
  database.close()
  const ccSwitchBackupDir = join(root, 'backups')
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath, ccSwitchBackupDir })

  await repository.deleteProvider({ key: 'cc-switch:claude:removable' })

  assert.equal(repository.getSnapshot().providers.some((provider) => provider.id === 'removable'), false)
  assert.equal(readdirSync(ccSwitchBackupDir).length, 1)
  await assert.rejects(
    repository.deleteProvider({ key: 'cc-switch:claude:cc-provider' }),
    /当前供应商/
  )
})

test('copying a CC-Switch provider preserves its credential when the new key is blank', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'routing-providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })

  repository.saveProvider({
    key: 'cc-switch:claude:cc-provider',
    appType: 'claude',
    name: 'Copied Provider',
    baseUrl: 'https://copied.example',
    apiKey: ''
  })

  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{ settingsConfig: { env: { ANTHROPIC_AUTH_TOKEN?: string } } }>
  }
  assert.equal(localStore.providers[0].settingsConfig.env.ANTHROPIC_AUTH_TOKEN, 'cc-secret')
})

test('leaves distinct legacy Claude authentication fields unchanged when no new key is entered', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare('UPDATE providers SET settings_config = ? WHERE id = ?').run(JSON.stringify({
    env: { ANTHROPIC_AUTH_TOKEN: 'token-a', ANTHROPIC_API_KEY: 'key-b' }
  }), 'cc-provider')
  database.close()
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })

  repository.saveProvider({
    key: 'cc-switch:claude:cc-provider',
    appType: 'claude',
    name: 'Copied',
    apiKey: '',
    apiKeyField: 'ANTHROPIC_API_KEY'
  })

  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{ settingsConfig: { env: Record<string, string> } }>
  }
  assert.equal(localStore.providers[0].settingsConfig.env.ANTHROPIC_AUTH_TOKEN, 'token-a')
  assert.equal(localStore.providers[0].settingsConfig.env.ANTHROPIC_API_KEY, 'key-b')
})

test('stores a local Codex provider in the CC-Switch compatible auth plus TOML shape', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath: join(root, 'routing-providers.json')
  })

  const saved = repository.saveProvider({
    appType: 'codex',
    name: 'Acme Gateway',
    baseUrl: 'https://codex.example/v1',
    apiKey: 'codex-secret',
    model: 'gpt-5.5'
  })

  assert.equal(saved.baseUrl, 'https://codex.example/v1')
  assert.equal(saved.model, 'gpt-5.5')
  const localStore = JSON.parse(readFileSync(join(root, 'routing-providers.json'), 'utf8')) as {
    providers: Array<{ settingsConfig: { auth: { OPENAI_API_KEY: string }; config: string } }>
  }
  assert.equal(localStore.providers[0].settingsConfig.auth.OPENAI_API_KEY, 'codex-secret')
  assert.match(localStore.providers[0].settingsConfig.config, /base_url = "https:\/\/codex\.example\/v1"/)
})

test('preserves unmodeled settings when a CC-Switch provider is copied', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  const localStorePath = join(root, 'routing-providers.json')
  createCcSwitchDatabase(ccSwitchDbPath)
  const database = new DatabaseSync(ccSwitchDbPath)
  database.prepare('UPDATE providers SET settings_config = ? WHERE id = ? AND app_type = ?').run(
    JSON.stringify({
      env: {
        ANTHROPIC_AUTH_TOKEN: 'cc-secret',
        ANTHROPIC_BASE_URL: 'https://cc.example',
        CUSTOM_HEADER_VALUE: 'keep-me'
      },
      permissions: { allow: ['Read(*)'] },
      api_format: 'anthropic'
    }),
    'cc-provider',
    'claude'
  )
  database.close()
  const repository = new RoutingRepository({ ccSwitchDbPath, localStorePath })

  repository.saveProvider({
    key: 'cc-switch:claude:cc-provider',
    appType: 'claude',
    name: 'Copied Provider',
    baseUrl: 'https://new.example',
    apiKey: ''
  })

  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{ settingsConfig: Record<string, unknown> }>
  }
  assert.deepEqual(localStore.providers[0].settingsConfig, {
    env: {
      ANTHROPIC_AUTH_TOKEN: 'cc-secret',
      ANTHROPIC_BASE_URL: 'https://new.example',
      CUSTOM_HEADER_VALUE: 'keep-me'
    },
    permissions: { allow: ['Read(*)'] },
    api_format: 'anthropic'
  })
})

test('writes the local credential store atomically with owner-only permissions', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const localStorePath = join(root, 'routing', 'providers.json')
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath
  })

  repository.saveProvider({
    appType: 'gemini',
    name: 'Private',
    apiKey: 'private-secret'
  })

  assert.equal(statSync(localStorePath).mode & 0o777, 0o600)
  assert.equal(statSync(join(root, 'routing')).mode & 0o777, 0o700)
  assert.equal(readdirSync(join(root, 'routing')).some((name) => name.includes('.tmp-')), false)
})

test('fails closed when the local store is malformed', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const localStorePath = join(root, 'providers.json')
  writeFileSync(localStorePath, '{broken')
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath
  })

  assert.throws(() => repository.getSnapshot(), /本地模型路由数据损坏/)
  assert.throws(() => repository.saveProvider({
    appType: 'claude',
    name: 'Must not overwrite'
  }), /本地模型路由数据损坏/)
  assert.equal(readFileSync(localStorePath, 'utf8'), '{broken')
})

test('adds a missing Codex base URL inside the active model provider section', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const localStorePath = join(root, 'providers.json')
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath
  })
  const created = repository.saveProvider({ appType: 'codex', name: 'Later URL' })

  repository.saveProvider({
    key: created.key,
    appType: 'codex',
    name: 'Later URL',
    baseUrl: 'https://later.example/v1'
  })

  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{ settingsConfig: { config: string } }>
  }
  assert.match(
    localStore.providers[0].settingsConfig.config,
    /\[model_providers\.sookool\]\nbase_url = "https:\/\/later\.example\/v1"/
  )
  assert.equal(localStore.providers[0].settingsConfig.config.startsWith('base_url ='), false)
})

test('allows optional local provider fields to be cleared explicitly', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath: join(root, 'providers.json')
  })
  const created = repository.saveProvider({
    appType: 'claude',
    name: 'Clearable',
    websiteUrl: 'https://example.com',
    category: 'third_party',
    notes: 'remove me'
  })

  const updated = repository.saveProvider({
    key: created.key,
    appType: 'claude',
    name: 'Clearable',
    websiteUrl: '',
    category: '',
    notes: ''
  })

  assert.equal(updated.websiteUrl, undefined)
  assert.equal(updated.notes, undefined)
  assert.equal(updated.category, 'custom')
})

test('creates one local provider group for multiple applications', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath: join(root, 'providers.json')
  })
  const saved = repository.saveProvider({
    name: 'Unified',
    applications: ['claude', 'codex'],
    apiKey: 'secret'
  })
  assert.deepEqual(saved.applications.map((item) => item.appType), ['claude', 'codex'])
  assert.equal(repository.getSnapshot().providers.length, 1)
})

test('stores detailed per-application provider configuration and icon metadata', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const localStorePath = join(root, 'providers.json')
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath
  })

  const saved = repository.saveProvider({
    name: 'Detailed',
    applications: ['claude', 'codex'],
    apiKey: 'secret',
    apiKeyUrl: 'https://example.com/keys',
    apiKeyField: 'ANTHROPIC_API_KEY',
    applicationConfigs: {
      claude: {
        baseUrl: 'https://api.example.com/anthropic',
        model: 'primary-model',
        defaultHaikuModel: 'fast-model',
        defaultSonnetModel: 'balanced-model',
        defaultOpusModel: 'strong-model',
        autoCompactWindow: '262144'
      },
      codex: {
        baseUrl: 'https://api.example.com/v1',
        model: 'codex-model',
        wireApi: 'responses'
      }
    },
    icon: 'deepseek',
    iconColor: '#1e88e5'
  })

  const localStore = JSON.parse(readFileSync(localStorePath, 'utf8')) as {
    providers: Array<{
      apiKeyUrl?: string
      icon?: string
      iconColor?: string
      apiKeyField?: string
      settingsConfig: { env?: Record<string, string>; config?: string }
    }>
  }
  assert.equal(localStore.providers[0].apiKeyUrl, 'https://example.com/keys')
  assert.equal(localStore.providers[0].icon, 'deepseek')
  assert.equal(localStore.providers[0].iconColor, '#1e88e5')
  const claude = localStore.providers.find((provider) => provider.settingsConfig.env)
  const codex = localStore.providers.find((provider) => provider.settingsConfig.config)
  assert.deepEqual(claude?.settingsConfig.env, {
    ANTHROPIC_BASE_URL: 'https://api.example.com/anthropic',
    ANTHROPIC_API_KEY: 'secret',
    ANTHROPIC_MODEL: 'primary-model',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'fast-model',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'balanced-model',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'strong-model',
    CLAUDE_CODE_AUTO_COMPACT_WINDOW: '262144'
  })
  assert.equal(localStore.providers[0].apiKeyField, 'ANTHROPIC_API_KEY')
  assert.match(codex?.settingsConfig.config ?? '', /base_url = "https:\/\/api\.example\.com\/v1"/)
  assert.match(codex?.settingsConfig.config ?? '', /model = "codex-model"/)
  assert.match(codex?.settingsConfig.config ?? '', /wire_api = "responses"/)
  assert.equal(saved.apiKeyUrl, 'https://example.com/keys')
  assert.equal(saved.applications.find((application) => application.appType === 'claude')?.defaultSonnetModel, 'balanced-model')
  assert.equal(saved.apiKeyField, 'ANTHROPIC_API_KEY')
})

test('deletes every local application adapter through a unified provider key', async () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath: join(root, 'providers.json')
  })
  const saved = repository.saveProvider({ name: 'Unified', applications: ['claude', 'codex'] })
  await repository.deleteProvider({ key: saved.key })
  assert.equal(repository.getSnapshot().providers.length, 0)
})

test('activates a local provider by writing live config before recording current state', async () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-repository-'))
  const repository = new RoutingRepository({
    ccSwitchDbPath: join(root, 'missing.db'),
    localStorePath: join(root, 'providers.json'),
    livePaths: {
      claudeSettingsPath: join(root, '.claude', 'settings.json'),
      codexAuthPath: join(root, '.codex', 'auth.json'),
      codexConfigPath: join(root, '.codex', 'config.toml'),
      geminiEnvPath: join(root, '.gemini', '.env'),
      geminiSettingsPath: join(root, '.gemini', 'settings.json'),
      backupDir: join(root, 'backups', 'live')
    }
  })
  const saved = repository.saveProvider({
    name: 'Advanced',
    applications: ['claude'],
    apiKey: 'secret',
    applicationConfigs: {
      claude: {
        baseUrl: 'https://advanced.example',
        defaultSonnetModel: 'sonnet',
        apiTimeoutMs: '3000000',
        disableNonessentialTraffic: true
      }
    }
  })

  await repository.activateProvider({ key: saved.key, appType: 'claude' })
  const basic = repository.saveProvider({
    name: 'Active', applications: ['claude'], apiKey: 'secret', baseUrl: 'https://active.example'
  })
  await repository.activateProvider({ key: basic.key, appType: 'claude' })

  const live = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'))
  assert.equal(live.env.ANTHROPIC_BASE_URL, 'https://active.example')
  assert.equal(live.env.ANTHROPIC_DEFAULT_SONNET_MODEL, undefined)
  assert.equal(live.env.API_TIMEOUT_MS, undefined)
  assert.equal(live.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC, undefined)
  assert.equal(repository.getSnapshot().apps.find((app) => app.id === 'claude')?.currentProviderName, 'Active')
})
