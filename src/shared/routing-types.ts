export const routingAppTypes = [
  'claude',
  'claude-desktop',
  'codex',
  'gemini',
  'opencode',
  'openclaw',
  'hermes'
] as const

export type RoutingAppType = (typeof routingAppTypes)[number]
export type RoutingProviderSource = 'cc-switch' | 'sookool'
export type RoutingApiKeyField = 'ANTHROPIC_AUTH_TOKEN' | 'ANTHROPIC_API_KEY'
export type RoutingWireApi = 'responses'

export interface RoutingProviderAppConfig {
  baseUrl?: string
  model?: string
  wireApi?: RoutingWireApi
  defaultHaikuModel?: string
  defaultSonnetModel?: string
  defaultOpusModel?: string
  autoCompactWindow?: string
  apiTimeoutMs?: string
  disableNonessentialTraffic?: boolean
}

export interface RoutingProviderApplication {
  appType: RoutingAppType
  recordKey: string
  baseUrl?: string
  model?: string
  wireApi?: RoutingWireApi
  defaultHaikuModel?: string
  defaultSonnetModel?: string
  defaultOpusModel?: string
  autoCompactWindow?: string
  apiTimeoutMs?: string
  disableNonessentialTraffic?: boolean
  requiresProxy?: boolean
  hasSecret: boolean
  isCurrent: boolean
  inFailoverQueue: boolean
}

export interface RoutingProviderSummary {
  key: string
  id: string
  appType: RoutingAppType
  source: RoutingProviderSource
  name: string
  category?: string
  websiteUrl?: string
  apiKeyUrl?: string
  notes?: string
  icon?: string
  iconColor?: string
  baseUrl?: string
  model?: string
  defaultHaikuModel?: string
  defaultSonnetModel?: string
  defaultOpusModel?: string
  apiKeyField?: RoutingApiKeyField
  hasSecret: boolean
  isCurrent: boolean
  inFailoverQueue: boolean
  createdAt?: number
  updatedAt?: number
  applications: RoutingProviderApplication[]
}

export interface RoutingAppSummary {
  id: RoutingAppType
  providerCount: number
  currentProviderKey?: string
  currentProviderName?: string
}

export interface RoutingSnapshot {
  ccSwitchAvailable: boolean
  ccSwitchDatabasePath: string
  localStorePath: string
  apps: RoutingAppSummary[]
  providers: RoutingProviderSummary[]
}

export interface RoutingProviderInput {
  key?: string
  id?: string
  appType?: RoutingAppType
  applications?: RoutingAppType[]
  applicationConfigs?: Partial<Record<RoutingAppType, RoutingProviderAppConfig>>
  name: string
  baseUrl?: string
  apiKey?: string
  model?: string
  websiteUrl?: string
  apiKeyUrl?: string
  category?: string
  defaultHaikuModel?: string
  defaultSonnetModel?: string
  defaultOpusModel?: string
  apiKeyField?: RoutingApiKeyField
  icon?: string
  iconColor?: string
  notes?: string
}

export interface DeleteRoutingProviderInput {
  key: string
}

export interface ActivateRoutingProviderInput {
  key: string
  appType: RoutingAppType
}

export const proxyRoutingAppTypes = ['claude', 'codex', 'gemini'] as const
export type ProxyRoutingAppType = (typeof proxyRoutingAppTypes)[number]

export interface RoutingProxyGlobalConfig {
  listenAddress: string
  listenPort: number
  enableLogging: boolean
}

export interface RoutingProxyAppConfig {
  appType: ProxyRoutingAppType
  enabled: boolean
  autoFailoverEnabled: boolean
  maxRetries: number
  streamingFirstByteTimeout: number
  streamingIdleTimeout: number
  nonStreamingTimeout: number
  failureThreshold: number
  successThreshold: number
  cooldownSeconds: number
  errorRateThreshold: number
  minRequests: number
  queue: string[]
}

export interface RoutingProxyActiveTarget {
  appType: ProxyRoutingAppType
  providerKey: string
  providerName: string
}

export interface RoutingProxyStatus {
  running: boolean
  address: string
  port: number
  startedAt?: number
  uptimeSeconds: number
  activeConnections: number
  totalRequests: number
  successRequests: number
  failedRequests: number
  failoverCount: number
  lastRequestAt?: number
  lastError?: string
  activeTargets: RoutingProxyActiveTarget[]
}

export interface RoutingProxySnapshot {
  global: RoutingProxyGlobalConfig
  apps: RoutingProxyAppConfig[]
  status: RoutingProxyStatus
  importedCcSwitchConfig: boolean
}

export interface UpdateRoutingProxyInput {
  global?: Partial<RoutingProxyGlobalConfig>
  app?: Partial<Omit<RoutingProxyAppConfig, 'appType'>> & { appType: ProxyRoutingAppType }
}

export interface RoutingUsageSummary {
  totalRequests: number
  successRate: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCacheReadTokens: number
  totalCacheCreationTokens: number
  totalTokens: number
  totalCostUsd: number
}

export interface RoutingUsageDaily {
  date: string
  requestCount: number
  totalTokens: number
  totalCostUsd: number
}

export interface RoutingUsageGroup {
  key: string
  name: string
  requestCount: number
  totalTokens: number
  totalCostUsd: number
  successRate: number
  averageLatencyMs: number
}

export interface RoutingUsageLog {
  requestId: string
  source: 'cc-switch' | 'sookool'
  appType: string
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

export interface RoutingUsageSnapshot {
  days: number
  appType?: ProxyRoutingAppType
  summary: RoutingUsageSummary
  daily: RoutingUsageDaily[]
  providers: RoutingUsageGroup[]
  models: RoutingUsageGroup[]
  recent: RoutingUsageLog[]
  ccSwitchAvailable: boolean
}

export interface RoutingUsageQuery {
  days?: 1 | 7 | 30
  appType?: ProxyRoutingAppType
}
