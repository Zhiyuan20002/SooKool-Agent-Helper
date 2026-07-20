import {
  chmodSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync
} from 'node:fs'
import { dirname, join } from 'node:path'
import { backup, DatabaseSync } from 'node:sqlite'
import { randomUUID } from 'node:crypto'
import {
  recoverLiveSwitchTransactions,
  switchLiveConfig,
  type LiveSwitchTarget,
  type RoutingLivePaths
} from './live-config-switcher.ts'
import {
  type ActivateRoutingProviderInput,
  routingAppTypes,
  type RoutingAppSummary,
  type RoutingAppType,
  type DeleteRoutingProviderInput,
  type RoutingProviderSource,
  type RoutingProviderAppConfig,
  type RoutingProviderSummary,
  type RoutingProviderInput,
  type RoutingSnapshot
} from '../../shared/routing-types.ts'

interface RoutingRepositoryOptions {
  ccSwitchDbPath: string
  localStorePath: string
  ccSwitchBackupDir?: string
  livePaths?: RoutingLivePaths
  ccSwitchSettingsPath?: string
}

interface StoredProvider {
  id: string
  appType: RoutingAppType
  name: string
  settingsConfig: Record<string, unknown>
  websiteUrl?: string
  apiKeyUrl?: string
  apiKeyField?: RoutingProviderSummary['apiKeyField']
  category?: string
  notes?: string
  icon?: string
  iconColor?: string
  requiresProxy?: boolean
  createdAt: number
  updatedAt: number
}

interface LocalStore {
  schemaVersion: 1
  providers: StoredProvider[]
  activations?: Partial<Record<RoutingAppType, string>>
}

interface CcSwitchProviderRow {
  id: string
  app_type: string
  name: string
  settings_config: string
  website_url: string | null
  category: string | null
  created_at: number | null
  notes: string | null
  icon: string | null
  icon_color: string | null
  meta: string
  is_current: number
  in_failover_queue: number
}

export interface RoutingProxyTarget {
  providerKey: string
  providerId: string
  providerName: string
  appType: 'claude' | 'codex' | 'gemini'
  source: RoutingProviderSource
  baseUrl: string
  model: string
  apiKey?: string
  requiresProxy: boolean
}

export class RoutingRepository {
  private readonly options: RoutingRepositoryOptions

  constructor(options: RoutingRepositoryOptions) {
    this.options = options
    if (options.livePaths) {
      recoverLiveSwitchTransactions(options.livePaths, (target) => this.applyActivationState(target))
    }
  }

  getSnapshot(): RoutingSnapshot {
    const ccSwitchAvailable = existsSync(this.options.ccSwitchDbPath)
    const providerRecords = [
      ...(ccSwitchAvailable ? this.readCcSwitchProviders() : []),
      ...this.readLocalStore().providers.map((provider) => toSummary(provider, 'sookool'))
    ]
    const store = this.readLocalStore()
    const grouped = groupProviderRecords(providerRecords)
    const withCcDeviceState = applyCcSwitchDeviceState(
      grouped,
      this.options.ccSwitchSettingsPath ? readCcSwitchCurrentIds(this.options.ccSwitchSettingsPath) : undefined
    )
    const providers = applyLocalActivations(withCcDeviceState, store.activations)

    return {
      ccSwitchAvailable,
      ccSwitchDatabasePath: this.options.ccSwitchDbPath,
      localStorePath: this.options.localStorePath,
      apps: buildAppSummaries(providers),
      providers
    }
  }

  async activateProvider(input: ActivateRoutingProviderInput): Promise<void> {
    if (!this.options.livePaths) throw new Error('实时配置路径未配置')
    if (!isRoutingAppType(String(input.appType))) throw new Error('无效的应用类型')
    const provider = this.getSnapshot().providers.find((item) => item.key === input.key)
    const adapter = provider?.applications.find((item) => item.appType === input.appType)
    if (!provider || !adapter) throw new Error('该供应商不支持此应用')
    if (adapter.requiresProxy) throw new Error('该 CC-Switch 配置依赖本地协议转换，当前版本暂不支持直接激活')
    const recordKey = parseProviderKey(adapter.recordKey)
    if (!recordKey) throw new Error('供应商适配配置损坏')
    const stored = recordKey.source === 'sookool'
      ? this.readLocalStore().providers.find((item) => item.id === recordKey.id && item.appType === input.appType)
      : this.readCcSwitchProvider(recordKey)
    if (!stored) throw new Error('供应商适配配置不存在')

    const target: LiveSwitchTarget = {
      appType: input.appType,
      providerKey: input.key,
      providerId: recordKey.id,
      source: recordKey.source
    }
    const transaction = switchLiveConfig(
      input.appType,
      stored.settingsConfig,
      this.options.livePaths,
      target
    )
    try {
      transaction.beginStateCommit()
      this.applyActivationState(target)
    } catch (error) {
      transaction.rollback()
      throw error
    }
    transaction.commit()
  }

  resolveProxyTarget(
    providerKey: string,
    appType: 'claude' | 'codex' | 'gemini'
  ): RoutingProxyTarget | undefined {
    const provider = this.getSnapshot().providers.find((item) => item.key === providerKey)
    const adapter = provider?.applications.find((item) => item.appType === appType)
    if (!provider || !adapter?.baseUrl) return undefined
    const recordKey = parseProviderKey(adapter.recordKey)
    if (!recordKey) return undefined
    const stored = recordKey.source === 'sookool'
      ? this.readLocalStore().providers.find((item) => item.id === recordKey.id && item.appType === appType)
      : this.readCcSwitchProvider(recordKey)
    if (!stored) return undefined
    return {
      providerKey,
      providerId: recordKey.id,
      providerName: provider.name,
      appType,
      source: recordKey.source,
      baseUrl: adapter.baseUrl,
      model: adapter.model ?? '',
      apiKey: extractProviderSecret(stored.settingsConfig, appType),
      requiresProxy: Boolean(adapter.requiresProxy)
    }
  }

  setProxyTakeover(
    appType: 'claude' | 'codex' | 'gemini',
    proxyOrigin?: string
  ): void {
    if (!this.options.livePaths) throw new Error('实时配置路径未配置')
    const snapshot = this.getSnapshot()
    const currentKey = snapshot.apps.find((app) => app.id === appType)?.currentProviderKey
    if (!currentKey) throw new Error(`${appType} 尚未激活供应商`)
    const provider = snapshot.providers.find((item) => item.key === currentKey)
    const adapter = provider?.applications.find((item) => item.appType === appType)
    if (!provider || !adapter) throw new Error('当前供应商适配配置不存在')
    if (proxyOrigin && adapter.requiresProxy) {
      throw new Error('该供应商需要 CC-Switch 的协议转换，SooKool 本地路由暂不支持接管')
    }
    const recordKey = parseProviderKey(adapter.recordKey)
    if (!recordKey) throw new Error('供应商适配配置损坏')
    const stored = recordKey.source === 'sookool'
      ? this.readLocalStore().providers.find((item) => item.id === recordKey.id && item.appType === appType)
      : this.readCcSwitchProvider(recordKey)
    if (!stored) throw new Error('供应商适配配置不存在')
    const settings = proxyOrigin
      ? buildSettingsConfig({
          name: provider.name,
          appType,
          baseUrl: proxyEndpoint(proxyOrigin, appType),
          wireApi: 'responses'
        }, stored.settingsConfig)
      : stored.settingsConfig
    const transaction = switchLiveConfig(appType, settings, this.options.livePaths)
    transaction.commit()
  }

  private applyActivationState(target: LiveSwitchTarget): void {
    if (target.source === 'cc-switch') {
      const store = this.readLocalStore()
      if (store.activations?.[target.appType]) {
        const { [target.appType]: _removed, ...activations } = store.activations
        try {
          this.writeLocalStore({ ...store, activations })
          this.setCcSwitchCurrent({ id: target.providerId, appType: target.appType })
        } catch (error) {
          this.writeLocalStore(store)
          throw error
        }
      } else {
        this.setCcSwitchCurrent({ id: target.providerId, appType: target.appType })
      }
      return
    }
    const store = this.readLocalStore()
    store.activations = { ...store.activations, [target.appType]: target.providerKey }
    this.writeLocalStore(store)
  }

  private setCcSwitchCurrent(record: { id: string; appType: RoutingAppType }): void {
    const database = new DatabaseSync(this.options.ccSwitchDbPath)
    try {
      database.exec('BEGIN IMMEDIATE')
      try {
        database.prepare('UPDATE providers SET is_current = 0 WHERE app_type = ?').run(record.appType)
        const result = database.prepare('UPDATE providers SET is_current = 1 WHERE id = ? AND app_type = ?')
          .run(record.id, record.appType)
        if (result.changes !== 1) throw new Error('供应商状态已变更')
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    } finally {
      database.close()
    }
  }

  saveProvider(input: RoutingProviderInput): RoutingProviderSummary {
    if (!input) throw new Error('无效的供应商数据')
    if (typeof input.name !== 'string') throw new Error('供应商名称不能为空')
    const store = this.readLocalStore()
    const groupKey = parseProviderGroupKey(input.key)
    if (groupKey) return this.saveProviderGroup(store, input, groupKey)
    if (!input.key && input.applications?.length) {
      return this.saveProviderGroup(store, input, { source: 'sookool', identity: randomUUID() })
    }
    if (!isRoutingAppType(String(input.appType))) throw new Error('无效的应用类型')
    const appType = input.appType as RoutingAppType
    const sourceKey = parseProviderKey(input.key)
    const existingIndex = sourceKey?.source === 'sookool'
      ? store.providers.findIndex((provider) =>
          provider.id === sourceKey.id && provider.appType === sourceKey.appType)
      : -1
    const existing = existingIndex >= 0 ? store.providers[existingIndex] : undefined
    const sourceProvider = existing
      ?? (sourceKey?.source === 'cc-switch' ? this.readCcSwitchProvider(sourceKey) : undefined)
    const now = Date.now()
    const id = existing?.id ?? input.id?.trim() ?? sourceKey?.id ?? randomUUID()
    const provider: StoredProvider = {
      id: uniqueLocalId(store.providers, appType, id, existing?.id),
      appType,
      name: input.name.trim(),
      settingsConfig: buildSettingsConfig(input, sourceProvider?.settingsConfig),
      websiteUrl: resolveOptionalField(input.websiteUrl, sourceProvider?.websiteUrl),
      apiKeyUrl: resolveOptionalField(input.apiKeyUrl, sourceProvider?.apiKeyUrl),
      apiKeyField: input.apiKeyField ?? sourceProvider?.apiKeyField,
      category: input.category === undefined
        ? sourceProvider?.category ?? 'custom'
        : cleanOptional(input.category) ?? 'custom',
      notes: resolveOptionalField(input.notes, sourceProvider?.notes),
      icon: resolveOptionalField(input.icon, sourceProvider?.icon),
      iconColor: resolveOptionalField(input.iconColor, sourceProvider?.iconColor),
      requiresProxy: sourceProvider?.requiresProxy,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now
    }

    if (!provider.name) throw new Error('供应商名称不能为空')
    if (existingIndex >= 0) store.providers.splice(existingIndex, 1, provider)
    else store.providers.push(provider)
    this.writeLocalStore(store)
    return toSummary(provider, 'sookool')
  }

  private saveProviderGroup(
    store: LocalStore,
    input: RoutingProviderInput,
    groupKey: { source: RoutingProviderSource; identity: string }
  ): RoutingProviderSummary {
    const sources = groupKey.source === 'sookool'
      ? store.providers.filter((provider) => provider.id === groupKey.identity)
      : this.readCcSwitchStoredProviders().filter((provider) =>
          normalizeProviderIdentity(provider.name) === groupKey.identity)
    if (sources.length === 0 && groupKey.source !== 'sookool') throw new Error('供应商不存在')

    const requestedApps = input.applications?.filter((app, index, all) =>
      isRoutingAppType(app) && all.indexOf(app) === index)
    const appTypes = requestedApps?.length
      ? requestedApps
      : sources.map((provider) => provider.appType)
    const localId = groupKey.source === 'sookool'
      ? groupKey.identity
      : uniqueLocalGroupId(store.providers, groupKey.identity)
    const now = Date.now()
    const nextProviders = appTypes.map((appType) => {
      const source = sources.find((provider) => provider.appType === appType)
      return {
        id: localId,
        appType,
        name: input.name.trim(),
        settingsConfig: buildSettingsConfig({
          ...input,
          ...input.applicationConfigs?.[appType],
          appType
        }, source?.settingsConfig),
        websiteUrl: resolveOptionalField(input.websiteUrl, source?.websiteUrl),
        apiKeyUrl: resolveOptionalField(input.apiKeyUrl, source?.apiKeyUrl),
        apiKeyField: input.apiKeyField ?? source?.apiKeyField,
        category: input.category === undefined
          ? source?.category ?? 'custom'
          : cleanOptional(input.category) ?? 'custom',
        notes: resolveOptionalField(input.notes, source?.notes),
        icon: resolveOptionalField(input.icon, source?.icon),
        iconColor: resolveOptionalField(input.iconColor, source?.iconColor),
        requiresProxy: source?.requiresProxy,
        createdAt: groupKey.source === 'sookool' ? source?.createdAt ?? now : now,
        updatedAt: now
      } satisfies StoredProvider
    })
    if (!input.name.trim()) throw new Error('供应商名称不能为空')
    store.providers = [
      ...store.providers.filter((provider) => provider.id !== localId),
      ...nextProviders
    ]
    this.writeLocalStore(store)
    const grouped = groupProviderRecords(nextProviders.map((provider) => toSummary(provider, 'sookool')))[0]
    if (!grouped) throw new Error('供应商保存失败')
    return grouped
  }

  async deleteProvider(input: DeleteRoutingProviderInput): Promise<void> {
    const group = parseProviderGroupKey(input.key)
    if (group) {
      if (group.source === 'sookool') {
        const store = this.readLocalStore()
        const providers = store.providers.filter((provider) => provider.id !== group.identity)
        if (providers.length === store.providers.length) throw new Error('供应商不存在')
        const activations = Object.fromEntries(Object.entries(store.activations ?? {})
          .filter(([, key]) => key !== input.key)) as LocalStore['activations']
        this.writeLocalStore({ ...store, providers, activations })
        return
      }
      const records = this.readCcSwitchStoredProviders().filter((provider) =>
        normalizeProviderIdentity(provider.name) === group.identity)
      if (!records.length) throw new Error('供应商不存在')
      const summary = this.getSnapshot().providers.find((provider) => provider.key === input.key)
      if (summary?.applications.some((application) => application.isCurrent)) {
        throw new Error('不能删除当前供应商，请先切换到其他供应商')
      }
      for (const record of records) {
        await this.deleteProvider({ key: `cc-switch:${record.appType}:${record.id}` })
      }
      return
    }
    const parsed = parseProviderKey(input.key)
    if (!parsed) throw new Error('无效的供应商标识')

    if (parsed.source === 'sookool') {
      const store = this.readLocalStore()
      const providers = store.providers.filter((provider) =>
        provider.id !== parsed.id || provider.appType !== parsed.appType)
      if (providers.length === store.providers.length) throw new Error('供应商不存在')
      this.writeLocalStore({ ...store, providers })
      return
    }

    if (!existsSync(this.options.ccSwitchDbPath)) throw new Error('CC-Switch 数据库不存在')
    const database = new DatabaseSync(this.options.ccSwitchDbPath)
    try {
      database.exec('PRAGMA foreign_keys = ON')
      const row = getDeletionCandidate(database, parsed.id, parsed.appType)
      if (!row) throw new Error('供应商不存在')
      if (Boolean(row.is_current)) throw new Error('不能删除当前供应商，请先切换到其他供应商')

      const backupDir = this.options.ccSwitchBackupDir
        ?? join(dirname(this.options.localStorePath), 'backups', 'cc-switch')
      mkdirPrivate(backupDir)
      const backupPath = join(
        backupDir,
        `cc-switch-before-delete-${Date.now()}-${randomUUID()}.db`
      )
      await backup(database, backupPath)
      chmodSync(backupPath, 0o600)

      database.exec('BEGIN IMMEDIATE')
      try {
        const lockedRow = getDeletionCandidate(database, parsed.id, parsed.appType)
        if (!lockedRow) throw new Error('供应商不存在')
        if (Boolean(lockedRow.is_current)) {
          throw new Error('不能删除当前供应商，请先切换到其他供应商')
        }
        database.prepare('DELETE FROM providers WHERE id = ? AND app_type = ?')
          .run(parsed.id, parsed.appType)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
    } finally {
      database.close()
    }
  }

  private readCcSwitchProviders(): RoutingProviderSummary[] {
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      const rows = database.prepare(`
        SELECT id, app_type, name, settings_config, website_url, category, created_at,
               notes, icon, icon_color, meta, is_current, in_failover_queue
        FROM providers
        ORDER BY COALESCE(sort_index, 999999), created_at ASC, id ASC
      `).all() as unknown as CcSwitchProviderRow[]

      return rows.flatMap((row) => {
        if (!isRoutingAppType(row.app_type)) return []
        return [toSummary({
          id: row.id,
          appType: row.app_type,
          name: row.name,
          settingsConfig: parseObject(row.settings_config),
          websiteUrl: row.website_url ?? undefined,
          apiKeyUrl: undefined,
          apiKeyField: undefined,
          category: row.category ?? undefined,
          notes: row.notes ?? undefined,
          icon: row.icon ?? undefined,
          iconColor: row.icon_color ?? undefined,
          requiresProxy: ccSwitchMetaRequiresProxy(row.meta, row.app_type),
          createdAt: row.created_at ?? 0,
          updatedAt: row.created_at ?? 0
        }, 'cc-switch', Boolean(row.is_current), Boolean(row.in_failover_queue))]
      })
    } finally {
      database.close()
    }
  }

  private readCcSwitchProvider(input: {
    appType: RoutingAppType
    id: string
  }): StoredProvider | undefined {
    if (!existsSync(this.options.ccSwitchDbPath)) return undefined
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      const row = database.prepare(
        `SELECT id, app_type, name, settings_config, website_url, category, created_at,
                notes, icon, icon_color, meta
         FROM providers WHERE id = ? AND app_type = ?`
      ).get(input.id, input.appType) as CcSwitchProviderRow | undefined
      if (!row || !isRoutingAppType(row.app_type)) return undefined
      return {
        id: row.id,
        appType: row.app_type,
        name: row.name,
        settingsConfig: parseObject(row.settings_config),
        websiteUrl: row.website_url ?? undefined,
        category: row.category ?? undefined,
        notes: row.notes ?? undefined,
        icon: row.icon ?? undefined,
        iconColor: row.icon_color ?? undefined,
        requiresProxy: ccSwitchMetaRequiresProxy(row.meta, row.app_type),
        createdAt: row.created_at ?? 0,
        updatedAt: row.created_at ?? 0
      }
    } finally {
      database.close()
    }
  }

  private readCcSwitchStoredProviders(): StoredProvider[] {
    if (!existsSync(this.options.ccSwitchDbPath)) return []
    const database = new DatabaseSync(this.options.ccSwitchDbPath, { readOnly: true })
    try {
      const rows = database.prepare(`
        SELECT id, app_type, name, settings_config, website_url, category, created_at,
               notes, icon, icon_color, meta
        FROM providers
      `).all() as unknown as CcSwitchProviderRow[]
      return rows.flatMap((row) => isRoutingAppType(row.app_type) ? [{
        id: row.id,
        appType: row.app_type,
        name: row.name,
        settingsConfig: parseObject(row.settings_config),
        websiteUrl: row.website_url ?? undefined,
        category: row.category ?? undefined,
        notes: row.notes ?? undefined,
        icon: row.icon ?? undefined,
        iconColor: row.icon_color ?? undefined,
        requiresProxy: ccSwitchMetaRequiresProxy(row.meta, row.app_type),
        createdAt: row.created_at ?? 0,
        updatedAt: row.created_at ?? 0
      }] : [])
    } finally {
      database.close()
    }
  }

  private readLocalStore(): LocalStore {
    if (!existsSync(this.options.localStorePath)) return createEmptyStore()
    try {
      const value = JSON.parse(readFileSync(this.options.localStorePath, 'utf8')) as Partial<LocalStore>
      if (value.schemaVersion !== 1 || !Array.isArray(value.providers)
        || !value.providers.every(isStoredProvider)) {
        throw new Error('invalid schema')
      }
      return {
        schemaVersion: 1,
        providers: value.providers,
        activations: value.activations
      }
    } catch (error) {
      throw new Error(`本地模型路由数据损坏，请先恢复 ${this.options.localStorePath}`, {
        cause: error
      })
    }
  }

  private writeLocalStore(store: LocalStore): void {
    const directory = dirname(this.options.localStorePath)
    mkdirPrivate(directory)
    const temporaryPath = `${this.options.localStorePath}.tmp-${randomUUID()}`
    try {
      writeFileSync(temporaryPath, `${JSON.stringify(store, null, 2)}\n`, {
        encoding: 'utf8',
        mode: 0o600,
        flag: 'wx'
      })
      chmodSync(temporaryPath, 0o600)
      renameSync(temporaryPath, this.options.localStorePath)
      chmodSync(this.options.localStorePath, 0o600)
    } catch (error) {
      if (existsSync(temporaryPath)) unlinkSync(temporaryPath)
      throw error
    }
  }
}

function mkdirPrivate(path: string): void {
  mkdirSync(path, { recursive: true, mode: 0o700 })
  chmodSync(path, 0o700)
}

function getDeletionCandidate(
  database: DatabaseSync,
  id: string,
  appType: RoutingAppType
): { is_current: number } | undefined {
  return database.prepare(
    'SELECT is_current FROM providers WHERE id = ? AND app_type = ?'
  ).get(id, appType) as { is_current: number } | undefined
}

function createEmptyStore(): LocalStore {
  return { schemaVersion: 1, providers: [] }
}

function applyLocalActivations(
  providers: RoutingProviderSummary[],
  activations?: Partial<Record<RoutingAppType, string>>
): RoutingProviderSummary[] {
  if (!activations) return providers
  return providers.map((provider) => {
    const applications = provider.applications.map((application) => ({
      ...application,
      isCurrent: activations[application.appType]
        ? activations[application.appType] === provider.key
        : application.isCurrent
    }))
    return { ...provider, applications, isCurrent: applications.some((item) => item.isCurrent) }
  })
}

function readCcSwitchCurrentIds(path: string): Partial<Record<RoutingAppType, string>> | undefined {
  if (!existsSync(path)) return undefined
  try {
    const value = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    return Object.fromEntries(routingAppTypes.flatMap((appType) => {
      const id = value[`current_provider_${appType.replace('-', '_')}`]
      return typeof id === 'string' && id ? [[appType, id]] : []
    }))
  } catch {
    return undefined
  }
}

function applyCcSwitchDeviceState(
  providers: RoutingProviderSummary[],
  currentIds?: Partial<Record<RoutingAppType, string>>
): RoutingProviderSummary[] {
  if (!currentIds) return providers
  return providers.map((provider) => {
    if (provider.source !== 'cc-switch') return provider
    const applications = provider.applications.map((application) => {
      const currentId = currentIds[application.appType]
      const record = parseProviderKey(application.recordKey)
      return { ...application, isCurrent: currentId ? record?.id === currentId : application.isCurrent }
    })
    return { ...provider, applications, isCurrent: applications.some((item) => item.isCurrent) }
  })
}


function toSummary(
  provider: StoredProvider,
  source: RoutingProviderSource,
  isCurrent = false,
  inFailoverQueue = false
): RoutingProviderSummary {
  const flattened = flattenSettings(provider.settingsConfig)
  return {
    key: `${source}:${provider.appType}:${provider.id}`,
    id: provider.id,
    appType: provider.appType,
    source,
    name: provider.name,
    category: provider.category,
    websiteUrl: provider.websiteUrl,
    apiKeyUrl: provider.apiKeyUrl,
    notes: provider.notes,
    icon: provider.icon,
    iconColor: provider.iconColor,
    baseUrl: flattened.baseUrl,
    model: flattened.model,
    defaultHaikuModel: flattened.defaultHaikuModel,
    defaultSonnetModel: flattened.defaultSonnetModel,
    defaultOpusModel: flattened.defaultOpusModel,
    apiKeyField: provider.apiKeyField ?? flattened.apiKeyField,
    hasSecret: flattened.hasSecret,
    isCurrent,
    inFailoverQueue,
    createdAt: provider.createdAt,
    updatedAt: provider.updatedAt,
    applications: [{
      appType: provider.appType,
      recordKey: `${source}:${provider.appType}:${provider.id}`,
      baseUrl: flattened.baseUrl,
      model: flattened.model,
      wireApi: flattened.wireApi,
      defaultHaikuModel: flattened.defaultHaikuModel,
      defaultSonnetModel: flattened.defaultSonnetModel,
      defaultOpusModel: flattened.defaultOpusModel,
      autoCompactWindow: flattened.autoCompactWindow,
      apiTimeoutMs: flattened.apiTimeoutMs,
      disableNonessentialTraffic: flattened.disableNonessentialTraffic,
      requiresProxy: provider.requiresProxy || flattened.requiresProxy,
      hasSecret: flattened.hasSecret,
      isCurrent,
      inFailoverQueue
    }]
  }
}

function groupProviderRecords(records: RoutingProviderSummary[]): RoutingProviderSummary[] {
  const groups = new Map<string, RoutingProviderSummary>()
  for (const record of records) {
    const identity = record.source === 'sookool'
      ? record.id
      : normalizeProviderIdentity(record.name)
    const groupKey = `${record.source}:provider:${identity}`
    const existing = groups.get(groupKey)
    if (!existing) {
      groups.set(groupKey, { ...record, key: groupKey, applications: [...record.applications] })
      continue
    }
    existing.applications.push(...record.applications)
    existing.hasSecret ||= record.hasSecret
    existing.isCurrent ||= record.isCurrent
    existing.inFailoverQueue ||= record.inFailoverQueue
    existing.baseUrl ??= record.baseUrl
    existing.model ??= record.model
    existing.websiteUrl ??= record.websiteUrl
    existing.apiKeyUrl ??= record.apiKeyUrl
    existing.notes ??= record.notes
    existing.icon ??= record.icon
    existing.iconColor ??= record.iconColor
  }
  return [...groups.values()].map((provider) => ({
    ...provider,
    applications: provider.applications.sort(
      (left, right) => routingAppTypes.indexOf(left.appType) - routingAppTypes.indexOf(right.appType)
    )
  }))
}

function normalizeProviderIdentity(name: string): string {
  return name.trim().toLocaleLowerCase().replace(/[^a-z0-9\p{L}\p{N}]+/gu, '-')
}

function flattenSettings(value: unknown): {
  baseUrl?: string
  model?: string
  defaultHaikuModel?: string
  defaultSonnetModel?: string
  defaultOpusModel?: string
  wireApi?: RoutingProviderSummary['applications'][number]['wireApi']
  apiKeyField?: RoutingProviderSummary['apiKeyField']
  autoCompactWindow?: string
  apiTimeoutMs?: string
  disableNonessentialTraffic?: boolean
  requiresProxy: boolean
  hasSecret: boolean
} {
  let baseUrl: string | undefined
  let model: string | undefined
  let defaultHaikuModel: string | undefined
  let defaultSonnetModel: string | undefined
  let defaultOpusModel: string | undefined
  let wireApi: RoutingProviderSummary['applications'][number]['wireApi']
  let apiKeyField: RoutingProviderSummary['apiKeyField']
  let autoCompactWindow: string | undefined
  let apiTimeoutMs: string | undefined
  let disableNonessentialTraffic: boolean | undefined
  let requiresProxy = false
  let hasSecret = false

  const visit = (candidate: unknown, key = ''): void => {
    const normalizedKey = key.replaceAll('_', '').replaceAll('-', '').toLowerCase()
    if (normalizedKey === 'claudecodedisablenonessentialtraffic'
      && (typeof candidate === 'boolean' || typeof candidate === 'number')) {
      disableNonessentialTraffic = Boolean(candidate)
      return
    }
    if (typeof candidate === 'string') {
      const normalized = normalizedKey
      if (normalized === 'config') {
        baseUrl ??= matchTomlString(candidate, 'base_url')
        model ??= matchTomlString(candidate, 'model')
        const foundWireApi = matchTomlString(candidate, 'wire_api')
        if (foundWireApi === 'responses') wireApi = foundWireApi
        if (foundWireApi === 'chat') requiresProxy = true
      }
      if (!baseUrl && (normalized.includes('baseurl') || normalized === 'host')) baseUrl = candidate
      if (!model && (normalized === 'model' || normalized === 'anthropicmodel' || normalized === 'geminimodel')) model = candidate
      if (normalized === 'anthropicdefaulthaikumodel') defaultHaikuModel = candidate
      if (normalized === 'anthropicdefaultsonnetmodel') defaultSonnetModel = candidate
      if (normalized === 'anthropicdefaultopusmodel') defaultOpusModel = candidate
      if (normalized === 'claudecodeautocompactwindow') autoCompactWindow = candidate
      if (normalized === 'apitimeoutms') apiTimeoutMs = candidate
      if (normalized === 'anthropicauthtoken') apiKeyField = 'ANTHROPIC_AUTH_TOKEN'
      if (normalized === 'anthropicapikey') apiKeyField = 'ANTHROPIC_API_KEY'
      if (/(apikey|authtoken|accesstoken|secret|password)/i.test(normalized) && candidate.trim()) {
        hasSecret = true
      }
      return
    }
    if (Array.isArray(candidate)) {
      candidate.forEach((item) => visit(item, key))
      return
    }
    if (candidate && typeof candidate === 'object') {
      Object.entries(candidate).forEach(([childKey, child]) => visit(child, childKey))
    }
  }

  visit(value)
  return {
    baseUrl,
    model,
    defaultHaikuModel,
    defaultSonnetModel,
    defaultOpusModel,
    wireApi,
    apiKeyField,
    autoCompactWindow,
    apiTimeoutMs,
    disableNonessentialTraffic,
    requiresProxy,
    hasSecret
  }
}

function buildAppSummaries(providers: RoutingProviderSummary[]): RoutingAppSummary[] {
  return routingAppTypes.map((id) => {
    const matches = providers.filter((provider) =>
      provider.applications.some((application) => application.appType === id))
    const current = matches.find((provider) =>
      provider.applications.some((application) => application.appType === id && application.isCurrent))
    return {
      id,
      providerCount: matches.length,
      currentProviderKey: current?.key,
      currentProviderName: current?.name
    }
  })
}

function parseObject(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function ccSwitchMetaRequiresProxy(value: string, appType: RoutingAppType): boolean {
  const apiFormat = parseObject(value).apiFormat
  if (typeof apiFormat !== 'string') return false
  if (appType === 'claude' || appType === 'claude-desktop') return apiFormat !== 'anthropic'
  if (appType === 'codex') return apiFormat !== 'openai_responses'
  if (appType === 'gemini') return apiFormat !== 'gemini_native'
  return false
}

function isRoutingAppType(value: string): value is RoutingAppType {
  return routingAppTypes.includes(value as RoutingAppType)
}

function isStoredProvider(value: unknown): value is StoredProvider {
  if (!value || typeof value !== 'object') return false
  const provider = value as Partial<StoredProvider>
  return typeof provider.id === 'string'
    && isRoutingAppType(String(provider.appType))
    && typeof provider.name === 'string'
    && Boolean(provider.settingsConfig && typeof provider.settingsConfig === 'object')
    && typeof provider.createdAt === 'number'
    && typeof provider.updatedAt === 'number'
}

function buildSettingsConfig(
  input: RoutingProviderInput & RoutingProviderAppConfig,
  existing?: Record<string, unknown>
): Record<string, unknown> {
  const settings = existing ? structuredClone(existing) : {}
  const apiKey = cleanOptional(input.apiKey)
  const baseUrl = cleanOptional(input.baseUrl)
  const model = cleanOptional(input.model)

  if (input.appType === 'claude' || input.appType === 'claude-desktop') {
    const env = ensureObject(settings, 'env')
    if (input.baseUrl !== undefined) setOptionalString(env, 'ANTHROPIC_BASE_URL', baseUrl)
    if (input.apiKeyField !== undefined && apiKey) {
      delete env.ANTHROPIC_AUTH_TOKEN
      delete env.ANTHROPIC_API_KEY
      env[input.apiKeyField] = apiKey
    } else if (apiKey) {
      setKnownSecret(env, ['ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_API_KEY'], apiKey)
    }
    if (input.model !== undefined) {
      if (typeof settings.model === 'string') setOptionalString(settings, 'model', model)
      else setOptionalString(env, 'ANTHROPIC_MODEL', model)
    }
    if (input.defaultHaikuModel !== undefined) {
      setOptionalString(env, 'ANTHROPIC_DEFAULT_HAIKU_MODEL', cleanOptional(input.defaultHaikuModel))
    }
    if (input.defaultSonnetModel !== undefined) {
      setOptionalString(env, 'ANTHROPIC_DEFAULT_SONNET_MODEL', cleanOptional(input.defaultSonnetModel))
    }
    if (input.defaultOpusModel !== undefined) {
      setOptionalString(env, 'ANTHROPIC_DEFAULT_OPUS_MODEL', cleanOptional(input.defaultOpusModel))
    }
    if (input.autoCompactWindow !== undefined) {
      setOptionalString(env, 'CLAUDE_CODE_AUTO_COMPACT_WINDOW', cleanOptional(input.autoCompactWindow))
    }
    if (input.apiTimeoutMs !== undefined) {
      setOptionalString(env, 'API_TIMEOUT_MS', cleanOptional(input.apiTimeoutMs))
    }
    if (input.disableNonessentialTraffic !== undefined) {
      if (input.disableNonessentialTraffic) env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = 1
      else delete env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC
    }
    return settings
  }
  if (input.appType === 'codex') {
    const wireApi = 'responses'
    const defaultConfigLines = [
      'model_provider = "sookool"',
      ...(model ? [`model = "${escapeTomlString(model)}"`] : []),
      '',
      '[model_providers.sookool]',
      `name = "${escapeTomlString(input.name.trim() || 'SooKool')}"`,
      ...(baseUrl ? [`base_url = "${escapeTomlString(baseUrl)}"`] : []),
      `wire_api = "${wireApi}"`
    ]
    const auth = ensureObject(settings, 'auth')
    if (apiKey) setKnownSecret(auth, ['OPENAI_API_KEY'], apiKey)
    let config = typeof settings.config === 'string' ? settings.config : defaultConfigLines.join('\n')
    if (input.baseUrl !== undefined) {
      const activeProvider = matchTomlString(config, 'model_provider') ?? 'sookool'
      config = patchTomlSectionString(
        config,
        `model_providers.${activeProvider}`,
        'base_url',
        baseUrl
      )
    }
    if (input.model !== undefined) config = patchTomlString(config, 'model', model)
    if (input.wireApi !== undefined) {
      const activeProvider = matchTomlString(config, 'model_provider') ?? 'sookool'
      config = patchTomlSectionString(config, `model_providers.${activeProvider}`, 'wire_api', wireApi)
    }
    settings.config = config
    return settings
  }
  if (input.appType === 'gemini') {
    const env = ensureObject(settings, 'env')
    if (input.baseUrl !== undefined) setOptionalString(env, 'GOOGLE_GEMINI_BASE_URL', baseUrl)
    if (apiKey) setKnownSecret(env, ['GEMINI_API_KEY', 'GOOGLE_API_KEY'], apiKey)
    if (input.model !== undefined) setOptionalString(env, 'GEMINI_MODEL', model)
    return settings
  }
  if (input.baseUrl !== undefined) setOptionalString(settings, 'baseUrl', baseUrl)
  if (apiKey) setKnownSecret(settings, ['apiKey'], apiKey)
  if (input.model !== undefined) setOptionalString(settings, 'model', model)
  return settings
}

function extractProviderSecret(
  settings: Record<string, unknown>,
  appType: 'claude' | 'codex' | 'gemini'
): string | undefined {
  const env = settings.env && typeof settings.env === 'object'
    ? settings.env as Record<string, unknown>
    : {}
  const auth = settings.auth && typeof settings.auth === 'object'
    ? settings.auth as Record<string, unknown>
    : {}
  const candidates = appType === 'claude'
    ? [env.ANTHROPIC_AUTH_TOKEN, env.ANTHROPIC_API_KEY]
    : appType === 'codex'
      ? [auth.OPENAI_API_KEY]
      : [env.GEMINI_API_KEY, env.GOOGLE_API_KEY]
  return candidates.find((value): value is string => typeof value === 'string' && Boolean(value.trim()))
}

function proxyEndpoint(origin: string, appType: 'claude' | 'codex' | 'gemini'): string {
  const normalized = origin.replace(/\/+$/, '')
  if (appType === 'codex') return `${normalized}/codex/v1`
  return `${normalized}/${appType}`
}

function parseProviderKey(key?: string): {
  source: RoutingProviderSource
  appType: RoutingAppType
  id: string
} | undefined {
  if (!key) return undefined
  const [source, appType, ...idParts] = key.split(':')
  if ((source !== 'cc-switch' && source !== 'sookool') || !isRoutingAppType(appType)) {
    return undefined
  }
  const id = idParts.join(':')
  return id ? { source, appType, id } : undefined
}

function parseProviderGroupKey(key?: string): {
  source: RoutingProviderSource
  identity: string
} | undefined {
  if (!key) return undefined
  const [source, marker, ...identityParts] = key.split(':')
  if ((source !== 'cc-switch' && source !== 'sookool') || marker !== 'provider') return undefined
  const identity = identityParts.join(':')
  return identity ? { source, identity } : undefined
}

function uniqueLocalGroupId(providers: StoredProvider[], preferredId: string): string {
  if (!providers.some((provider) => provider.id === preferredId)) return preferredId
  let suffix = 2
  while (providers.some((provider) => provider.id === `${preferredId}-${suffix}`)) suffix += 1
  return `${preferredId}-${suffix}`
}

function uniqueLocalId(
  providers: StoredProvider[],
  appType: RoutingAppType,
  preferredId: string,
  currentId?: string
): string {
  const normalized = preferredId.trim() || randomUUID()
  if (normalized === currentId
    || !providers.some((provider) => provider.appType === appType && provider.id === normalized)) {
    return normalized
  }
  let suffix = 2
  while (providers.some((provider) =>
    provider.appType === appType && provider.id === `${normalized}-${suffix}`)) suffix += 1
  return `${normalized}-${suffix}`
}

function cleanOptional(value?: string): string | undefined {
  const trimmed = value?.trim()
  return trimmed || undefined
}

function resolveOptionalField(input: string | undefined, existing?: string): string | undefined {
  return input === undefined ? existing : cleanOptional(input)
}

function matchTomlString(toml: string, key: string): string | undefined {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = toml.match(new RegExp(`^\\s*${escapedKey}\\s*=\\s*"((?:\\\\.|[^"\\\\])*)"`, 'm'))
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, '\\')
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')
}

function ensureObject(parent: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = parent[key]
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  const created: Record<string, unknown> = {}
  parent[key] = created
  return created
}

function setOptionalString(
  target: Record<string, unknown>,
  key: string,
  value?: string
): void {
  if (value) target[key] = value
  else delete target[key]
}

function setKnownSecret(
  target: Record<string, unknown>,
  keys: string[],
  value: string
): void {
  const existingKey = keys.find((key) => typeof target[key] === 'string') ?? keys[0]
  target[existingKey] = value
}

function patchTomlString(toml: string, key: string, value?: string): string {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const pattern = new RegExp(`^(\\s*${escapedKey}\\s*=\\s*)"(?:\\\\.|[^"\\\\])*"\\s*$`, 'm')
  if (!value) return toml.replace(pattern, '').replace(/\n{3,}/g, '\n\n').trim()
  const assignment = `${key} = "${escapeTomlString(value)}"`
  if (pattern.test(toml)) return toml.replace(pattern, assignment)
  return `${assignment}\n${toml}`.trim()
}

function patchTomlSectionString(
  toml: string,
  section: string,
  key: string,
  value?: string
): string {
  const escapedSection = section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const headerPattern = new RegExp(`^\\s*\\[${escapedSection}\\]\\s*$`, 'm')
  const headerMatch = headerPattern.exec(toml)
  if (!headerMatch) {
    if (!value) return toml
    return `${toml.trim()}\n\n[${section}]\n${key} = "${escapeTomlString(value)}"`
  }

  const sectionStart = headerMatch.index + headerMatch[0].length
  const remainder = toml.slice(sectionStart)
  const nextHeaderOffset = remainder.search(/^\s*\[[^\]]+\]\s*$/m)
  const sectionEnd = nextHeaderOffset >= 0 ? sectionStart + nextHeaderOffset : toml.length
  const before = toml.slice(0, sectionStart)
  const body = toml.slice(sectionStart, sectionEnd)
  const after = toml.slice(sectionEnd)
  const patchedBody = patchTomlString(body, key, value)
  return `${before}\n${patchedBody}${patchedBody ? '\n' : ''}${after.replace(/^\n+/, '')}`.trim()
}
