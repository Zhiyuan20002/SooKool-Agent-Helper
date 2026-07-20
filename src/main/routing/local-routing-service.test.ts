import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { gzipSync } from 'node:zlib'
import { RoutingOperationsRepository } from './routing-operations.ts'
import { LocalRoutingService, type RoutingTargetRepository } from './local-routing-service.ts'
import type { RoutingSnapshot } from '../../shared/routing-types.ts'

async function reservePort(): Promise<number> {
  const server = createServer()
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : 0
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

test('routes a native Claude request, applies provider credentials, and records usage', async () => {
  let upstreamHeaders: Record<string, string | string[] | undefined> = {}
  const upstream = createServer((request, response) => {
    upstreamHeaders = request.headers
    response.setHeader('content-type', 'application/json')
    response.setHeader('content-encoding', 'gzip')
    response.end(gzipSync(JSON.stringify({
      id: 'message-1',
      model: 'claude-sonnet',
      usage: { input_tokens: 12, output_tokens: 7, cache_read_input_tokens: 3 }
    })))
  })
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const upstreamAddress = upstream.address()
  const upstreamPort = typeof upstreamAddress === 'object' && upstreamAddress ? upstreamAddress.port : 0
  const root = mkdtempSync(join(tmpdir(), 'local-routing-'))
  const operations = new RoutingOperationsRepository({
    databasePath: join(root, 'routing.db'),
    ccSwitchDbPath: join(root, 'missing.db')
  })
  const proxyPort = await reservePort()
  operations.updateConfig({
    global: { listenPort: proxyPort },
    app: { appType: 'claude', enabled: true }
  })
  const takeoverCalls: Array<string | undefined> = []
  const snapshot = {
    apps: [{ id: 'claude', providerCount: 1, currentProviderKey: 'sookool:provider:one', currentProviderName: 'One' }],
    providers: []
  } as unknown as RoutingSnapshot
  const repository: RoutingTargetRepository = {
    getSnapshot: () => snapshot,
    resolveProxyTarget: () => ({
      providerKey: 'sookool:provider:one',
      providerId: 'one',
      providerName: 'One',
      appType: 'claude',
      source: 'sookool',
      baseUrl: `http://127.0.0.1:${upstreamPort}`,
      model: 'claude-sonnet',
      apiKey: 'provider-secret',
      requiresProxy: false
    }),
    setProxyTakeover: (_appType, origin) => takeoverCalls.push(origin)
  }
  const service = new LocalRoutingService({ repository, operations })

  await service.start()
  const response = await fetch(`http://127.0.0.1:${proxyPort}/claude/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet', messages: [] })
  })
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-encoding'), null)
  assert.equal((await response.json() as { id: string }).id, 'message-1')
  assert.equal(upstreamHeaders.authorization, 'Bearer provider-secret')
  assert.equal(upstreamHeaders['x-api-key'], 'provider-secret')
  assert.equal(operations.getUsageSnapshot({ days: 1 }).summary.totalRequests, 1)
  assert.equal(operations.getUsageSnapshot({ days: 1 }).summary.totalTokens, 22)
  assert.match(takeoverCalls[0] ?? '', new RegExp(`:${proxyPort}$`))
  const desktopResponse = await fetch(`http://127.0.0.1:${proxyPort}/claude-desktop/v1/messages`, { method: 'POST' })
  assert.equal(desktopResponse.status, 404)
  await assert.rejects(service.updateConfig({ global: { listenPort: 80 } }), /1024/)
  await assert.rejects(service.updateConfig({
    global: { listenPort: proxyPort },
    app: { appType: 'claude', enabled: false }
  }), /分别保存/)
  assert.equal(service.getSnapshot().status.running, true)

  await service.stop()
  assert.equal(takeoverCalls.at(-1), undefined)
  operations.close()
  await new Promise<void>((resolve, reject) => upstream.close((error) => error ? reject(error) : resolve()))
})

test('fails over to a queued provider after a retryable upstream response', async () => {
  let primaryRequests = 0
  let backupRequests = 0
  const primary = createServer((_request, response) => {
    primaryRequests += 1
    response.statusCode = 503
    response.end('{"error":"busy"}')
  })
  const backup = createServer((_request, response) => {
    backupRequests += 1
    response.setHeader('content-type', 'application/json')
    response.end(JSON.stringify({ id: 'backup', model: 'claude-sonnet', usage: { input_tokens: 4, output_tokens: 2 } }))
  })
  await Promise.all([
    new Promise<void>((resolve) => primary.listen(0, '127.0.0.1', resolve)),
    new Promise<void>((resolve) => backup.listen(0, '127.0.0.1', resolve))
  ])
  const primaryAddress = primary.address()
  const backupAddress = backup.address()
  const primaryPort = typeof primaryAddress === 'object' && primaryAddress ? primaryAddress.port : 0
  const backupPort = typeof backupAddress === 'object' && backupAddress ? backupAddress.port : 0
  const root = mkdtempSync(join(tmpdir(), 'local-routing-failover-'))
  const operations = new RoutingOperationsRepository({
    databasePath: join(root, 'routing.db'),
    ccSwitchDbPath: join(root, 'missing.db')
  })
  const proxyPort = await reservePort()
  operations.updateConfig({ global: { listenPort: proxyPort } })
  operations.updateConfig({
    app: {
      appType: 'claude',
      enabled: true,
      autoFailoverEnabled: true,
      maxRetries: 1,
      queue: ['sookool:provider:backup']
    }
  })
  const snapshot = {
    apps: [{ id: 'claude', providerCount: 2, currentProviderKey: 'sookool:provider:primary', currentProviderName: 'Primary' }],
    providers: []
  } as unknown as RoutingSnapshot
  const repository: RoutingTargetRepository = {
    getSnapshot: () => snapshot,
    resolveProxyTarget: (key) => ({
      providerKey: key,
      providerId: key.endsWith('backup') ? 'backup' : 'primary',
      providerName: key.endsWith('backup') ? 'Backup' : 'Primary',
      appType: 'claude',
      source: 'sookool',
      baseUrl: `http://127.0.0.1:${key.endsWith('backup') ? backupPort : primaryPort}`,
      model: 'claude-sonnet',
      apiKey: 'secret',
      requiresProxy: false
    }),
    setProxyTakeover: () => undefined
  }
  const service = new LocalRoutingService({ repository, operations })

  await service.start()
  const response = await fetch(`http://127.0.0.1:${proxyPort}/claude/v1/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [] })
  })
  assert.equal(response.status, 200)
  assert.equal((await response.json() as { id: string }).id, 'backup')
  assert.equal(primaryRequests, 1)
  assert.equal(backupRequests, 1)
  assert.equal(service.getSnapshot().status.failoverCount, 1)
  assert.equal(service.getSnapshot().status.activeTargets[0]?.providerName, 'Backup')
  assert.equal(operations.getUsageSnapshot({ days: 1 }).recent[0]?.providerName, 'Backup')

  await service.stop()
  operations.close()
  await Promise.all([
    new Promise<void>((resolve, reject) => primary.close((error) => error ? reject(error) : resolve())),
    new Promise<void>((resolve, reject) => backup.close((error) => error ? reject(error) : resolve()))
  ])
})
