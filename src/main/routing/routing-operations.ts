import { existsSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  proxyRoutingAppTypes,
  type ProxyRoutingAppType,
  type RoutingProxyAppConfig,
  type RoutingProxyGlobalConfig,
  type RoutingUsageGroup,
  type RoutingUsageLog,
  type RoutingUsageQuery,
  type RoutingUsageSnapshot,
  type UpdateRoutingProxyInput
} from '../../shared/routing-types.ts'

export interface RoutingOperationsOptions {
  databasePath: string
  ccSwitchDbPath: string
}

export interface RoutingRequestRecord {
  requestId: string
  appType: ProxyRoutingAppType
  providerKey: string
  providerName: string
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
  totalCostUsd: number
  latencyMs: number
  statusCode: number
  error?: string
  createdAt: number
}

interface UsageRow extends RoutingUsageLog {
  providerKey: string
  requestCount: number
  successCount: number
}

const DEFAULT_GLOBAL: RoutingProxyGlobalConfig = {
  listenAddress: '127.0.0.1',
  listenPort: 15721,
  enableLogging: true
}

function defaultApp(appType: ProxyRoutingAppType): RoutingProxyAppConfig {
  const isClaude = appType === 'claude'
  return {
    appType,
    enabled: false,
    autoFailoverEnabled: false,
    maxRetries: isClaude ? 6 : appType === 'gemini' ? 5 : 3,
    streamingFirstByteTimeout: isClaude ? 90 : 60,
    streamingIdleTimeout: isClaude ? 180 : 120,
    nonStreamingTimeout: 600,
    failureThreshold: isClaude ? 8 : 4,
    successThreshold: isClaude ? 3 : 2,
    cooldownSeconds: isClaude ? 90 : 60,
    errorRateThreshold: isClaude ? 0.7 : 0.6,
    minRequests: isClaude ? 15 : 10,
    queue: []
  }
}

export class RoutingOperationsRepository {
  private readonly database: DatabaseSync
  private readonly options: RoutingOperationsOptions

  constructor(options: RoutingOperationsOptions) {
    this.options = options
    mkdirSync(dirname(options.databasePath), { recursive: true, mode: 0o700 })
    this.database = new DatabaseSync(options.databasePath)
    this.database.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON')
    this.initializeSchema()
    this.ensureProxyAppColumns()
    this.initializeConfig()
  }

  close(): void {
    this.database.close()
  }

  getConfig(): {
    global: RoutingProxyGlobalConfig
    apps: RoutingProxyAppConfig[]
    importedCcSwitchConfig: boolean
  } {
    const globalRow = this.database.prepare(`
      SELECT listen_address, listen_port, enable_logging FROM proxy_global WHERE id = 1
    `).get() as { listen_address: string; listen_port: number; enable_logging: number }
    const rows = this.database.prepare(`
      SELECT app_type, enabled, auto_failover_enabled, max_retries,
             streaming_first_byte_timeout, streaming_idle_timeout, non_streaming_timeout,
             failure_threshold, success_threshold, cooldown_seconds,
             error_rate_threshold, min_requests, queue_json
      FROM proxy_apps
    `).all() as Array<{
      app_type: string
      enabled: number
      auto_failover_enabled: number
      max_retries: number
      streaming_first_byte_timeout: number
      streaming_idle_timeout: number
      non_streaming_timeout: number
      failure_threshold: number
      success_threshold: number
      cooldown_seconds: number
      error_rate_threshold: number
      min_requests: number
      queue_json: string
    }>
    return {
      global: {
        listenAddress: globalRow.listen_address,
        listenPort: globalRow.listen_port,
        enableLogging: Boolean(globalRow.enable_logging)
      },
      apps: proxyRoutingAppTypes.map((appType) => {
        const row = rows.find((candidate) => candidate.app_type === appType)
        if (!row) return defaultApp(appType)
        return {
          appType,
          enabled: Boolean(row.enabled),
          autoFailoverEnabled: Boolean(row.auto_failover_enabled),
          maxRetries: row.max_retries,
          streamingFirstByteTimeout: row.streaming_first_byte_timeout,
          streamingIdleTimeout: row.streaming_idle_timeout,
          nonStreamingTimeout: row.non_streaming_timeout,
          failureThreshold: row.failure_threshold,
          successThreshold: row.success_threshold,
          cooldownSeconds: row.cooldown_seconds,
          errorRateThreshold: row.error_rate_threshold,
          minRequests: row.min_requests,
          queue: parseQueue(row.queue_json)
        }
      }),
      importedCcSwitchConfig: this.getMetadata('cc_switch_config_imported') === '1'
    }
  }

  updateConfig(input: UpdateRoutingProxyInput): ReturnType<RoutingOperationsRepository['getConfig']> {
    if (input.global) {
      const current = this.getConfig().global
      const next = { ...current, ...input.global }
      if (next.listenAddress !== '127.0.0.1' && next.listenAddress !== '::1' && next.listenAddress !== 'localhost') {
        throw new Error('本地路由只允许监听回环地址')
      }
      if (!Number.isInteger(next.listenPort) || next.listenPort < 1024 || next.listenPort > 65535) {
        throw new Error('监听端口必须在 1024 到 65535 之间')
      }
      this.database.prepare(`
        UPDATE proxy_global SET listen_address = ?, listen_port = ?, enable_logging = ? WHERE id = 1
      `).run(next.listenAddress, next.listenPort, next.enableLogging ? 1 : 0)
    }
    if (input.app) {
      const current = this.getConfig().apps.find((app) => app.appType === input.app?.appType)
      if (!current) throw new Error('不支持的本地路由应用')
      const next = { ...current, ...input.app }
      if (!Number.isInteger(next.maxRetries) || next.maxRetries < 0 || next.maxRetries > 10) {
        throw new Error('最大重试次数必须在 0 到 10 之间')
      }
      validateIntegerRange(next.streamingFirstByteTimeout, 5, 600, '首字节超时')
      validateIntegerRange(next.streamingIdleTimeout, 5, 3600, '流空闲超时')
      validateIntegerRange(next.nonStreamingTimeout, 10, 3600, '非流式超时')
      if (!Number.isInteger(next.failureThreshold) || next.failureThreshold < 1 || next.failureThreshold > 20) {
        throw new Error('熔断阈值必须在 1 到 20 之间')
      }
      validateIntegerRange(next.successThreshold, 1, 10, '半开恢复阈值')
      if (!Number.isInteger(next.cooldownSeconds) || next.cooldownSeconds < 5 || next.cooldownSeconds > 3600) {
        throw new Error('恢复等待时间必须在 5 到 3600 秒之间')
      }
      if (!Number.isFinite(next.errorRateThreshold) || next.errorRateThreshold < 0.1 || next.errorRateThreshold > 1) {
        throw new Error('错误率阈值必须在 0.1 到 1 之间')
      }
      validateIntegerRange(next.minRequests, 1, 1000, '熔断最小样本')
      const queue = [...new Set(next.queue.filter((key) => typeof key === 'string' && key.trim()))]
      this.database.prepare(`
        UPDATE proxy_apps SET enabled = ?, auto_failover_enabled = ?, max_retries = ?,
          streaming_first_byte_timeout = ?, streaming_idle_timeout = ?, non_streaming_timeout = ?,
          failure_threshold = ?, success_threshold = ?, cooldown_seconds = ?,
          error_rate_threshold = ?, min_requests = ?, queue_json = ? WHERE app_type = ?
      `).run(
        next.enabled ? 1 : 0,
        next.autoFailoverEnabled ? 1 : 0,
        next.maxRetries,
        next.streamingFirstByteTimeout,
        next.streamingIdleTimeout,
        next.nonStreamingTimeout,
        next.failureThreshold,
        next.successThreshold,
        next.cooldownSeconds,
        next.errorRateThreshold,
        next.minRequests,
        JSON.stringify(queue),
        next.appType
      )
    }
    return this.getConfig()
  }

  recordRequest(record: RoutingRequestRecord): void {
    this.database.prepare(`
      INSERT OR REPLACE INTO proxy_request_logs (
        request_id, provider_key, provider_name, app_type, model,
        input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens,
        total_cost_usd, latency_ms, status_code, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      record.requestId,
      record.providerKey,
      record.providerName,
      record.appType,
      record.model,
      nonNegativeInteger(record.inputTokens),
      nonNegativeInteger(record.outputTokens),
      nonNegativeInteger(record.cacheReadTokens),
      nonNegativeInteger(record.cacheCreationTokens),
      finiteNumber(record.totalCostUsd),
      nonNegativeInteger(record.latencyMs),
      record.statusCode,
      record.error ?? null,
      Math.floor(record.createdAt / 1000)
    )
  }

  getUsageSnapshot(query: RoutingUsageQuery = {}): RoutingUsageSnapshot {
    const days = query.days ?? 7
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (days - 1))
    const startSeconds = Math.floor(start.getTime() / 1000)
    const details = [
      ...this.readLocalUsage(startSeconds, query.appType),
      ...this.readCcSwitchUsage(startSeconds, query.appType)
    ]
    const rollups = this.readCcSwitchRollups(startSeconds, query.appType)
    const aggregateRows = [...details, ...rollups]
    const totalRequests = aggregateRows.reduce((sum, row) => sum + row.requestCount, 0)
    const successRequests = aggregateRows.reduce((sum, row) => sum + row.successCount, 0)
    const totalInputTokens = aggregateRows.reduce((sum, row) => sum + row.inputTokens, 0)
    const totalOutputTokens = aggregateRows.reduce((sum, row) => sum + row.outputTokens, 0)
    const totalCacheReadTokens = aggregateRows.reduce((sum, row) => sum + row.cacheReadTokens, 0)
    const totalCacheCreationTokens = aggregateRows.reduce((sum, row) => sum + row.cacheCreationTokens, 0)

    return {
      days,
      appType: query.appType,
      summary: {
        totalRequests,
        successRate: totalRequests ? successRequests / totalRequests : 0,
        totalInputTokens,
        totalOutputTokens,
        totalCacheReadTokens,
        totalCacheCreationTokens,
        totalTokens: totalInputTokens + totalOutputTokens + totalCacheReadTokens + totalCacheCreationTokens,
        totalCostUsd: roundMoney(aggregateRows.reduce((sum, row) => sum + row.totalCostUsd, 0))
      },
      daily: buildDaily(aggregateRows, days),
      providers: groupUsage(aggregateRows, (row) => ({
        key: row.providerKey,
        name: row.providerName
      })),
      models: groupUsage(aggregateRows, (row) => ({ key: row.model || 'unknown', name: row.model || '未识别模型' })),
      recent: details.sort((left, right) => right.createdAt - left.createdAt).slice(0, 50)
        .map(({ providerKey: _providerKey, requestCount: _count, successCount: _success, ...log }) => log),
      ccSwitchAvailable: existsSync(this.options.ccSwitchDbPath)
    }
  }

  estimateCost(
    model: string,
    usage: Pick<RoutingRequestRecord, 'inputTokens' | 'outputTokens' | 'cacheReadTokens' | 'cacheCreationTokens'>
  ): number {
    if (!model.trim() || !existsSync(this.options.ccSwitchDbPath)) return 0
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      if (!tableExists(database, 'model_pricing')) return 0
      const columns = tableColumns(database, 'model_pricing')
      const required = [
        'model_id',
        'input_cost_per_million',
        'output_cost_per_million',
        'cache_read_cost_per_million',
        'cache_creation_cost_per_million'
      ]
      if (required.some((column) => !columns.has(column))) return 0
      const normalized = model.trim().toLowerCase().replace('@', '-')
      const withoutVendor = normalized.includes('/') ? normalized.slice(normalized.lastIndexOf('/') + 1) : normalized
      const row = database.prepare(`
        SELECT input_cost_per_million, output_cost_per_million,
               cache_read_cost_per_million, cache_creation_cost_per_million
        FROM model_pricing
        WHERE LOWER(model_id) IN (?, ?)
           OR ? LIKE LOWER(model_id) || '-%'
        ORDER BY CASE WHEN LOWER(model_id) IN (?, ?) THEN 0 ELSE 1 END,
                 LENGTH(model_id) DESC
        LIMIT 1
      `).get(normalized, withoutVendor, withoutVendor, normalized, withoutVendor) as Record<string, unknown> | undefined
      if (!row) return 0
      return roundMoney((
        usage.inputTokens * finiteNumber(row.input_cost_per_million)
        + usage.outputTokens * finiteNumber(row.output_cost_per_million)
        + usage.cacheReadTokens * finiteNumber(row.cache_read_cost_per_million)
        + usage.cacheCreationTokens * finiteNumber(row.cache_creation_cost_per_million)
      ) / 1_000_000)
    } finally {
      database.close()
    }
  }

  private initializeSchema(): void {
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS proxy_global (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        listen_address TEXT NOT NULL,
        listen_port INTEGER NOT NULL,
        enable_logging INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proxy_apps (
        app_type TEXT PRIMARY KEY,
        enabled INTEGER NOT NULL,
        auto_failover_enabled INTEGER NOT NULL,
        max_retries INTEGER NOT NULL,
        streaming_first_byte_timeout INTEGER NOT NULL,
        streaming_idle_timeout INTEGER NOT NULL,
        non_streaming_timeout INTEGER NOT NULL,
        failure_threshold INTEGER NOT NULL,
        success_threshold INTEGER NOT NULL,
        cooldown_seconds INTEGER NOT NULL,
        error_rate_threshold REAL NOT NULL,
        min_requests INTEGER NOT NULL,
        queue_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS proxy_request_logs (
        request_id TEXT PRIMARY KEY,
        provider_key TEXT NOT NULL,
        provider_name TEXT NOT NULL,
        app_type TEXT NOT NULL,
        model TEXT NOT NULL,
        input_tokens INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        total_cost_usd REAL NOT NULL DEFAULT 0,
        latency_ms INTEGER NOT NULL DEFAULT 0,
        status_code INTEGER NOT NULL,
        error_message TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_sookool_usage_created_at ON proxy_request_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_sookool_usage_app_created_at ON proxy_request_logs(app_type, created_at DESC);
    `)
  }

  private ensureProxyAppColumns(): void {
    const columns = tableColumns(this.database, 'proxy_apps')
    const additions: Array<[string, string]> = [
      ['streaming_first_byte_timeout', 'INTEGER NOT NULL DEFAULT 60'],
      ['streaming_idle_timeout', 'INTEGER NOT NULL DEFAULT 120'],
      ['non_streaming_timeout', 'INTEGER NOT NULL DEFAULT 600'],
      ['success_threshold', 'INTEGER NOT NULL DEFAULT 2'],
      ['error_rate_threshold', 'REAL NOT NULL DEFAULT 0.6'],
      ['min_requests', 'INTEGER NOT NULL DEFAULT 10']
    ]
    for (const [name, definition] of additions) {
      if (!columns.has(name)) this.database.exec(`ALTER TABLE proxy_apps ADD COLUMN ${name} ${definition}`)
    }
  }

  private initializeConfig(): void {
    const existing = this.database.prepare('SELECT COUNT(*) AS count FROM proxy_global').get() as { count: number }
    if (existing.count > 0) return
    const imported = this.readCcSwitchProxyConfig()
    const global = imported?.global ?? DEFAULT_GLOBAL
    this.database.exec('BEGIN IMMEDIATE')
    try {
      this.database.prepare('INSERT INTO proxy_global VALUES (1, ?, ?, ?)')
        .run(global.listenAddress, global.listenPort, global.enableLogging ? 1 : 0)
      for (const appType of proxyRoutingAppTypes) {
        const app = imported?.apps.find((candidate) => candidate.appType === appType) ?? defaultApp(appType)
        this.database.prepare(`
          INSERT INTO proxy_apps (
            app_type, enabled, auto_failover_enabled, max_retries,
            streaming_first_byte_timeout, streaming_idle_timeout, non_streaming_timeout,
            failure_threshold, success_threshold, cooldown_seconds,
            error_rate_threshold, min_requests, queue_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(appType,
          app.enabled ? 1 : 0,
          app.autoFailoverEnabled ? 1 : 0,
          app.maxRetries,
          app.streamingFirstByteTimeout,
          app.streamingIdleTimeout,
          app.nonStreamingTimeout,
          app.failureThreshold,
          app.successThreshold,
          app.cooldownSeconds,
          app.errorRateThreshold,
          app.minRequests,
          JSON.stringify(app.queue)
        )
      }
      this.setMetadata('cc_switch_config_imported', imported ? '1' : '0')
      this.database.exec('COMMIT')
    } catch (error) {
      this.database.exec('ROLLBACK')
      throw error
    }
  }

  private readCcSwitchProxyConfig(): { global: RoutingProxyGlobalConfig; apps: RoutingProxyAppConfig[] } | undefined {
    if (!existsSync(this.options.ccSwitchDbPath)) return undefined
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      if (!tableExists(database, 'proxy_config')) return undefined
      const columns = tableColumns(database, 'proxy_config')
      if (!columns.has('app_type')) return undefined
      const rows = database.prepare('SELECT * FROM proxy_config').all() as Array<Record<string, unknown>>
      if (!rows.length) return undefined
      const base = rows.find((row) => row.app_type === 'claude') ?? rows[0]
      const importedAddress = stringValue(base.listen_address, DEFAULT_GLOBAL.listenAddress)
      const importedPort = numberValue(base.listen_port, DEFAULT_GLOBAL.listenPort)
      const importedQueues = readCcSwitchFailoverQueues(database)
      return {
        global: {
          listenAddress: isLoopbackAddress(importedAddress) ? importedAddress : DEFAULT_GLOBAL.listenAddress,
          listenPort: Number.isInteger(importedPort) && importedPort >= 1024 && importedPort <= 65535
            ? importedPort
            : DEFAULT_GLOBAL.listenPort,
          enableLogging: booleanValue(base.enable_logging, DEFAULT_GLOBAL.enableLogging)
        },
        apps: proxyRoutingAppTypes.map((appType) => {
          const row = rows.find((candidate) => candidate.app_type === appType)
          const fallback = defaultApp(appType)
          return {
            appType,
            enabled: booleanValue(row?.enabled, false),
            autoFailoverEnabled: booleanValue(row?.auto_failover_enabled, false),
            maxRetries: boundedInteger(row?.max_retries, 0, 10, fallback.maxRetries),
            streamingFirstByteTimeout: boundedInteger(row?.streaming_first_byte_timeout, 5, 600, fallback.streamingFirstByteTimeout),
            streamingIdleTimeout: boundedInteger(row?.streaming_idle_timeout, 5, 3600, fallback.streamingIdleTimeout),
            nonStreamingTimeout: boundedInteger(row?.non_streaming_timeout, 10, 3600, fallback.nonStreamingTimeout),
            failureThreshold: boundedInteger(row?.circuit_failure_threshold, 1, 20, fallback.failureThreshold),
            successThreshold: boundedInteger(row?.circuit_success_threshold, 1, 10, fallback.successThreshold),
            cooldownSeconds: boundedInteger(row?.circuit_timeout_seconds, 5, 3600, fallback.cooldownSeconds),
            errorRateThreshold: boundedNumber(row?.circuit_error_rate_threshold, 0.1, 1, fallback.errorRateThreshold),
            minRequests: boundedInteger(row?.circuit_min_requests, 1, 1000, fallback.minRequests),
            queue: importedQueues.get(appType) ?? []
          }
        })
      }
    } finally {
      database.close()
    }
  }

  private readLocalUsage(startSeconds: number, appType?: ProxyRoutingAppType): UsageRow[] {
    const conditions = ['created_at >= ?']
    const params: Array<string | number> = [startSeconds]
    if (appType) {
      conditions.push('app_type = ?')
      params.push(appType)
    }
    const rows = this.database.prepare(`
      SELECT * FROM proxy_request_logs WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC
    `).all(...params) as Array<Record<string, unknown>>
    return rows.map((row) => usageRowFromRecord(row, 'sookool', String(row.provider_key), String(row.provider_name)))
  }

  private readCcSwitchUsage(startSeconds: number, appType?: ProxyRoutingAppType): UsageRow[] {
    if (!existsSync(this.options.ccSwitchDbPath)) return []
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      if (!tableExists(database, 'proxy_request_logs')) return []
      const columns = tableColumns(database, 'proxy_request_logs')
      const required = ['request_id', 'provider_id', 'app_type', 'model', 'created_at']
      if (required.some((column) => !columns.has(column))) return []
      const conditions = ['l.created_at >= ?']
      const params: Array<string | number> = [startSeconds]
      if (appType) {
        conditions.push("CASE WHEN l.app_type = 'claude-desktop' THEN 'claude' ELSE l.app_type END = ?")
        params.push(appType)
      }
      const providerJoin = tableExists(database, 'providers')
        ? 'LEFT JOIN providers p ON l.provider_id = p.id AND l.app_type = p.app_type'
        : ''
      const providerName = ccSwitchProviderName('l', providerJoin ? 'p' : undefined)
      const value = (column: string, fallback: string) => columns.has(column) ? `l.${column}` : fallback
      const effectiveModel = columns.has('pricing_model')
        ? "COALESCE(NULLIF(l.pricing_model, ''), l.model)"
        : 'l.model'
      if (hasUsageDedupColumns(columns)) conditions.push(ccSwitchEffectiveUsageFilter('l'))
      const rows = database.prepare(`
        SELECT l.request_id, l.provider_id, ${providerName} AS provider_name, l.app_type,
          ${effectiveModel} AS model,
          ${value('input_tokens', '0')} AS input_tokens,
          ${value('output_tokens', '0')} AS output_tokens,
          ${value('cache_read_tokens', '0')} AS cache_read_tokens,
          ${value('cache_creation_tokens', '0')} AS cache_creation_tokens,
          ${value('total_cost_usd', "'0'")} AS total_cost_usd,
          ${value('latency_ms', '0')} AS latency_ms,
          ${value('status_code', '0')} AS status_code,
          ${value('error_message', 'NULL')} AS error_message,
          l.created_at
        FROM proxy_request_logs l ${providerJoin}
        WHERE ${conditions.join(' AND ')}
        ORDER BY l.created_at DESC
      `).all(...params) as Array<Record<string, unknown>>
      return rows.map((row) => usageRowFromRecord(
        row,
        'cc-switch',
        `cc-switch:${String(row.app_type)}:${String(row.provider_id)}`,
        String(row.provider_name)
      ))
    } finally {
      database.close()
    }
  }

  private readCcSwitchRollups(startSeconds: number, appType?: ProxyRoutingAppType): UsageRow[] {
    if (!existsSync(this.options.ccSwitchDbPath)) return []
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      if (!tableExists(database, 'usage_daily_rollups')) return []
      const start = new Date(startSeconds * 1000)
      const firstFullDay = new Date(start)
      if (start.getHours() !== 0 || start.getMinutes() !== 0 || start.getSeconds() !== 0) {
        firstFullDay.setDate(firstFullDay.getDate() + 1)
      }
      const lastFullDay = new Date()
      lastFullDay.setDate(lastFullDay.getDate() - 1)
      const startDate = localDate(firstFullDay)
      const endDate = localDate(lastFullDay)
      if (startDate > endDate) return []
      const conditions = ['r.date >= ?', 'r.date <= ?']
      const params: Array<string> = [startDate, endDate]
      if (appType) {
        conditions.push("CASE WHEN r.app_type = 'claude-desktop' THEN 'claude' ELSE r.app_type END = ?")
        params.push(appType)
      }
      const providerJoin = tableExists(database, 'providers')
        ? 'LEFT JOIN providers p ON r.provider_id = p.id AND r.app_type = p.app_type'
        : ''
      const providerName = ccSwitchProviderName('r', providerJoin ? 'p' : undefined)
      const columns = tableColumns(database, 'usage_daily_rollups')
      const effectiveModel = columns.has('pricing_model')
        ? "COALESCE(NULLIF(r.pricing_model, ''), r.model)"
        : 'r.model'
      const rows = database.prepare(`
        SELECT r.*, ${providerName} AS provider_name, ${effectiveModel} AS effective_model
        FROM usage_daily_rollups r ${providerJoin}
        WHERE ${conditions.join(' AND ')}
      `).all(...params) as Array<Record<string, unknown>>
      return rows.map((row) => ({
        requestId: `rollup:${row.date}:${row.app_type}:${row.provider_id}:${row.model}`,
        source: 'cc-switch',
        appType: String(row.app_type),
        providerKey: `cc-switch:${String(row.app_type)}:${String(row.provider_id)}`,
        providerName: String(row.provider_name),
        model: String(row.effective_model ?? row.model),
        inputTokens: normalizedCcInput(row),
        outputTokens: numberValue(row.output_tokens, 0),
        cacheReadTokens: numberValue(row.cache_read_tokens, 0),
        cacheCreationTokens: numberValue(row.cache_creation_tokens, 0),
        totalCostUsd: finiteNumber(row.total_cost_usd),
        latencyMs: numberValue(row.avg_latency_ms, 0),
        statusCode: numberValue(row.success_count, 0) === numberValue(row.request_count, 0) ? 200 : 207,
        createdAt: new Date(`${String(row.date)}T12:00:00`).getTime(),
        requestCount: numberValue(row.request_count, 0),
        successCount: numberValue(row.success_count, 0)
      }))
    } finally {
      database.close()
    }
  }

  private getMetadata(key: string): string | undefined {
    return (this.database.prepare('SELECT value FROM metadata WHERE key = ?').get(key) as { value: string } | undefined)?.value
  }

  private setMetadata(key: string, value: string): void {
    this.database.prepare('INSERT OR REPLACE INTO metadata VALUES (?, ?)').run(key, value)
  }
}

function usageRowFromRecord(
  row: Record<string, unknown>,
  source: 'cc-switch' | 'sookool',
  providerKey: string,
  providerName: string
): UsageRow {
  const created = numberValue(row.created_at, 0)
  const statusCode = numberValue(row.status_code, 0)
  return {
    requestId: String(row.request_id),
    source,
    appType: String(row.app_type),
    providerKey,
    providerName,
    model: String(row.model ?? ''),
    inputTokens: source === 'cc-switch'
      ? normalizedCcInput(row)
      : numberValue(row.input_tokens, 0),
    outputTokens: numberValue(row.output_tokens, 0),
    cacheReadTokens: numberValue(row.cache_read_tokens, 0),
    cacheCreationTokens: numberValue(row.cache_creation_tokens, 0),
    totalCostUsd: finiteNumber(row.total_cost_usd),
    latencyMs: numberValue(row.latency_ms, 0),
    statusCode,
    error: typeof row.error_message === 'string' ? row.error_message : undefined,
    createdAt: created > 10_000_000_000 ? created : created * 1000,
    requestCount: 1,
    successCount: statusCode >= 200 && statusCode < 400 ? 1 : 0
  }
}

function groupUsage(
  rows: UsageRow[],
  select: (row: UsageRow) => { key: string; name: string }
): RoutingUsageGroup[] {
  const groups = new Map<string, RoutingUsageGroup & { successCount: number; latencyTotal: number }>()
  for (const row of rows) {
    const selected = select(row)
    const existing = groups.get(selected.key) ?? {
      key: selected.key,
      name: selected.name,
      requestCount: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      successRate: 0,
      averageLatencyMs: 0,
      successCount: 0,
      latencyTotal: 0
    }
    existing.requestCount += row.requestCount
    existing.successCount += row.successCount
    existing.totalTokens += row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheCreationTokens
    existing.totalCostUsd += row.totalCostUsd
    existing.latencyTotal += row.latencyMs * row.requestCount
    groups.set(selected.key, existing)
  }
  return [...groups.values()].map(({ successCount, latencyTotal, ...group }) => ({
    ...group,
    totalCostUsd: roundMoney(group.totalCostUsd),
    successRate: group.requestCount ? successCount / group.requestCount : 0,
    averageLatencyMs: group.requestCount ? Math.round(latencyTotal / group.requestCount) : 0
  })).sort((left, right) => right.totalTokens - left.totalTokens)
}

function buildDaily(rows: UsageRow[], days: number): RoutingUsageSnapshot['daily'] {
  const dates = new Map<string, RoutingUsageSnapshot['daily'][number]>()
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const value = new Date()
    value.setHours(0, 0, 0, 0)
    value.setDate(value.getDate() - offset)
    const date = localDate(value)
    dates.set(date, { date, requestCount: 0, totalTokens: 0, totalCostUsd: 0 })
  }
  for (const row of rows) {
    const date = localDate(new Date(row.createdAt))
    const item = dates.get(date)
    if (!item) continue
    item.requestCount += row.requestCount
    item.totalTokens += row.inputTokens + row.outputTokens + row.cacheReadTokens + row.cacheCreationTokens
    item.totalCostUsd += row.totalCostUsd
  }
  return [...dates.values()].map((item) => ({ ...item, totalCostUsd: roundMoney(item.totalCostUsd) }))
}

function tableExists(database: DatabaseSync, name: string): boolean {
  return Boolean(database.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name))
}

function tableColumns(database: DatabaseSync, name: string): Set<string> {
  return new Set((database.prepare(`PRAGMA table_info(${name})`).all() as Array<{ name: string }>).map((column) => column.name))
}

function parseQueue(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

function booleanValue(value: unknown, fallback: boolean): boolean {
  return value === undefined || value === null ? fallback : value === true || value === 1 || value === '1'
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function numberValue(value: unknown, fallback: number): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function boundedInteger(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = numberValue(value, fallback)
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback
}

function boundedNumber(value: unknown, min: number, max: number, fallback: number): number {
  const parsed = numberValue(value, fallback)
  return parsed >= min && parsed <= max ? parsed : fallback
}

function validateIntegerRange(value: number, min: number, max: number, label: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${label}必须在 ${min} 到 ${max} 之间`)
  }
}

function isLoopbackAddress(value: string): boolean {
  return value === '127.0.0.1' || value === '::1' || value === 'localhost'
}

function finiteNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function nonNegativeInteger(value: unknown): number {
  return Math.max(0, Math.round(finiteNumber(value)))
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000
}

function normalizedCcInput(row: Record<string, unknown>): number {
  const input = numberValue(row.input_tokens, 0)
  return row.app_type === 'codex' || row.app_type === 'gemini'
    ? Math.max(0, input - numberValue(row.cache_read_tokens, 0))
    : input
}

function localDate(value: Date): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function hasUsageDedupColumns(columns: Set<string>): boolean {
  return [
    'data_source',
    'status_code',
    'input_tokens',
    'output_tokens',
    'cache_read_tokens',
    'cache_creation_tokens',
    'created_at',
    'model'
  ].every((column) => columns.has(column))
}

function ccSwitchEffectiveUsageFilter(alias: string): string {
  return `NOT (
    COALESCE(${alias}.data_source, 'proxy') IN ('session_log', 'codex_session', 'gemini_session', 'opencode_session')
    AND EXISTS (
      SELECT 1 FROM proxy_request_logs proxy_dedup
      WHERE COALESCE(proxy_dedup.data_source, 'proxy') = 'proxy'
        AND proxy_dedup.app_type = ${alias}.app_type
        AND proxy_dedup.status_code >= 200 AND proxy_dedup.status_code < 300
        AND proxy_dedup.input_tokens = ${alias}.input_tokens
        AND proxy_dedup.output_tokens = ${alias}.output_tokens
        AND proxy_dedup.cache_read_tokens = ${alias}.cache_read_tokens
        AND (
          proxy_dedup.cache_creation_tokens = ${alias}.cache_creation_tokens
          OR (
            ${alias}.cache_creation_tokens = 0
            AND COALESCE(${alias}.data_source, 'proxy') IN ('codex_session', 'gemini_session', 'opencode_session')
          )
        )
        AND proxy_dedup.created_at BETWEEN ${alias}.created_at - 600 AND ${alias}.created_at + 600
        AND (
          LOWER(proxy_dedup.model) = LOWER(${alias}.model)
          OR LOWER(proxy_dedup.model) = 'unknown'
          OR LOWER(${alias}.model) = 'unknown'
        )
    )
  )`
}

function ccSwitchProviderName(logAlias: string, providerAlias?: string): string {
  const fallback = `CASE ${logAlias}.provider_id
    WHEN '_session' THEN 'Claude (Session)'
    WHEN '_codex_session' THEN 'Codex (Session)'
    WHEN '_gemini_session' THEN 'Gemini (Session)'
    WHEN '_opencode_session' THEN 'OpenCode (Session)'
    ELSE ${logAlias}.provider_id END`
  return providerAlias ? `COALESCE(${providerAlias}.name, ${fallback})` : fallback
}

function readCcSwitchFailoverQueues(database: DatabaseSync): Map<ProxyRoutingAppType, string[]> {
  const result = new Map<ProxyRoutingAppType, string[]>()
  if (!tableExists(database, 'providers')) return result
  const columns = tableColumns(database, 'providers')
  if (!columns.has('app_type') || !columns.has('name') || !columns.has('in_failover_queue')) return result
  const order = columns.has('sort_index') ? 'COALESCE(sort_index, 999999), name' : 'name'
  for (const appType of proxyRoutingAppTypes) {
    const rows = database.prepare(`
      SELECT name FROM providers
      WHERE app_type = ? AND in_failover_queue = 1
      ORDER BY ${order}
    `).all(appType) as Array<{ name: string }>
    result.set(appType, rows.map((row) => `cc-switch:provider:${normalizeProviderIdentity(row.name)}`))
  }
  return result
}

function normalizeProviderIdentity(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, '-')
}
