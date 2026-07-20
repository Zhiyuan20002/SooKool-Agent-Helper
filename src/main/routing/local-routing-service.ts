import { randomUUID } from 'node:crypto'
import {
  createServer,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'node:http'
import {
  proxyRoutingAppTypes,
  type ProxyRoutingAppType,
  type RoutingProxyAppConfig,
  type RoutingProxySnapshot,
  type RoutingSnapshot,
  type RoutingUsageQuery,
  type RoutingUsageSnapshot,
  type UpdateRoutingProxyInput
} from '../../shared/routing-types.ts'
import type { RoutingOperationsRepository } from './routing-operations.ts'
import type { RoutingProxyTarget } from './routing-repository.ts'

export interface RoutingTargetRepository {
  getSnapshot(): RoutingSnapshot
  resolveProxyTarget(providerKey: string, appType: ProxyRoutingAppType): RoutingProxyTarget | undefined
  setProxyTakeover(appType: ProxyRoutingAppType, proxyOrigin?: string): void
}

interface LocalRoutingServiceOptions {
  repository: RoutingTargetRepository
  operations: RoutingOperationsRepository
}

interface TargetHealth {
  consecutiveFailures: number
  consecutiveSuccesses: number
  totalRequests: number
  failedRequests: number
  openUntil: number
  halfOpen: boolean
}

interface ParsedUsage {
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheCreationTokens: number
}

interface ForwardResult {
  response: Response
  target: RoutingProxyTarget
  bufferedBody?: Uint8Array
}

class RoutingForwardError extends Error {
  readonly target?: RoutingProxyTarget

  constructor(message: string, target?: RoutingProxyTarget) {
    super(message)
    this.target = target
  }
}

const REQUEST_LIMIT_BYTES = 50 * 1024 * 1024
const LOG_CAPTURE_LIMIT_BYTES = 4 * 1024 * 1024
const RETRYABLE_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504])
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
])

export class LocalRoutingService {
  private readonly repository: RoutingTargetRepository
  private readonly operations: RoutingOperationsRepository
  private server?: Server
  private startedAt?: number
  private activeConnections = 0
  private totalRequests = 0
  private successRequests = 0
  private failedRequests = 0
  private failoverCount = 0
  private lastRequestAt?: number
  private lastError?: string
  private readonly health = new Map<string, TargetHealth>()
  private readonly activeTargets = new Map<ProxyRoutingAppType, RoutingProxyTarget>()

  constructor(options: LocalRoutingServiceOptions) {
    this.repository = options.repository
    this.operations = options.operations
  }

  getSnapshot(): RoutingProxySnapshot {
    const config = this.operations.getConfig()
    const now = Date.now()
    const routing = this.repository.getSnapshot()
    return {
      ...config,
      status: {
        running: Boolean(this.server?.listening),
        address: config.global.listenAddress,
        port: config.global.listenPort,
        startedAt: this.startedAt,
        uptimeSeconds: this.startedAt ? Math.max(0, Math.floor((now - this.startedAt) / 1000)) : 0,
        activeConnections: this.activeConnections,
        totalRequests: this.totalRequests,
        successRequests: this.successRequests,
        failedRequests: this.failedRequests,
        failoverCount: this.failoverCount,
        lastRequestAt: this.lastRequestAt,
        lastError: this.lastError,
        activeTargets: config.apps.flatMap((app) => {
          if (!app.enabled) return []
          const runtimeTarget = this.activeTargets.get(app.appType)
          if (runtimeTarget) return [{
            appType: app.appType,
            providerKey: runtimeTarget.providerKey,
            providerName: runtimeTarget.providerName
          }]
          const current = routing.apps.find((candidate) => candidate.id === app.appType)
          return current?.currentProviderKey
            ? [{
                appType: app.appType,
                providerKey: current.currentProviderKey,
                providerName: current.currentProviderName ?? current.currentProviderKey
              }]
            : []
        })
      }
    }
  }

  async updateConfig(input: UpdateRoutingProxyInput): Promise<RoutingProxySnapshot> {
    if (input.global && input.app) throw new Error('服务设置与应用设置需要分别保存')
    const wasRunning = Boolean(this.server?.listening)
    const before = this.operations.getConfig()
    const listenChanged = Boolean(input.global && (
      input.global.listenAddress !== undefined && input.global.listenAddress !== before.global.listenAddress
      || input.global.listenPort !== undefined && input.global.listenPort !== before.global.listenPort
    ))
    if (wasRunning && listenChanged) {
      this.operations.updateConfig(input)
      try {
        await this.stop()
        return await this.start()
      } catch (error) {
        this.operations.updateConfig({ global: before.global })
        if (!this.server?.listening) {
          try { await this.start() } catch { /* surface the original reconfiguration error */ }
        }
        throw error
      }
    }
    const updated = this.operations.updateConfig(input)
    if (wasRunning && input.app) {
      const previous = before.apps.find((app) => app.appType === input.app?.appType)
      const current = updated.apps.find((app) => app.appType === input.app?.appType)
      if (previous && current && previous.enabled !== current.enabled) {
        try {
          if (current.enabled) this.applyTakeover(current.appType)
          else this.repository.setProxyTakeover(current.appType)
        } catch (error) {
          this.operations.updateConfig({ app: previous })
          throw error
        }
      }
    }
    return this.getSnapshot()
  }

  async start(): Promise<RoutingProxySnapshot> {
    if (this.server?.listening) return this.getSnapshot()
    const config = this.operations.getConfig()
    const enabledApps = config.apps.filter((app) => app.enabled)
    if (!enabledApps.length) throw new Error('请先启用至少一个应用的本地路由')

    const server = createServer((request, response) => {
      void this.handleRequest(request, response)
    })
    server.on('clientError', (error, socket) => {
      this.lastError = error.message
      if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
    })
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error): void => {
        server.off('listening', onListening)
        reject(error)
      }
      const onListening = (): void => {
        server.off('error', onError)
        resolve()
      }
      server.once('error', onError)
      server.once('listening', onListening)
      server.listen(config.global.listenPort, config.global.listenAddress)
    })
    this.server = server
    this.startedAt = Date.now()
    this.activeConnections = 0
    this.totalRequests = 0
    this.successRequests = 0
    this.failedRequests = 0
    this.failoverCount = 0
    this.lastRequestAt = undefined
    this.lastError = undefined
    this.activeTargets.clear()
    const takenOver: ProxyRoutingAppType[] = []
    try {
      for (const app of enabledApps) {
        this.applyTakeover(app.appType)
        takenOver.push(app.appType)
      }
    } catch (error) {
      for (const appType of takenOver.reverse()) {
        try { this.repository.setProxyTakeover(appType) } catch { /* preserve the original error */ }
      }
      await closeServer(server)
      this.server = undefined
      this.startedAt = undefined
      throw error
    }
    return this.getSnapshot()
  }

  async stop(): Promise<RoutingProxySnapshot> {
    const server = this.server
    const enabledApps = this.operations.getConfig().apps.filter((app) => app.enabled)
    let restoreError: unknown
    for (const app of enabledApps) {
      try {
        this.repository.setProxyTakeover(app.appType)
      } catch (error) {
        restoreError ??= error
      }
    }
    if (server) await closeServer(server)
    this.server = undefined
    this.startedAt = undefined
    this.health.clear()
    this.activeTargets.clear()
    if (restoreError) throw restoreError
    return this.getSnapshot()
  }

  refreshTakeover(appType: ProxyRoutingAppType): void {
    if (!this.server?.listening) return
    const app = this.operations.getConfig().apps.find((candidate) => candidate.appType === appType)
    if (!app?.enabled) return
    try {
      this.applyTakeover(appType)
      this.activeTargets.delete(appType)
    } catch (error) {
      this.operations.updateConfig({ app: { appType, enabled: false } })
      throw error
    }
  }

  getUsage(query: RoutingUsageQuery = {}): RoutingUsageSnapshot {
    return this.operations.getUsageSnapshot(query)
  }

  async dispose(): Promise<void> {
    if (this.server) await this.stop()
  }

  private applyTakeover(appType: ProxyRoutingAppType): void {
    const global = this.operations.getConfig().global
    const address = global.listenAddress === '::1' ? '[::1]' : global.listenAddress
    this.repository.setProxyTakeover(appType, `http://${address}:${global.listenPort}`)
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    if (request.url === '/health' || request.url === '/status') {
      sendJson(response, 200, this.getSnapshot().status)
      return
    }
    const appType = identifyApp(request.url ?? '')
    if (!appType) {
      sendJson(response, 404, { error: '无法识别本地路由应用' })
      return
    }
    const app = this.operations.getConfig().apps.find((candidate) => candidate.appType === appType)
    if (!app?.enabled) {
      sendJson(response, 503, { error: `${appType} 本地路由未启用` })
      return
    }

    const requestId = randomUUID()
    const startedAt = Date.now()
    this.activeConnections += 1
    this.totalRequests += 1
    this.lastRequestAt = startedAt
    let target: RoutingProxyTarget | undefined
    let statusCode = 502
    let errorMessage: string | undefined
    let captured: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    let requestBody: Buffer<ArrayBufferLike> = Buffer.alloc(0)
    try {
      requestBody = await readRequestBody(request)
      const result = await this.forward(request, requestBody, app)
      target = result.target
      this.activeTargets.set(appType, target)
      statusCode = result.response.status
      copyResponseHeaders(result.response.headers, response)
      response.statusCode = result.response.status
      response.statusMessage = result.response.statusText
      if (result.bufferedBody) {
        captured = Buffer.from(result.bufferedBody)
        response.end(captured)
      } else if (result.response.body) {
        const chunks: Buffer[] = []
        let capturedBytes = 0
        const idleTimeout = isStreamingRequest(request.headers, requestBody)
          ? app.streamingIdleTimeout
          : app.nonStreamingTimeout
        for await (const value of readResponseBody(result.response.body, idleTimeout)) {
          const chunk = Buffer.from(value)
          if (capturedBytes < LOG_CAPTURE_LIMIT_BYTES) {
            const slice = chunk.subarray(0, LOG_CAPTURE_LIMIT_BYTES - capturedBytes)
            chunks.push(slice)
            capturedBytes += slice.length
          }
          response.write(chunk)
        }
        captured = Buffer.concat(chunks)
        response.end()
      } else {
        response.end()
      }
      if (statusCode >= 200 && statusCode < 400) {
        this.successRequests += 1
        this.lastError = undefined
      }
      else this.failedRequests += 1
    } catch (error) {
      if (error instanceof RoutingForwardError) target = error.target
      errorMessage = error instanceof Error ? error.message : String(error)
      this.lastError = errorMessage
      this.failedRequests += 1
      if (!response.headersSent) sendJson(response, 502, { error: errorMessage, requestId })
      else response.end()
    } finally {
      this.activeConnections = Math.max(0, this.activeConnections - 1)
      if (this.operations.getConfig().global.enableLogging && target) {
        const requestUsage = extractRequestUsage(requestBody, target.model)
        const responseUsage = extractResponseUsage(captured, requestUsage.model, appType)
        const pricedUsage = {
          inputTokens: responseUsage.inputTokens,
          outputTokens: responseUsage.outputTokens,
          cacheReadTokens: responseUsage.cacheReadTokens,
          cacheCreationTokens: responseUsage.cacheCreationTokens
        }
        this.operations.recordRequest({
          requestId,
          appType,
          providerKey: target.providerKey,
          providerName: target.providerName,
          model: responseUsage.model || requestUsage.model || target.model,
          ...pricedUsage,
          totalCostUsd: this.operations.estimateCost(responseUsage.model || requestUsage.model || target.model, pricedUsage),
          latencyMs: Date.now() - startedAt,
          statusCode,
          error: errorMessage,
          createdAt: startedAt
        })
      }
    }
  }

  private async forward(
    request: IncomingMessage,
    body: Buffer,
    app: RoutingProxyAppConfig
  ): Promise<ForwardResult> {
    const candidates = this.resolveCandidates(app)
    if (!candidates.length) throw new Error(`${app.appType} 没有可用的原生协议供应商`)
    const attempts = app.autoFailoverEnabled ? Math.max(1, app.maxRetries + 1) : 1
    let lastError: unknown
    let lastResult: ForwardResult | undefined
    let lastTarget: RoutingProxyTarget | undefined
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const target = this.selectHealthyTarget(candidates, attempt)
      if (!target) break
      lastTarget = target
      if (attempt > 0) this.failoverCount += 1
      try {
        const upstream = await this.fetchTarget(request, body, target, app)
        const result: ForwardResult = { response: upstream, target }
        if (RETRYABLE_STATUS.has(upstream.status)) {
          result.bufferedBody = new Uint8Array(await upstream.arrayBuffer())
          lastResult = result
          this.markFailure(target, app)
          continue
        }
        this.markSuccess(target, app)
        return result
      } catch (error) {
        lastError = error
        this.markFailure(target, app)
      }
    }
    if (lastResult) return lastResult
    throw new RoutingForwardError(
      lastError instanceof Error ? lastError.message : '所有本地路由供应商均不可用',
      lastTarget
    )
  }

  private resolveCandidates(app: RoutingProxyAppConfig): RoutingProxyTarget[] {
    const routing = this.repository.getSnapshot()
    const currentKey = routing.apps.find((candidate) => candidate.id === app.appType)?.currentProviderKey
    const keys = [...new Set([currentKey, ...app.queue].filter((key): key is string => Boolean(key)))]
    return keys
      .map((key) => this.repository.resolveProxyTarget(key, app.appType))
      .filter((target): target is RoutingProxyTarget => Boolean(target && !target.requiresProxy))
  }

  private selectHealthyTarget(candidates: RoutingProxyTarget[], attempt: number): RoutingProxyTarget | undefined {
    const now = Date.now()
    for (let offset = 0; offset < candidates.length; offset += 1) {
      const target = candidates[(attempt + offset) % candidates.length]
      const health = this.health.get(healthKey(target))
      if (!health) return target
      if (health.openUntil <= now) {
        if (health.openUntil > 0) {
          health.halfOpen = true
          health.openUntil = 0
          this.health.set(healthKey(target), health)
        }
        return target
      }
    }
    return undefined
  }

  private markFailure(target: RoutingProxyTarget, app: RoutingProxyAppConfig): void {
    const key = healthKey(target)
    const health = this.health.get(key) ?? {
      consecutiveFailures: 0,
      consecutiveSuccesses: 0,
      totalRequests: 0,
      failedRequests: 0,
      openUntil: 0,
      halfOpen: false
    }
    health.consecutiveFailures += 1
    health.consecutiveSuccesses = 0
    health.totalRequests += 1
    health.failedRequests += 1
    const errorRate = health.failedRequests / health.totalRequests
    if (
      health.halfOpen
      || health.consecutiveFailures >= app.failureThreshold
      || health.totalRequests >= app.minRequests && errorRate >= app.errorRateThreshold
    ) {
      health.openUntil = Date.now() + app.cooldownSeconds * 1000
      health.consecutiveFailures = 0
      health.halfOpen = false
    }
    this.health.set(key, health)
  }

  private markSuccess(target: RoutingProxyTarget, app: RoutingProxyAppConfig): void {
    const key = healthKey(target)
    const health = this.health.get(key)
    if (!health) return
    health.totalRequests += 1
    health.consecutiveFailures = 0
    health.consecutiveSuccesses += 1
    if (health.consecutiveSuccesses >= app.successThreshold) {
      this.health.delete(key)
      return
    }
    this.health.set(key, health)
  }

  private async fetchTarget(
    request: IncomingMessage,
    body: Buffer,
    target: RoutingProxyTarget,
    app: RoutingProxyAppConfig
  ): Promise<Response> {
    const url = buildUpstreamUrl(target.baseUrl, request.url ?? '/', target.appType)
    const headers = buildUpstreamHeaders(request.headers, target)
    const controller = new AbortController()
    const timeoutSeconds = isStreamingRequest(request.headers, body)
      ? app.streamingFirstByteTimeout
      : app.nonStreamingTimeout
    const timeout = setTimeout(() => controller.abort(new Error('上游请求超时')), timeoutSeconds * 1000)
    try {
      return await fetch(url, {
        method: request.method,
        headers,
        body: request.method === 'GET' || request.method === 'HEAD' ? undefined : Uint8Array.from(body),
        redirect: 'manual',
        signal: controller.signal
      })
    } finally {
      clearTimeout(timeout)
    }
  }
}

function identifyApp(url: string): ProxyRoutingAppType | undefined {
  const path = new URL(url, 'http://localhost').pathname
  if (path === '/v1/messages' || path.startsWith('/claude/')) return 'claude'
  if (
    path === '/responses'
    || path.startsWith('/responses/')
    || path === '/models'
    || path.startsWith('/models/')
    || path === '/chat/completions'
    || path.startsWith('/v1/responses')
    || path.startsWith('/v1/v1/responses')
    || path.startsWith('/v1/chat/completions')
    || path.startsWith('/v1/v1/chat/completions')
    || path.startsWith('/v1/models')
    || path.startsWith('/codex/')
  ) return 'codex'
  if (path.startsWith('/v1beta/') || path.startsWith('/gemini/v1beta/') || path.startsWith('/gemini/v1/')) return 'gemini'
  return undefined
}

function buildUpstreamUrl(baseUrl: string, incomingUrl: string, appType: ProxyRoutingAppType): URL {
  const incoming = new URL(incomingUrl, 'http://localhost')
  const prefixes = [`/${appType}`]
  const prefix = prefixes.find((candidate) => incoming.pathname.startsWith(`${candidate}/`))
  let path = prefix ? incoming.pathname.slice(prefix.length) : incoming.pathname
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const basePath = base.pathname.replace(/\/$/, '')
  if (basePath && (path === basePath || path.startsWith(`${basePath}/`))) {
    path = path.slice(basePath.length) || '/'
  }
  base.pathname = `${basePath}/${path.replace(/^\//, '')}`.replace(/\/{2,}/g, '/')
  base.search = incoming.search
  return base
}

function buildUpstreamHeaders(headers: IncomingHttpHeaders, target: RoutingProxyTarget): Headers {
  const result = new Headers()
  for (const [name, value] of Object.entries(headers)) {
    if (!value || HOP_BY_HOP_HEADERS.has(name.toLowerCase()) || name.toLowerCase() === 'host' || name.toLowerCase() === 'content-length' || name.toLowerCase() === 'accept-encoding') continue
    if (Array.isArray(value)) value.forEach((item) => result.append(name, item))
    else result.set(name, value)
  }
  if (target.apiKey) {
    if (target.appType === 'claude') {
      result.set('authorization', `Bearer ${target.apiKey}`)
      result.set('x-api-key', target.apiKey)
    } else if (target.appType === 'codex') {
      result.set('authorization', `Bearer ${target.apiKey}`)
    } else {
      result.set('x-goog-api-key', target.apiKey)
    }
  }
  result.set('accept-encoding', 'identity')
  return result
}

function copyResponseHeaders(headers: Headers, response: ServerResponse): void {
  headers.forEach((value, name) => {
    if (!HOP_BY_HOP_HEADERS.has(name.toLowerCase()) && name.toLowerCase() !== 'content-length' && name.toLowerCase() !== 'content-encoding') {
      response.setHeader(name, value)
    }
  })
}

function isStreamingRequest(headers: IncomingHttpHeaders, body: Buffer<ArrayBufferLike>): boolean {
  const accept = Array.isArray(headers.accept) ? headers.accept.join(',') : headers.accept ?? ''
  if (accept.includes('text/event-stream')) return true
  return parseJson(body)?.stream === true
}

async function* readResponseBody(
  body: ReadableStream<Uint8Array>,
  idleTimeoutSeconds: number
): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()
  try {
    while (true) {
      let timer: ReturnType<typeof setTimeout> | undefined
      const result = await Promise.race([
        reader.read(),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new Error('上游响应空闲超时')), idleTimeoutSeconds * 1000)
        })
      ]).finally(() => {
        if (timer) clearTimeout(timer)
      })
      if (result.done) return
      yield result.value
    }
  } finally {
    try { await reader.cancel() } catch { /* the stream may already be closed */ }
    reader.releaseLock()
  }
}

async function readRequestBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const value of request) {
    const chunk = Buffer.from(value)
    size += chunk.length
    if (size > REQUEST_LIMIT_BYTES) throw new Error('请求体超过 50 MB 限制')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function extractRequestUsage(body: Buffer, fallbackModel: string): ParsedUsage {
  const json = parseJson(body)
  return emptyUsage(typeof json?.model === 'string' ? json.model : fallbackModel)
}

function extractResponseUsage(body: Buffer, fallbackModel: string, appType: ProxyRoutingAppType): ParsedUsage {
  const text = body.toString('utf8').trim()
  if (!text) return emptyUsage(fallbackModel)
  const direct = parseJson(body)
  if (direct) return usageFromJson(direct, fallbackModel, appType)
  let usage = emptyUsage(fallbackModel)
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('data:')) continue
    const value = line.slice(5).trim()
    if (!value || value === '[DONE]') continue
    try {
      usage = mergeUsage(usage, usageFromJson(JSON.parse(value) as Record<string, unknown>, fallbackModel, appType))
    } catch { /* ignore non-JSON streaming events */ }
  }
  return usage
}

function usageFromJson(json: Record<string, unknown>, fallbackModel: string, appType: ProxyRoutingAppType): ParsedUsage {
  const response = isRecord(json.response) ? json.response : undefined
  const message = isRecord(json.message) ? json.message : undefined
  const delta = isRecord(json.delta) ? json.delta : undefined
  const payload = response ?? message ?? json
  const usage = isRecord(payload.usage)
    ? payload.usage
    : isRecord(delta?.usage)
      ? delta.usage
      : {}
  const metadata = isRecord(payload.usageMetadata) ? payload.usageMetadata : {}
  const inputDetails = isRecord(usage.input_tokens_details) ? usage.input_tokens_details : {}
  const promptDetails = isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : {}
  const cacheReadTokens = numeric(
    usage.cache_read_input_tokens
    ?? usage.cached_tokens
    ?? inputDetails.cached_tokens
    ?? promptDetails.cached_tokens
    ?? metadata.cachedContentTokenCount
  )
  const rawInputTokens = numeric(usage.input_tokens ?? usage.prompt_tokens ?? metadata.promptTokenCount)
  const totalGeminiTokens = numeric(metadata.totalTokenCount)
  const outputTokens = appType === 'gemini' && totalGeminiTokens
    ? Math.max(0, totalGeminiTokens - rawInputTokens)
    : numeric(usage.output_tokens ?? usage.completion_tokens ?? metadata.candidatesTokenCount)
  return {
    model: typeof payload.model === 'string'
      ? payload.model
      : typeof payload.modelVersion === 'string'
        ? payload.modelVersion
        : fallbackModel,
    inputTokens: appType === 'claude' ? rawInputTokens : Math.max(0, rawInputTokens - cacheReadTokens),
    outputTokens,
    cacheReadTokens,
    cacheCreationTokens: numeric(usage.cache_creation_input_tokens)
  }
}

function mergeUsage(left: ParsedUsage, right: ParsedUsage): ParsedUsage {
  return {
    model: right.model || left.model,
    inputTokens: Math.max(left.inputTokens, right.inputTokens),
    outputTokens: Math.max(left.outputTokens, right.outputTokens),
    cacheReadTokens: Math.max(left.cacheReadTokens, right.cacheReadTokens),
    cacheCreationTokens: Math.max(left.cacheCreationTokens, right.cacheCreationTokens)
  }
}

function emptyUsage(model: string): ParsedUsage {
  return { model, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 }
}

function parseJson(body: Buffer): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(body.toString('utf8')) as unknown
    return isRecord(parsed) ? parsed : undefined
  } catch {
    return undefined
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

function numeric(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0
}

function healthKey(target: RoutingProxyTarget): string {
  return `${target.appType}:${target.providerKey}`
}

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}

async function closeServer(server: Server): Promise<void> {
  if (!server.listening) return
  await new Promise<void>((resolve, reject) => {
    const forceClose = setTimeout(() => server.closeAllConnections(), 2_000)
    server.close((error) => {
      clearTimeout(forceClose)
      if (error) reject(error)
      else resolve()
    })
    server.closeIdleConnections()
  })
}

export function isProxyRoutingAppType(value: string): value is ProxyRoutingAppType {
  return (proxyRoutingAppTypes as readonly string[]).includes(value)
}
