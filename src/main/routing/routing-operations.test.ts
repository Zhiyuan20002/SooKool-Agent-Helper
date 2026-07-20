import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { RoutingOperationsRepository } from './routing-operations.ts'

function createCcSwitchUsageDatabase(path: string): void {
  const database = new DatabaseSync(path)
  database.exec(`
    CREATE TABLE proxy_config (
      app_type TEXT PRIMARY KEY,
      proxy_enabled INTEGER NOT NULL,
      listen_address TEXT NOT NULL,
      listen_port INTEGER NOT NULL,
      enable_logging INTEGER NOT NULL,
      enabled INTEGER NOT NULL,
      auto_failover_enabled INTEGER NOT NULL,
      max_retries INTEGER NOT NULL,
      streaming_first_byte_timeout INTEGER NOT NULL,
      streaming_idle_timeout INTEGER NOT NULL,
      non_streaming_timeout INTEGER NOT NULL,
      circuit_failure_threshold INTEGER NOT NULL,
      circuit_success_threshold INTEGER NOT NULL,
      circuit_timeout_seconds INTEGER NOT NULL,
      circuit_error_rate_threshold REAL NOT NULL,
      circuit_min_requests INTEGER NOT NULL
    );
    CREATE TABLE providers (
      id TEXT NOT NULL,
      app_type TEXT NOT NULL,
      name TEXT NOT NULL,
      in_failover_queue INTEGER NOT NULL DEFAULT 0,
      sort_index INTEGER,
      PRIMARY KEY (id, app_type)
    );
    CREATE TABLE proxy_request_logs (
      request_id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      app_type TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL,
      output_tokens INTEGER NOT NULL,
      cache_read_tokens INTEGER NOT NULL,
      cache_creation_tokens INTEGER NOT NULL,
      total_cost_usd TEXT NOT NULL,
      latency_ms INTEGER NOT NULL,
      status_code INTEGER NOT NULL,
      error_message TEXT,
      created_at INTEGER NOT NULL,
      data_source TEXT
    );
    CREATE TABLE model_pricing (
      model_id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      input_cost_per_million TEXT NOT NULL,
      output_cost_per_million TEXT NOT NULL,
      cache_read_cost_per_million TEXT NOT NULL,
      cache_creation_cost_per_million TEXT NOT NULL
    );
  `)
  for (const appType of ['claude', 'codex', 'gemini']) {
    database.prepare(`
      INSERT INTO proxy_config VALUES (?, 1, '127.0.0.1', 15721, 1, 1, 1, 2, 45, 90, 500, 4, 2, 60, 0.5, 8)
    `).run(appType)
  }
  database.prepare('INSERT INTO providers VALUES (?, ?, ?, ?, ?)').run('cc-one', 'claude', 'CC One', 1, 2)
  database.prepare('INSERT INTO model_pricing VALUES (?, ?, ?, ?, ?, ?)')
    .run('claude-sonnet', 'Claude Sonnet', '3', '15', '0.3', '3.75')
  database.prepare(`
    INSERT INTO proxy_request_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cc-request', 'cc-one', 'claude', 'claude-sonnet', 100, 40, 20, 10,
    '0.0025', 800, 200, null, Math.floor(Date.now() / 1000), 'proxy'
  )
  database.prepare(`
    INSERT INTO proxy_request_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cc-session-copy', '_session', 'claude', 'claude-sonnet', 100, 40, 20, 10,
    '0.0025', 800, 200, null, Math.floor(Date.now() / 1000) + 1, 'session_log'
  )
  database.close()
}

test('copies CC-Switch proxy defaults into the independent SooKool database once', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-operations-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  createCcSwitchUsageDatabase(ccSwitchDbPath)
  const repository = new RoutingOperationsRepository({
    databasePath: join(root, 'routing.db'),
    ccSwitchDbPath
  })

  const initial = repository.getConfig()
  assert.equal(initial.importedCcSwitchConfig, true)
  assert.deepEqual(initial.global, {
    listenAddress: '127.0.0.1',
    listenPort: 15721,
    enableLogging: true
  })
  assert.equal(initial.apps.find((app) => app.appType === 'claude')?.autoFailoverEnabled, true)
  assert.equal(initial.apps.find((app) => app.appType === 'claude')?.streamingFirstByteTimeout, 45)
  assert.equal(initial.apps.find((app) => app.appType === 'claude')?.errorRateThreshold, 0.5)
  assert.deepEqual(initial.apps.find((app) => app.appType === 'claude')?.queue, ['cc-switch:provider:cc-one'])

  repository.updateConfig({ global: { listenPort: 16789 } })
  assert.equal(repository.getConfig().global.listenPort, 16789)

  const upstream = new DatabaseSync(ccSwitchDbPath, { readOnly: true })
  assert.equal(
    (upstream.prepare("SELECT listen_port FROM proxy_config WHERE app_type = 'claude'").get() as { listen_port: number }).listen_port,
    15721
  )
  upstream.close()
  repository.close()
})

test('sanitizes non-loopback CC-Switch listen settings during first import', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-operations-loopback-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  createCcSwitchUsageDatabase(ccSwitchDbPath)
  const upstream = new DatabaseSync(ccSwitchDbPath)
  upstream.prepare("UPDATE proxy_config SET listen_address = '0.0.0.0', listen_port = 80").run()
  upstream.close()
  const repository = new RoutingOperationsRepository({
    databasePath: join(root, 'routing.db'),
    ccSwitchDbPath
  })
  assert.equal(repository.getConfig().global.listenAddress, '127.0.0.1')
  assert.equal(repository.getConfig().global.listenPort, 15721)
  repository.close()
})

test('merges local proxy logs with compatible CC-Switch usage data', () => {
  const root = mkdtempSync(join(tmpdir(), 'routing-operations-'))
  const ccSwitchDbPath = join(root, 'cc-switch.db')
  createCcSwitchUsageDatabase(ccSwitchDbPath)
  const repository = new RoutingOperationsRepository({
    databasePath: join(root, 'routing.db'),
    ccSwitchDbPath
  })
  repository.recordRequest({
    requestId: 'local-request',
    appType: 'codex',
    providerKey: 'sookool:provider:local',
    providerName: 'Local One',
    model: 'gpt-5',
    inputTokens: 50,
    outputTokens: 25,
    cacheReadTokens: 5,
    cacheCreationTokens: 0,
    totalCostUsd: 0.001,
    latencyMs: 400,
    statusCode: 200,
    createdAt: Date.now()
  })

  const usage = repository.getUsageSnapshot({ days: 7 })
  assert.equal(usage.summary.totalRequests, 2)
  assert.equal(usage.summary.totalInputTokens, 150)
  assert.equal(usage.summary.totalOutputTokens, 65)
  assert.equal(usage.summary.totalTokens, 250)
  assert.equal(usage.summary.totalCostUsd, 0.0035)
  assert.equal(usage.providers.length, 2)
  assert.deepEqual(usage.recent.map((log) => log.source).sort(), ['cc-switch', 'sookool'])
  assert.equal(repository.getUsageSnapshot({ days: 7, appType: 'codex' }).summary.totalRequests, 1)
  assert.equal(repository.estimateCost('anthropic/claude-sonnet', {
    inputTokens: 1_000_000,
    outputTokens: 1_000_000,
    cacheReadTokens: 1_000_000,
    cacheCreationTokens: 1_000_000
  }), 22.05)
  const upstream = new DatabaseSync(ccSwitchDbPath)
  upstream.prepare(`
    INSERT INTO proxy_request_logs VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'cc-codex-request', 'cc-one', 'codex', 'gpt-5', 100, 30, 20, 0,
    '0', 500, 200, null, Math.floor(Date.now() / 1000), 'proxy'
  )
  upstream.close()
  const codexUsage = repository.getUsageSnapshot({ days: 7, appType: 'codex' })
  assert.equal(codexUsage.summary.totalInputTokens, 130)
  assert.equal(codexUsage.summary.totalTokens, 210)
  repository.close()
})
